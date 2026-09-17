import { normalizePos, normalizeTeam, playerKey } from "./names";
import type { WaiverSource, WaiverSuggestion } from "./types";

const HOST = "https://www.cbssports.com";
const NEWS_INDEX = `${HOST}/fantasy/football/news/`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function html(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CBS ${url} failed: HTTP ${res.status}`);
  return res.text();
}

/**
 * CBS publishes a new waiver-wire column each week under a slug that always contains both
 * "waiver-wire" and "week-<n>", so the weekly URL is discovered from the news index
 * instead of being hardcoded.
 */
export async function findCbsWaiverArticle(week: number): Promise<string> {
  const index = await html(NEWS_INDEX);
  const hrefs = [...index.matchAll(/href="(\/fantasy\/football\/news\/[^"]+)"/g)].map(
    (m) => m[1],
  );
  const forWeek = hrefs.filter(
    (h) => h.includes("waiver-wire") && new RegExp(`week-${week}(?!\\d)`).test(h),
  );
  // The columns that lead with the week are the ranked "waiver priority" ones we parse best.
  const best =
    forWeek.find((h) => h.includes(`/week-${week}-fantasy-football-waiver-wire`)) ?? forWeek[0];
  if (!best) {
    throw new Error(
      `No CBS waiver-wire article found for week ${week}; paste the article URL manually.`,
    );
  }
  return `${HOST}${best}`;
}

const CARD = /<div class="PlayerObjectV4-playerName">([\s\S]*?)<\/div>\s*<div class="PlayerObjectV4-playerInfo">([\s\S]*?)<\/div>([\s\S]*?)(?=<div class="PlayerObjectV4-playerName">|$)/g;

function decode(s: string): string {
  return s
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses the ranked player cards out of a CBS waiver-wire column. */
export function parseCbsWaivers(page: string): WaiverSuggestion[] {
  const out: WaiverSuggestion[] = [];
  const seen = new Set<string>();
  for (const m of page.matchAll(CARD)) {
    const [, nameBlock, infoBlock, tail] = m;
    const name = decode(nameBlock.match(/>\s*([^<>]+?)\s*<\/a>/)?.[1] ?? "");
    if (!name) continue;
    const pos = normalizePos(
      nameBlock.match(/playerPosition">\s*([A-Za-z/]+)/)?.[1] ?? "",
    );
    const team = normalizeTeam(infoBlock.match(/--short">\s*([A-Za-z]{2,3})/)?.[1] ?? null);
    const rosteredPct = Number(tail.match(/ROSTERED\s*<\/h6>\s*([0-9]+)\s*%/)?.[1] ?? NaN);
    const key = playerKey(name, pos, team);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rank: out.length + 1,
      name,
      pos,
      team,
      rosteredPct: Number.isFinite(rosteredPct) ? rosteredPct : null,
      key,
    });
  }
  return out;
}

export async function fetchCbsWaivers(
  week: number,
  urlOverride?: string,
): Promise<{ source: WaiverSource; suggestions: WaiverSuggestion[] }> {
  const url = urlOverride?.trim() || (await findCbsWaiverArticle(week));
  const page = await html(url);
  const suggestions = parseCbsWaivers(page);
  if (suggestions.length === 0) {
    throw new Error(`No player cards found in ${url}`);
  }
  const title = decode(page.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "CBS waiver wire").replace(
    / - CBSSports\.com.*$/,
    "",
  );
  return { source: { url, title, week }, suggestions };
}
