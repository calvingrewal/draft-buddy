export type Platform = "sleeper" | "espn";

export interface PlayerRef {
  id: string;
  name: string;
  pos: string;
  team: string | null;
}

export interface DraftPick {
  pickNo: number;
  round: number;
  roundPick: number;
  teamId: string;
  player: PlayerRef | null;
}

export interface DraftTeam {
  id: string;
  name: string;
  slot: number | null;
}

/** "std" = 0 PPR, "half" = 0.5, "ppr" = 1 point per reception. */
export type ScoringFormat = "std" | "half" | "ppr";

export interface LeagueScoring {
  format: ScoringFormat;
  pointsPerReception: number;
  /** true when the platform reported points per reception, false when we guessed */
  detected: boolean;
}

export interface LiveFeedState {
  status: string;
  /** picks the stream supplied that the polled board was still missing */
  filledPicks: number;
  error: string | null;
}

export interface DraftState {
  platform: Platform;
  draftId: string;
  leagueName: string;
  status: string;
  rounds: number;
  teamCount: number;
  rosterSlots: string[];
  teams: DraftTeam[];
  /** team ids in first-round pick order */
  order: string[];
  picks: DraftPick[];
  onClockPickNo: number | null;
  onClockTeamId: string | null;
  scoring: LeagueScoring;
  /** ESPN only: state of the draft-room stream that backs up v3 polling */
  liveFeed?: LiveFeedState;
  updatedAt: number;
  notes?: string[];
}

export interface RankedPlayer {
  rank: number;
  name: string;
  pos: string;
  team: string | null;
  tier: number | null;
  bye: number | null;
  adp: number | null;
  notes: string | null;
  key: string;
}
