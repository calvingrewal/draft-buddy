import { normalizeTeam, playerKey } from "./names";
import type { RankedPlayer, ScoringFormat } from "./types";

const PAGES: Record<ScoringFormat, string> = {
  std: "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
  half: "https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php",
  ppr: "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface FpPlayer {
  player_name?: string;
  player_team_id?: string;
  player_position_id?: string;
  player_bye_week?: string;
  rank_ecr?: number;
  tier?: number;
  pos_rank?: string;
}

interface FpEcrData {
  scoring?: string;
  year?: string;
  last_updated?: string;
  players?: FpPlayer[];
}

export interface FantasyProsResult {
  players: RankedPlayer[];
  scoring: ScoringFormat;
  updated: string | null;
}

/** The cheatsheet pages embed their consensus rankings as `var ecrData = {...};`. */
function extractEcrData(html: string): FpEcrData {
  const start = html.indexOf("var ecrData");
  if (start === -1) throw new Error("FantasyPros page did not contain ranking data");
  const open = html.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    const c = html[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(open, i + 1)) as FpEcrData;
    }
  }
  throw new Error("FantasyPros ranking data was truncated");
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

export async function fetchFantasyPros(scoring: ScoringFormat): Promise<FantasyProsResult> {
  const res = await fetch(PAGES[scoring], {
    headers: { "user-agent": UA, accept: "text/html" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FantasyPros request failed: HTTP ${res.status}`);
  const data = extractEcrData(await res.text());

  const seen = new Set<string>();
  const players: RankedPlayer[] = [];
  for (const p of data.players ?? []) {
    const name = (p.player_name ?? "").trim();
    if (!name) continue;
    const pos = (p.player_position_id ?? "").trim().toUpperCase();
    const team = normalizeTeam(p.player_team_id ?? null);
    const key = playerKey(name, pos, team);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    players.push({
      rank: num(p.rank_ecr) ?? players.length + 1,
      name,
      pos,
      team,
      tier: num(p.tier),
      bye: num(p.player_bye_week),
      adp: null,
      notes: p.pos_rank ?? null,
      key,
    });
  }
  if (players.length === 0) throw new Error("FantasyPros returned no players");
  players.sort((a, b) => a.rank - b.rank);
  return {
    players: players.map((p, i) => ({ ...p, rank: i + 1 })),
    scoring,
    updated: data.last_updated ?? null,
  };
}
