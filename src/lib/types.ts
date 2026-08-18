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
