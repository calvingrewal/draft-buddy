import { normalizePos } from "./names";
import { snakeTeamId } from "./sleeper";
import type { DraftPick, DraftState, DraftTeam, PlayerRef } from "./types";

const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";

const POSITIONS: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  7: "P",
  9: "DT",
  10: "DE",
  11: "LB",
  12: "CB",
  13: "S",
  14: "HC",
  16: "DST",
};

const PRO_TEAMS: Record<number, string> = {
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  25: "SF",
  26: "SEA",
  27: "TB",
  28: "WAS",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
};

/** Bench (20) counts toward draft rounds; IR (21) does not. */
const DRAFTABLE_SLOTS = new Set([0, 2, 4, 6, 16, 17, 20, 23]);

const LINEUP_SLOTS: Record<number, string> = {
  0: "QB",
  2: "RB",
  4: "WR",
  6: "TE",
  16: "DST",
  17: "K",
  23: "FLEX",
};

interface EspnPlayer {
  id: number;
  fullName?: string;
  defaultPositionId: number;
  proTeamId: number;
}

interface EspnLeague {
  gameId: number;
  id: number;
  status?: { latestScoringPeriod?: number };
  settings: {
    name: string;
    size: number;
    draftSettings: {
      type: string;
      pickOrder?: number[];
      timePerSelection?: number;
    };
    rosterSettings: { lineupSlotCounts: Record<string, number> };
  };
  teams: Array<{ id: number; name?: string; abbrev?: string; location?: string; nickname?: string }>;
  draftDetail: {
    drafted: boolean;
    inProgress: boolean;
    picks?: Array<{
      playerId: number;
      teamId: number;
      roundId: number;
      roundPickNumber: number;
      overallPickNumber: number;
      keeper: boolean;
    }>;
  };
}

function cookieHeader(): string {
  const s2 = process.env.ESPN_S2;
  const swid = process.env.ESPN_SWID;
  if (!s2 || !swid) {
    throw new Error(
      "ESPN credentials missing: set ESPN_S2 and ESPN_SWID environment variables.",
    );
  }
  return `espn_s2=${s2}; SWID=${swid}`;
}

