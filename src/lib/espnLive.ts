/**
 * ESPN live draft-room feed.
 *
 * ESPN's draft room does not read picks from the v3 API — it joins a dedicated draft service over
 * a WebSocket (SSE fallback) and receives space-delimited events, `SELECTED {teamId} {playerId}
 * {slotId}` being the one that matters. This module keeps that SSE stream open server-side and
 * exposes the selections it has seen, so `getEspnState` can fill in picks the v3 board is still
 * showing as placeholders.
 *
 * The room only exists while the draft is live: joining before then answers HTTP 500, which is
 * treated as "not open yet" and retried with backoff. Everything here is best-effort — v3 polling
 * and manual cross-off remain the fallbacks.
 */

const DRAFT_HOST = "https://fantasydraft.espn.com";
const PING_MS = 25_000;
/** Retry gap while the room is closed (pre-draft), so polling isn't slowed down by 500s. */
const RETRY_CLOSED_MS = 20_000;
const RETRY_ERROR_MS = 5_000;
/** A live draft never goes this long without a clock tick, so treat silence as a dead stream. */
const STALE_MS = 90_000;

export interface EspnSelection {
  teamId: string;
  playerId: number;
  slotId: number;
  at: number;
}

export type EspnLiveStatus = "idle" | "connecting" | "open" | "waiting" | "error";

interface Subscription {
  leagueId: string;
  season: string;
  teamId: string;
  gameId: number;
  status: EspnLiveStatus;
  error: string | null;
  selections: EspnSelection[];
  /** true once the room has sent anything, i.e. the stream is genuinely live */
  sawMessage: boolean;
  connectedAt: number | null;
  lastMessageAt: number | null;
  nextAttemptAt: number;
  controller: AbortController | null;
  pingTimer: ReturnType<typeof setInterval> | null;
}

const subs = new Map<string, Subscription>();

function key(leagueId: string, season: string, teamId: string) {
  return `${season}:${leagueId}:${teamId}`;
}

function cookieHeader(): string {
  const s2 = process.env.ESPN_S2;
  const swid = process.env.ESPN_SWID;
  if (!s2 || !swid) throw new Error("ESPN credentials missing");
  return `espn_s2=${s2}; SWID=${swid}`;
}

function memberId(): string {
  const swid = process.env.ESPN_SWID;
  if (!swid) throw new Error("ESPN credentials missing");
  return swid;
}

/**
 * The draft service token is `{gameId}:{leagueId}:{teamId}:{memberId}:{draftSecurity}`, where the
 * last part comes from an authenticated v3 call for the team you own.
 */
