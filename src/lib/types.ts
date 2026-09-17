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

export interface WaiverSource {
  url: string;
  title: string;
  week: number;
}

export interface WaiverSuggestion {
  /** priority order within the source column */
  rank: number;
  name: string;
  pos: string;
  team: string | null;
  /** percent of CBS leagues the player is rostered in, when published */
  rosteredPct: number | null;
  key: string;
}

/** Who currently holds every rostered player in one league. */
export interface LeagueRoster {
  platform: Platform;
  leagueId: string;
  leagueName: string;
  myTeamId: string | null;
  /** player key -> team id holding the player */
  ownerByKey: Record<string, string>;
  teams: DraftTeam[];
}

export interface WaiverAvailability {
  platform: Platform;
  leagueName: string;
  /** null when nobody holds the player: free agent or on waivers */
  ownerTeamId: string | null;
  ownerTeamName: string | null;
  mine: boolean;
}

export interface WaiverPlayer extends WaiverSuggestion {
  leagues: WaiverAvailability[];
}

export interface WaiverReport {
  source: WaiverSource;
  season: string;
  players: WaiverPlayer[];
  leagues: Array<{ platform: Platform; leagueName: string; error: string | null }>;
  updatedAt: number;
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