async function espnGet<T>(
  path: string,
  init: { filter?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.auth !== false) headers.cookie = cookieHeader();
  if (init.filter) headers["x-fantasy-filter"] = JSON.stringify(init.filter);
  const res = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ESPN ${path.split("?")[0]} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface PlayerCache {
  season: string;
  fetchedAt: number;
  byId: Map<number, PlayerRef>;
}

let playerCache: PlayerCache | null = null;
const PLAYER_TTL_MS = 6 * 60 * 60 * 1000;

async function getPlayerIndex(season: string): Promise<Map<number, PlayerRef>> {
  if (
    playerCache &&
    playerCache.season === season &&
    Date.now() - playerCache.fetchedAt < PLAYER_TTL_MS
  ) {
    return playerCache.byId;
  }
  const players = await espnGet<EspnPlayer[]>(
    `/seasons/${season}/players?scoringPeriodId=0&view=players_wl`,
    { filter: { players: { limit: 20000 } } },
  );
  const byId = new Map<number, PlayerRef>();
  for (const p of players) {
    if (!p.fullName) continue;
    byId.set(p.id, {
      id: String(p.id),
      name: p.fullName,
      pos: normalizePos(POSITIONS[p.defaultPositionId] ?? ""),
      team: PRO_TEAMS[p.proTeamId] ?? null,
    });
  }
  playerCache = { season, fetchedAt: Date.now(), byId };
  return byId;
}

export interface EspnTarget {
  leagueId: string;
  season: string;
}

/** Accepts a raw league id or any ESPN fantasy URL containing leagueId/seasonId. */
export function parseEspnTarget(raw: string, seasonFallback: string): EspnTarget {
  const trimmed = raw.trim();
  const league = trimmed.match(/leagueId[=/](\d+)/i)?.[1] ?? trimmed.match(/(\d{6,})/)?.[1];
  const season = trimmed.match(/seasonId[=/](\d{4})/i)?.[1] ?? seasonFallback;
  if (!league) throw new Error(`Could not find an ESPN league id in "${raw}"`);
  return { leagueId: league, season };
}

export async function getEspnState(
  rawId: string,
  seasonFallback: string,
): Promise<DraftState> {
  const { leagueId, season } = parseEspnTarget(rawId, seasonFallback);
  const league = await espnGet<EspnLeague>(
    `/seasons/${season}/segments/0/leagues/${leagueId}?view=mDraftDetail&view=mSettings&view=mTeam`,
  );

  const teamCount = league.settings.size || league.teams.length;
  const slotCounts = league.settings.rosterSettings.lineupSlotCounts ?? {};
  const slotRounds = Object.entries(slotCounts).reduce(
    (sum, [slotId, count]) =>
      sum + (count > 0 && DRAFTABLE_SLOTS.has(Number(slotId)) ? count : 0),
    0,
  );
  const rosterSlots: string[] = [];
  for (const [slotId, count] of Object.entries(slotCounts)) {
    const label = LINEUP_SLOTS[Number(slotId)];
    if (!label || !count) continue;
    for (let i = 0; i < count; i++) rosterSlots.push(label);
  }

  const rawPicks = league.draftDetail.picks ?? [];
  // ESPN pre-populates a placeholder row for every pick, so the board length is authoritative.
  const rounds =
    rawPicks.length >= teamCount ? Math.floor(rawPicks.length / teamCount) : slotRounds;
  const needsNames = rawPicks.some((p) => p.playerId > 0);
  const playerIndex = needsNames
    ? await getPlayerIndex(season).catch(() => new Map<number, PlayerRef>())
    : new Map<number, PlayerRef>();

  const teams: DraftTeam[] = league.teams.map((t) => ({
    id: String(t.id),
    name:
      t.name ||
      [t.location, t.nickname].filter(Boolean).join(" ") ||
      t.abbrev ||
      `Team ${t.id}`,
    slot: null,
  }));

  const pickOrder = (league.settings.draftSettings.pickOrder ?? []).map(String);
  const order =
    pickOrder.length === teamCount ? pickOrder : teams.map((t) => t.id);
  order.forEach((teamId, idx) => {
    const team = teams.find((t) => t.id === teamId);
    if (team) team.slot = idx + 1;
  });

  const picks: DraftPick[] = rawPicks
    .map((p) => ({
      pickNo: p.overallPickNumber,
      round: p.roundId,
      roundPick: p.roundPickNumber,
      teamId: String(p.teamId),
      player:
        p.playerId > 0
          ? (playerIndex.get(p.playerId) ?? {
              id: String(p.playerId),
              name: `ESPN player ${p.playerId}`,
              pos: "",
              team: null,
            })
          : null,
    }))
    .sort((a, b) => a.pickNo - b.pickNo);

  const madePicks = picks.filter((p) => p.player).length;
  const totalPicks = rounds * teamCount;
  const complete = league.draftDetail.drafted || madePicks >= totalPicks;
  const onClockPickNo = complete ? null : madePicks + 1;
  const onClockFromBoard = picks.find((p) => p.pickNo === onClockPickNo)?.teamId;

  const notes: string[] = [];
  if (league.settings.draftSettings.type !== "SNAKE") {
    notes.push(`ESPN draft type is ${league.settings.draftSettings.type}.`);
  }

  return {
    platform: "espn",
    draftId: leagueId,
    leagueName: league.settings.name,
    status: complete ? "complete" : league.draftDetail.inProgress ? "drafting" : "pre_draft",
    rounds: rounds || 16,
    teamCount,
    rosterSlots,
    teams,
    order,
    picks,
    onClockPickNo,
    onClockTeamId: onClockPickNo
      ? (onClockFromBoard ?? snakeTeamId(order, onClockPickNo, teamCount))
      : null,
    updatedAt: Date.now(),
    notes,
  };
}
