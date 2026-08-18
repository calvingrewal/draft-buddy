import { normalizePos, normalizeTeam } from "./names";
import type { DraftPick, DraftState, DraftTeam } from "./types";

const BASE = "https://api.sleeper.app/v1";

async function get<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}_=${Date.now()}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Sleeper ${path} failed: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface SleeperLeague {
  league_id: string;
  name: string;
  status: string;
  draft_id: string;
  total_rosters: number;
  roster_positions: string[];
}

interface SleeperDraft {
  draft_id: string;
  league_id: string | null;
  status: string;
  type: string;
  metadata?: { name?: string };
  settings: { rounds: number; teams: number; reversal_round?: number };
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string | null };
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
}

interface SleeperPick {
  round: number;
  pick_no: number;
  draft_slot: number;
  roster_id: number | null;
  picked_by: string;
  player_id: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}

/** Accepts a league id, a draft id, or a sleeper.com URL containing either. */
export async function getSleeperState(rawId: string): Promise<DraftState> {
  const id = extractId(rawId);
  const notes: string[] = [];
  let league: SleeperLeague | null = null;
  let draft: SleeperDraft;

  try {
    draft = await get<SleeperDraft>(`/draft/${id}`);
  } catch {
    league = await get<SleeperLeague>(`/league/${id}`);
    if (!league?.draft_id) throw new Error(`No draft found for Sleeper id ${id}`);
    draft = await get<SleeperDraft>(`/draft/${league.draft_id}`);
  }
  if (!league && draft.league_id) {
    league = await get<SleeperLeague>(`/league/${draft.league_id}`).catch(() => null);
  }

  const [users, rosters, picks] = await Promise.all([
    league
      ? get<SleeperUser[]>(`/league/${league.league_id}/users`).catch(() => [])
      : Promise.resolve<SleeperUser[]>([]),
    league
      ? get<SleeperRoster[]>(`/league/${league.league_id}/rosters`).catch(() => [])
      : Promise.resolve<SleeperRoster[]>([]),
    get<SleeperPick[]>(`/draft/${draft.draft_id}/picks`).catch(() => []),
  ]);

  const teamCount = draft.settings.teams || league?.total_rosters || 12;
  const rounds = draft.settings.rounds || league?.roster_positions?.length || 15;
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const rosterOwner = new Map(rosters.map((r) => [r.roster_id, r.owner_id]));

  // Teams are keyed by draft slot: it is the only id present in every draft type.
  const teams: DraftTeam[] = [];
  for (let slot = 1; slot <= teamCount; slot++) {
    const ownerFromOrder = Object.entries(draft.draft_order ?? {}).find(
      ([, s]) => s === slot,
    )?.[0];
    const rosterId = draft.slot_to_roster_id?.[String(slot)];
    const ownerId =
      ownerFromOrder ?? (rosterId ? (rosterOwner.get(rosterId) ?? undefined) : undefined);
    const user = ownerId ? userById.get(ownerId) : undefined;
    teams.push({
      id: String(slot),
      slot,
      name:
        user?.metadata?.team_name ||
        user?.display_name ||
        (ownerId ? `Team ${slot}` : `Slot ${slot}`),
    });
  }

  const reversal = draft.settings.reversal_round || 0;
  const normalized: DraftPick[] = picks
    .filter((p) => p.pick_no > 0)
    .map((p) => ({
      pickNo: p.pick_no,
      round: p.round,
      roundPick: p.pick_no - (p.round - 1) * teamCount,
      teamId: String(p.draft_slot),
      player: p.player_id
        ? {
            id: p.player_id,
            name:
              `${p.metadata?.first_name ?? ""} ${p.metadata?.last_name ?? ""}`.trim() ||
              p.player_id,
            pos: normalizePos(p.metadata?.position),
            team: normalizeTeam(p.metadata?.team ?? null),
          }
        : null,
    }))
    .sort((a, b) => a.pickNo - b.pickNo);

  const madePicks = normalized.filter((p) => p.player).length;
  const onClockPickNo =
    draft.status === "complete" || madePicks >= rounds * teamCount ? null : madePicks + 1;
  const order = teams.map((t) => t.id);

  if (draft.type !== "snake") {
    notes.push(`Sleeper draft type is "${draft.type}".`);
  }

  return {
    platform: "sleeper",
    draftId: draft.draft_id,
    leagueName: league?.name || draft.metadata?.name || "Sleeper draft",
    status: draft.status,
    rounds,
    teamCount,
    rosterSlots: (league?.roster_positions ?? [])
      .filter((s) => s !== "BN" && s !== "IR" && s !== "TAXI")
      .map((s) => (s.includes("FLEX") ? s : normalizePos(s))),
    teams,
    order,
    picks: normalized,
    onClockPickNo,
    onClockTeamId: onClockPickNo
      ? snakeTeamId(order, onClockPickNo, teamCount, reversal)
      : null,
    updatedAt: Date.now(),
    notes,
  };
}

export function snakeTeamId(
  order: string[],
  pickNo: number,
  teamCount: number,
  reversalRound = 0,
): string | null {
  if (order.length === 0) return null;
  const round = Math.ceil(pickNo / teamCount);
  const idx = (pickNo - 1) % teamCount;
  let reverse = round % 2 === 0;
  if (reversalRound && round >= reversalRound) reverse = !reverse;
  return order[reverse ? teamCount - 1 - idx : idx] ?? null;
}

function extractId(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/(\d{6,})/);
  return m ? m[1] : trimmed;
}
