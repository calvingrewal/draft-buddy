import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Server-side defaults so a phone never has to type league ids. */
export async function GET() {
  return NextResponse.json(
    {
      season: process.env.DEFAULT_SEASON || "2026",
      espnLeagueId: process.env.DEFAULT_ESPN_LEAGUE_ID || "",
      espnTeamId: process.env.DEFAULT_ESPN_TEAM_ID || "",
      sleeperLeagueId: process.env.DEFAULT_SLEEPER_LEAGUE_ID || "",
      sleeperTeamSlot: process.env.DEFAULT_SLEEPER_SLOT || "",
      espnConfigured: Boolean(process.env.ESPN_S2 && process.env.ESPN_SWID),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
