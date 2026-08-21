import {
  POSITION_TOKENS,
  TEAM_ABBREVIATIONS,
  looksLikeDefense,
  normalizePos,
  normalizeTeam,
  playerKey,
} from "./names";
import type { RankedPlayer } from "./types";

export interface ParseResult {
  players: RankedPlayer[];
  warnings: string[];
}

function splitRow(row: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (quoted) {
      if (c === '"') {
        if (row[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim().replace(/^"|"$/g, ""));
}

const FIELD_MATCHERS: Array<[keyof ColumnMap, RegExp]> = [
  ["rank", /^(rk|rank|overall rank|ovr|#)$/],
  ["tier", /^(tier|tiers)$/],
  ["name", /^(player|player name|name|players)$/],
  ["team", /^(team|tm|nfl team)$/],
  ["pos", /^(pos|position|pos rank|player position)$/],
  ["bye", /^(bye|bye week|bye wk)$/],
  ["adp", /^(adp|avg pick|average pick|ecr vs adp|ecr vs\. adp)$/],
  ["notes", /^(notes|note|comment|comments)$/],
];

interface ColumnMap {
  rank?: number;
  tier?: number;
  name?: number;
  team?: number;
  pos?: number;
  bye?: number;
  adp?: number;
  notes?: number;
}

function mapHeader(cells: string[]): ColumnMap | null {
  const map: ColumnMap = {};
  cells.forEach((raw, idx) => {
    const cell = raw.toLowerCase().replace(/\s+/g, " ").trim();
    for (const [field, re] of FIELD_MATCHERS) {
      if (map[field] === undefined && re.test(cell)) {
        map[field] = idx;
        return;
      }
    }
  });
  return map.name !== undefined ? map : null;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.replace(/[+,]/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** "RB4" -> { pos: "RB" }; "WR" -> { pos: "WR" } */
function parsePos(v: string | undefined): string {
  if (!v) return "";
  return normalizePos(v.replace(/\d+/g, ""));
}

interface PlainRow {
  rank: number | null;
  name: string;
  pos: string;
  team: string | null;
}

/**
 * Handles lines like "1. Ja'Marr Chase WR CIN", "Bijan Robinson, RB, ATL",
 * "12 Jonathan Taylor (IND - RB)" or a bare name.
 */
function parsePlainLine(line: string): PlainRow | null {
  const cleaned = line
    .replace(/[()\[\]]/g, " ")
    .replace(/\bD\s*\/\s*ST\b/gi, "DST")
    .replace(/\s*[|/–—]\s*/g, " ");
  const rankMatch = cleaned.match(/^\s*(\d{1,3})\s*[.)\-:]?\s+/);
  const rank = rankMatch ? Number(rankMatch[1]) : null;
  const rest = rankMatch ? cleaned.slice(rankMatch[0].length) : cleaned;
  const tokens = rest
    .split(/[,\s]+/)
    .map((t) => t.replace(/[-–—:]+$/, "").trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  let pos = "";
  let team: string | null = null;
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (!pos && POSITION_TOKENS.test(last)) {
      pos = normalizePos(last.replace(/\d+/g, ""));
      tokens.pop();
      continue;
    }
    if (!team && TEAM_ABBREVIATIONS.has(last.toUpperCase())) {
      team = normalizeTeam(last);
      tokens.pop();
      continue;
    }
    break;
  }
  const name = tokens.join(" ").trim();
  if (!name) return null;
  if (!pos && looksLikeDefense(name)) pos = "DST";
  return { rank, name, pos, team };
}

/** Parses FantasyPros-style CSV/TSV exports, or a plain ranked list of names. */
export function parseRankings(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { players: [], warnings: ["No rows found."] };

  const commas = (lines[0].match(/,/g) || []).length;
  const tabs = (lines[0].match(/\t/g) || []).length;
  const delim = tabs > commas ? "\t" : ",";
  const structured = Math.max(commas, tabs) >= 2;

  const players: RankedPlayer[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  const push = (p: Omit<RankedPlayer, "key">) => {
    const key = playerKey(p.name, p.pos, p.team);
    if (!key) return;
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    players.push({ ...p, key });
  };
  const describeSkipped = (unnamed: number) => {
    if (unnamed > 0) warnings.push(`Skipped ${unnamed} row(s) with no player name.`);
    if (duplicates > 0) warnings.push(`Skipped ${duplicates} duplicate player(s).`);
  };

  if (structured) {
    const header = mapHeader(splitRow(lines[0], delim));
    if (!header) {
      warnings.push(
        "Could not find a player-name column in the header row; parsed rows as plain names instead.",
      );
    } else {
      let unnamed = 0;
      lines.slice(1).forEach((line, i) => {
        const cells = splitRow(line, delim);
        const name = (header.name !== undefined ? cells[header.name] : "") || "";
        if (!name) {
          unnamed++;
          return;
        }
        push({
          rank: num(header.rank !== undefined ? cells[header.rank] : "") ?? i + 1,
          name,
          pos: parsePos(header.pos !== undefined ? cells[header.pos] : ""),
          team: normalizeTeam(header.team !== undefined ? cells[header.team] : null),
          tier: num(header.tier !== undefined ? cells[header.tier] : ""),
          bye: num(header.bye !== undefined ? cells[header.bye] : ""),
          adp: num(header.adp !== undefined ? cells[header.adp] : ""),
          notes: (header.notes !== undefined ? cells[header.notes] : "") || null,
        });
      });
      if (players.length > 0) {
        players.sort((a, b) => a.rank - b.rank);
        describeSkipped(unnamed);
        return { players: renumber(players), warnings };
      }
      warnings.push("Header looked structured but no player rows parsed.");
    }
  }

  lines.forEach((line, i) => {
    const row = parsePlainLine(line);
    if (!row) return;
    if (/^(rk|rank|player|tier)\b/i.test(row.name)) return;
    push({
      rank: row.rank ?? i + 1,
      name: row.name,
      pos: row.pos,
      team: row.team,
      tier: null,
      bye: null,
      adp: null,
      notes: null,
    });
  });
  players.sort((a, b) => a.rank - b.rank);
  describeSkipped(0);
  return { players: renumber(players), warnings };
}

function renumber(players: RankedPlayer[]): RankedPlayer[] {
  return players.map((p, i) => ({ ...p, rank: i + 1 }));
}
