import type {
  LeagueRoster,
  WaiverAvailability,
  WaiverPlayer,
  WaiverSuggestion,
} from "./types";

/**
 * Joins the expert suggestion list with each league's rosters. A suggestion with no owner in a
 * league is addable there; players already on your own roster are flagged so they can be hidden.
 */
export function joinWaivers(
  suggestions: WaiverSuggestion[],
  rosters: LeagueRoster[],
): WaiverPlayer[] {
  return suggestions.map((s) => ({
    ...s,
    leagues: rosters.map((roster): WaiverAvailability => {
      const ownerTeamId = roster.ownerByKey[s.key] ?? null;
      return {
        platform: roster.platform,
        leagueName: roster.leagueName,
        ownerTeamId,
        ownerTeamName:
          ownerTeamId ? (roster.teams.find((t) => t.id === ownerTeamId)?.name ?? `Team ${ownerTeamId}`) : null,
        mine: Boolean(ownerTeamId) && ownerTeamId === roster.myTeamId,
      };
    }),
  }));
}

export function isAvailableSomewhere(player: WaiverPlayer): boolean {
  return player.leagues.some((l) => !l.ownerTeamId);
}
