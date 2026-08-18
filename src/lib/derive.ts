import { playerKey } from "./names";
import { snakeTeamId } from "./sleeper";
import type { DraftPick, DraftState, RankedPlayer } from "./types";

export interface DraftedEntry {
  teamId: string | null;
  pickNo: number | null;
  manual: boolean;
  name: string;
  pos: string;
  team: string | null;
}

/** Every player known to be off the board, from live picks plus manual cross-offs. */
export function buildDraftedIndex(
  state: DraftState | null,
  manualDrafted: Record<string, string>,
  rankings: RankedPlayer[],
): Map<string, DraftedEntry> {
  const index = new Map<string, DraftedEntry>();
  for (const pick of state?.picks ?? []) {
    if (!pick.player) continue;
    const key = playerKey(pick.player.name, pick.player.pos, pick.player.team);
    index.set(key, {
      teamId: pick.teamId,
      pickNo: pick.pickNo,
      manual: false,
      name: pick.player.name,
      pos: pick.player.pos,
      team: pick.player.team,
    });
  }
  const rankByKey = new Map(rankings.map((r) => [r.key, r]));
  for (const [key, teamId] of Object.entries(manualDrafted)) {
    if (index.has(key)) continue;
    const ranked = rankByKey.get(key);
    index.set(key, {
      teamId: teamId || null,
      pickNo: null,
      manual: true,
      name: ranked?.name ?? key,
      pos: ranked?.pos ?? "",
      team: ranked?.team ?? null,
    });
  }
  return index;
}

export interface BoardRow extends RankedPlayer {
  drafted: DraftedEntry | null;
}

export function buildBoard(
  rankings: RankedPlayer[],
  drafted: Map<string, DraftedEntry>,
  opts: { pos: string; query: string; hideDrafted: boolean },
): BoardRow[] {
  const q = opts.query.trim().toLowerCase();
  const rows: BoardRow[] = [];
  for (const player of rankings) {
    const entry = drafted.get(player.key) ?? null;
    if (entry && opts.hideDrafted) continue;
    if (opts.pos !== "ALL" && player.pos !== opts.pos) continue;
    if (q && !player.name.toLowerCase().includes(q)) continue;
    rows.push({ ...player, drafted: entry });
  }
  return rows;
}

/** Picks not in the rankings file (rookies, kickers, defenses you didn't import). */
export function unrankedPicks(
  state: DraftState | null,
  rankings: RankedPlayer[],
): DraftPick[] {
  const known = new Set(rankings.map((r) => r.key));
  return (state?.picks ?? []).filter(
    (p) => p.player && !known.has(playerKey(p.player.name, p.player.pos, p.player.team)),
  );
}

export function picksForTeam(state: DraftState | null, teamId: string): DraftPick[] {
  return (state?.picks ?? []).filter((p) => p.teamId === teamId && p.player);
}

/** Rosters built from live picks and manual cross-offs, keyed by team id. */
export function rostersByTeam(
  drafted: Map<string, DraftedEntry>,
): Map<string, DraftedEntry[]> {
  const rosters = new Map<string, DraftedEntry[]>();
  for (const entry of drafted.values()) {
    if (!entry.teamId) continue;
    const list = rosters.get(entry.teamId) ?? [];
    list.push(entry);
    rosters.set(entry.teamId, list);
  }
  for (const list of rosters.values()) {
    list.sort((a, b) => (a.pickNo ?? Infinity) - (b.pickNo ?? Infinity));
  }
  return rosters;
}

export function needsFromEntries(
  rosterSlots: string[],
  entries: DraftedEntry[],
): string[] {
  return remainingNeeds(
    rosterSlots,
    entries.map((e) => ({
      pickNo: e.pickNo ?? 0,
      round: 0,
      roundPick: 0,
      teamId: e.teamId ?? "",
      player: { id: e.name, name: e.name, pos: e.pos, team: e.team },
    })),
  );
}

/** Remaining starting slots for a roster, e.g. ["WR", "TE", "FLEX"]. */
export function remainingNeeds(rosterSlots: string[], picks: DraftPick[]): string[] {
  const counts = new Map<string, number>();
  for (const pick of picks) {
    const pos = pick.player?.pos;
    if (!pos) continue;
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }
  const flexEligible = new Set(["RB", "WR", "TE"]);
  const needs: string[] = [];
  const flexSlots: string[] = [];
  for (const slot of rosterSlots) {
    if (slot === "FLEX" || slot === "SUPER_FLEX" || slot === "REC_FLEX") {
      flexSlots.push(slot);
      continue;
    }
    const have = counts.get(slot) ?? 0;
    if (have > 0) counts.set(slot, have - 1);
    else needs.push(slot);
  }
  const leftover = [...counts.entries()]
    .filter(([pos, n]) => n > 0 && flexEligible.has(pos))
    .reduce((sum, [, n]) => sum + n, 0);
  for (let i = 0; i < flexSlots.length; i++) {
    if (i >= leftover) needs.push(flexSlots[i]);
  }
  return needs;
}

export interface PickClock {
  currentPickNo: number | null;
  onClockTeamId: string | null;
  myNextPickNo: number | null;
  picksUntilMe: number | null;
  myUpcoming: number[];
}

export function pickClock(state: DraftState | null, myTeamId: string): PickClock {
  if (!state || !myTeamId) {
    return {
      currentPickNo: state?.onClockPickNo ?? null,
      onClockTeamId: state?.onClockTeamId ?? null,
      myNextPickNo: null,
      picksUntilMe: null,
      myUpcoming: [],
    };
  }
  const current = state.onClockPickNo;
  const total = state.rounds * state.teamCount;
  const mine: number[] = [];
  for (let pickNo = current ?? total + 1; pickNo <= total; pickNo++) {
    const board = state.picks.find((p) => p.pickNo === pickNo);
    const teamId = board?.teamId ?? snakeTeamId(state.order, pickNo, state.teamCount);
    if (teamId === myTeamId) mine.push(pickNo);
    if (mine.length >= 4) break;
  }
  return {
    currentPickNo: current,
    onClockTeamId: state.onClockTeamId,
    myNextPickNo: mine[0] ?? null,
    picksUntilMe: mine[0] != null && current != null ? mine[0] - current : null,
    myUpcoming: mine,
  };
}

export function teamName(state: DraftState | null, teamId: string | null): string {
  if (!teamId) return "—";
  return state?.teams.find((t) => t.id === teamId)?.name ?? `Team ${teamId}`;
}
