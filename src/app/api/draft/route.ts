import { NextResponse } from "next/server";
import { getEspnState } from "@/lib/espn";
import { getSleeperState } from "@/lib/sleeper";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform");
  const id = url.searchParams.get("id");
  const season = url.searchParams.get("season") || process.env.DEFAULT_SEASON || "2026";
  // An explicitly empty teamId means "no team chosen", so it must not fall back to the default.
  const requestedTeamId = url.searchParams.get("teamId");
  const teamId = requestedTeamId ?? process.env.DEFAULT_ESPN_TEAM_ID ?? "";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const state =
      platform === "espn"
        ? await getEspnState(id, season, teamId || undefined)
        : platform === "sleeper"
          ? await getSleeperState(id)
          : null;
    if (!state) {
      return NextResponse.json({ error: `Unknown platform "${platform}"` }, { status: 400 });
    }
    return NextResponse.json(state, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
