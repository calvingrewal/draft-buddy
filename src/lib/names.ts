const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export const NFL_TEAMS: Record<string, string> = {
  cardinals: "ARI",
  falcons: "ATL",
  ravens: "BAL",
  bills: "BUF",
  panthers: "CAR",
  bears: "CHI",
  bengals: "CIN",
  browns: "CLE",
  cowboys: "DAL",
  broncos: "DEN",
  lions: "DET",
  packers: "GB",
  texans: "HOU",
  colts: "IND",
  jaguars: "JAX",
  chiefs: "KC",
  raiders: "LV",
  chargers: "LAC",
  rams: "LAR",
  dolphins: "MIA",
  vikings: "MIN",
  patriots: "NE",
  saints: "NO",
  giants: "NYG",
  jets: "NYJ",
  eagles: "PHI",
  steelers: "PIT",
  seahawks: "SEA",
  "49ers": "SF",
  buccaneers: "TB",
  titans: "TEN",
  commanders: "WAS",
};

export const TEAM_ALIASES: Record<string, string> = {
  JAC: "JAX",
  WSH: "WAS",
  LA: "LAR",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
  ARZ: "ARI",
  BLT: "BAL",
  CLV: "CLE",
  HST: "HOU",
};

export const TEAM_ABBREVIATIONS = new Set<string>([
  ...Object.values(NFL_TEAMS),
  ...Object.keys(TEAM_ALIASES),
]);

export const POSITION_TOKENS = /^(QB|RB|WR|TE|K|PK|DST|D\/ST|DEF|DL|LB|DB|IDP|FLEX)\d*$/i;

export function normalizeTeam(team: string | null | undefined): string | null {
  if (!team) return null;
  const t = team.trim().toUpperCase();
  if (!t || t === "FA" || t === "NONE") return null;
  return TEAM_ALIASES[t] ?? t;
}

/** Normalizes a position to one of QB/RB/WR/TE/K/DST, or the upper-cased input. */
export function normalizePos(pos: string | null | undefined): string {
  if (!pos) return "";
  const p = pos.trim().toUpperCase().replace(/[^A-Z/]/g, "");
  if (p === "PK" || p === "K") return "K";
  if (p === "DST" || p === "D/ST" || p === "DEF" || p === "DEFENSE") return "DST";
  if (p.startsWith("WR")) return "WR";
  if (p.startsWith("RB")) return "RB";
  if (p.startsWith("TE")) return "TE";
  if (p.startsWith("QB")) return "QB";
  return p;
}

export function normalizeName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'`’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const parts = base.split(" ").filter((p) => p && !SUFFIXES.has(p));
  return parts.join(" ");
}

/**
 * Canonical key used to match players across rankings and platform data.
 * Team defenses collapse to `dst:<TEAM>` so "Ravens D/ST" and "BAL DEF" agree.
 */
export function playerKey(
  name: string,
  pos?: string | null,
  team?: string | null,
): string {
  const p = normalizePos(pos);
  const n = normalizeName(name);
  if (p === "DST" || looksLikeDefense(name)) {
    const abbr = defenseTeam(name, team);
    if (abbr) return `dst:${abbr}`;
    return `dst:${n}`;
  }
  return n;
}

function looksLikeDefense(name: string): boolean {
  const n = normalizeName(name);
  if (/\b(dst|def|defense)\b/.test(n)) return true;
  return n.split(" ").some((w) => w in NFL_TEAMS);
}

function defenseTeam(name: string, team?: string | null): string | null {
  const t = normalizeTeam(team);
  if (t) return t;
  const words = normalizeName(name).split(" ");
  for (const w of words) {
    if (w in NFL_TEAMS) return NFL_TEAMS[w];
  }
  const upper = (name || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (upper.length <= 3) return normalizeTeam(upper);
  return null;
}