async function draftToken(sub: Subscription): Promise<string> {
  const res = await fetch(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${sub.season}` +
      `/segments/0/leagues/${sub.leagueId}/teams/${sub.teamId}/draftSecurity`,
    { headers: { cookie: cookieHeader() }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`draftSecurity failed: HTTP ${res.status}`);
  const security = (await res.text()).trim();
  return `${sub.gameId}:${sub.leagueId}:${sub.teamId}:${memberId()}:${security}`;
}

function roomBase(sub: Subscription): string {
  return `${DRAFT_HOST}/game-${sub.gameId}/league-${sub.leagueId}`;
}

function joinUrl(sub: Subscription, token: string): string {
  const q = new URLSearchParams({
    "1": String(sub.gameId),
    "2": sub.leagueId,
    "3": sub.teamId,
    "4": memberId(),
    "5": token,
    "6": "false",
    "7": "false",
    "8": "KONA",
    nocache: String(Math.floor(Math.random() * 1e6)),
  });
  return `${roomBase(sub)}/sse/JOIN?${q}`;
}

/** Draft-room events are space-delimited; only selections change the board. */
function handleEvent(sub: Subscription, payload: string) {
  sub.sawMessage = true;
  sub.lastMessageAt = Date.now();
  const fields = payload.trim().split(/\s+/);
  if (fields[0] !== "SELECTED") return;
  const teamId = Number(fields[1]);
  const playerId = Number(fields[2]);
  if (!Number.isFinite(teamId) || !Number.isFinite(playerId) || playerId <= 0) return;
  if (sub.selections.some((s) => s.playerId === playerId)) return;
  sub.selections.push({
    teamId: String(teamId),
    playerId,
    slotId: Number(fields[3]) || 0,
    at: Date.now(),
  });
}

function stopPing(sub: Subscription) {
  if (sub.pingTimer) clearInterval(sub.pingTimer);
  sub.pingTimer = null;
}

function startPing(sub: Subscription, token: string) {
  stopPing(sub);
  sub.pingTimer = setInterval(() => {
    void fetch(`${roomBase(sub)}/PING?1=${Date.now()}&token=${encodeURIComponent(token)}`, {
      headers: { cookie: cookieHeader() },
      cache: "no-store",
    }).catch(() => {});
  }, PING_MS);
  // Node keeps the process alive for timers; this one must never do that.
  sub.pingTimer.unref?.();
}

async function connect(sub: Subscription) {
  sub.status = "connecting";
  sub.error = null;
  const controller = new AbortController();
  sub.controller = controller;
  try {
    const token = await draftToken(sub);
    const res = await fetch(joinUrl(sub, token), {
      headers: { accept: "text/event-stream", cookie: cookieHeader() },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      // The room does not exist until the draft opens, which the service reports as a 500.
      const closed = res.status >= 500;
      sub.status = closed ? "waiting" : "error";
      sub.error = closed
        ? "not open yet"
        : `refused the connection (HTTP ${res.status})`;
      sub.nextAttemptAt = Date.now() + (closed ? RETRY_CLOSED_MS : RETRY_ERROR_MS);
      return;
    }
    sub.status = "open";
    sub.connectedAt = Date.now();
    sub.lastMessageAt = Date.now();
    startPing(sub, token);
    await readStream(sub, res.body);
    sub.status = "waiting";
    sub.error = "stream closed";
  } catch (err) {
    sub.status = "error";
    sub.error = err instanceof Error ? err.message : "ESPN draft room connection failed";
  } finally {
    stopPing(sub);
    sub.controller = null;
    sub.nextAttemptAt = Math.max(sub.nextAttemptAt, Date.now() + RETRY_ERROR_MS);
  }
}

async function readStream(sub: Subscription, body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("data:")) handleEvent(sub, trimmed.slice(5));
      else if (!trimmed.startsWith(":")) handleEvent(sub, trimmed);
    }
  }
}

export interface EspnLiveFeed {
  status: EspnLiveStatus;
  error: string | null;
  selections: EspnSelection[];
  /** true when the stream is open and has produced traffic recently */
  live: boolean;
}

/**
 * Returns what the live feed knows, starting or restarting the connection in the background.
 * Never throws and never blocks on the draft service.
 */
export function espnLiveFeed(leagueId: string, season: string, teamId: string): EspnLiveFeed {
  const id = key(leagueId, season, teamId);
  let sub = subs.get(id);
  if (!sub) {
    sub = {
      leagueId,
      season,
      teamId,
      gameId: 1,
      status: "idle",
      error: null,
      selections: [],
      sawMessage: false,
      connectedAt: null,
      lastMessageAt: null,
      nextAttemptAt: 0,
      controller: null,
      pingTimer: null,
    };
    subs.set(id, sub);
  }

  const now = Date.now();
  const stale =
    sub.status === "open" && sub.lastMessageAt !== null && now - sub.lastMessageAt > STALE_MS;
  if (stale) {
    sub.controller?.abort();
    sub.status = "waiting";
  }
  const idle = sub.status === "idle" || sub.status === "waiting" || sub.status === "error";
  if (idle && now >= sub.nextAttemptAt && !sub.controller) {
    sub.nextAttemptAt = now + RETRY_ERROR_MS;
    void connect(sub);
  }

  return {
    status: sub.status,
    error: sub.error,
    selections: [...sub.selections],
    live: sub.status === "open" && sub.sawMessage,
  };
}

/** Test seam: forget every subscription. */
export function resetEspnLive() {
  for (const sub of subs.values()) {
    sub.controller?.abort();
    stopPing(sub);
  }
  subs.clear();
}
