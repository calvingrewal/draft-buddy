import { NextResponse } from "next/server";
import { fetchCbsWaivers } from "@/lib/cbs";
import { getEspnRostered } from "@/lib/espn";
import { getNflWeek } from "@/lib/nflWeek";
import { getSleeperRostered } from "@/lib/sleeper";
import type { LeagueRoster, WaiverReport } from "@/lib/types";
import { joinWaivers } from "@/lib/waivers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const espnId = url.searchParams.get("espnId") ?? process.env.DEFAULT_ESPN_LEAGUE_ID ?? "";
  const espnTeamId = url.searchParams.get("espnTeamId") ?? process.env.DEFAULT_ESPN_TEAM_ID ?? "";
  const sleeperId =
    url.searchParams.get("sleeperId") ?? process.env.DEFAULT_SLEEPER_LEAGUE_ID ?? "";
  const sleeperTeamId = url.searchParams.get("sleeperTeamId") ?? "";
  const weekParam = Number(url.searchParams.get("week"));
  const articleUrl = url.searchParams.get("url") ?? undefined;

  try {
    const detected = await getNflWeek().catch(() => null);
    const week = Number.isFinite(weekParam) && weekParam > 0 ? weekParam : (detected?.week ?? 1);
    const season =
      url.searchParams.get("season") ||
      detected?.season ||
      process.env.DEFAULT_SEASON ||
      String(new Date().getFullYear());

    const [waivers, espn, sleeper] = await Promise.all([
      fetchCbsWaivers(week, articleUrl),
      espnId
        ? getEspnRostered(espnId, season, espnTeamId || undefined).then(
            (r) => ({ roster: r, error: null }),
            (e: unknown) => ({ roster: null, error: message(e) }),
          )
        : Promise.resolve({ roster: null, error: null }),
      sleeperId
        ? getSleeperRostered(sleeperId, sleeperTeamId || undefined).then(
            (r) => ({ roster: r, error: null }),
            (e: unknown) => ({ roster: null, error: message(e) }),
          )
        : Promise.resolve({ roster: null, error: null }),
    ]);

    const rosters: LeagueRoster[] = [espn.roster, sleeper.roster].filter(
      (r): r is LeagueRoster => r !== null,
    );
    const report: WaiverReport = {
      source: waivers.source,
      season,
      players: joinWaivers(waivers.suggestions, rosters),
      leagues: [
        ...(espnId
          ? [
              {
                platform: "espn" as const,
                leagueName: espn.roster?.leagueName ?? `ESPN ${espnId}`,
                error: espn.error,
              },
            ]
          : []),
        ...(sleeperId
          ? [
              {
                platform: "sleeper" as const,
                leagueName: sleeper.roster?.leagueName ?? `Sleeper ${sleeperId}`,
                error: sleeper.error,
              },
            ]
          : []),
      ],
      updatedAt: Date.now(),
    };
    return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: message(err) }, { status: 502 });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}
