import type { LeagueScoring, ScoringFormat } from "./types";

export const SCORING_LABELS: Record<ScoringFormat, string> = {
  std: "Standard",
  half: "Half PPR",
  ppr: "Full PPR",
};

/** Buckets points-per-reception into the three formats rankings are published in. */
export function scoringFromPpr(pointsPerReception: number, detected: boolean): LeagueScoring {
  const ppr = Number.isFinite(pointsPerReception) ? pointsPerReception : 0;
  const format: ScoringFormat = ppr >= 0.75 ? "ppr" : ppr >= 0.25 ? "half" : "std";
  return { format, pointsPerReception: ppr, detected };
}

export function defaultScoring(): LeagueScoring {
  return { format: "half", pointsPerReception: 0.5, detected: false };
}
