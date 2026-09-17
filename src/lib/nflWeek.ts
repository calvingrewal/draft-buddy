export interface NflWeek {
  season: string;
  week: number;
  seasonType: string;
}

/** Sleeper's public state endpoint is the source of truth for "what week is it". */
export async function getNflWeek(): Promise<NflWeek> {
  const res = await fetch(`https://api.sleeper.app/v1/state/nfl?_=${Date.now()}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Sleeper state failed: HTTP ${res.status}`);
  const body = (await res.json()) as {
    season?: string;
    week?: number;
    display_week?: number;
    season_type?: string;
  };
  const week = body.display_week || body.week || 1;
  return {
    season: body.season ?? String(new Date().getFullYear()),
    // Waiver columns are written for the upcoming regular-season week; preseason maps to week 1.
    week: body.season_type === "regular" ? Math.max(1, week) : 1,
    seasonType: body.season_type ?? "regular",
  };
}
