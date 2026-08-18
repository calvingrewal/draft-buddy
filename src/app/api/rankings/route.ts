import { NextResponse } from "next/server";
import { fetchFantasyPros } from "@/lib/fantasypros";
import type { ScoringFormat } from "@/lib/types";

export const dynamic = "force-dynamic";

const FORMATS: ScoringFormat[] = ["std", "half", "ppr"];

/** GET /api/rankings?scoring=std|half|ppr — FantasyPros consensus (ECR) rankings. */
export async function GET(request: Request) {
  const scoring = new URL(request.url).searchParams.get("scoring") ?? "half";
  if (!FORMATS.includes(scoring as ScoringFormat)) {
    return NextResponse.json({ error: `Unknown scoring "${scoring}"` }, { status: 400 });
  }
  try {
    const result = await fetchFantasyPros(scoring as ScoringFormat);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "FantasyPros import failed" },
      { status: 502 },
    );
  }
}
