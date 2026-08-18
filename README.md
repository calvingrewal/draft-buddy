# Draft Buddy

Phone-first draft board for fantasy football. It keeps your imported rankings on screen, crosses
off players as they get drafted (live from ESPN or Sleeper), and shows your roster, the other
rosters, and how many picks until you're on the clock.

## How it works

- **Rankings** come from one tap on "Load FantasyPros rankings" in Setup, which pulls the current
  consensus (ECR) cheatsheet for the league's scoring format; pasting or uploading a CSV/TSV or a
  plain ranked list still works. Either way they are stored in the browser — no account, no database.
- **Scoring format** is read from league settings (ESPN's receptions scoring item, Sleeper's
  `scoring_settings.rec`) and buckets into Standard / Half PPR / Full PPR, which decides which
  cheatsheet gets loaded. Setup has a manual override if a league reports something odd.
- **Picks** come from a server route that polls the platform: Sleeper's public draft API, and
  ESPN's private `lm-api-reads.fantasy.espn.com` v3 API using your league cookies.
- **Matching** is by normalized name (suffixes, punctuation and team-defense naming are handled),
  so rankings from any site line up with platform picks.
- **Manual cross-off** is always available: tap a player, say who took him. This is the fallback if
  a platform feed stalls, and manual picks feed the roster views too.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ESPN_S2`, `ESPN_SWID` | for ESPN | League cookies from a logged-in ESPN session; needed for private leagues |
| `DEFAULT_SEASON` | no | Season used by the ESPN API (default `2026`) |
| `DEFAULT_ESPN_LEAGUE_ID`, `DEFAULT_ESPN_TEAM_ID` | no | Prefills the ESPN draft on first load |
| `DEFAULT_SLEEPER_LEAGUE_ID`, `DEFAULT_SLEEPER_SLOT` | no | Prefills the Sleeper draft on first load |

To get the ESPN cookies: log in at `fantasy.espn.com` on a desktop browser, then DevTools →
Application → Cookies → `espn.com` → copy `espn_s2` and `SWID` (keep the braces on `SWID`).

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest (name matching, rankings parsing, snake order, needs)
```

## Layout

- `src/lib/sleeper.ts`, `src/lib/espn.ts` — platform adapters that normalize into `DraftState`
- `src/lib/derive.ts` — drafted index, board, rosters, roster needs, pick clock
- `src/lib/rankings.ts`, `src/lib/names.ts` — rankings import and cross-source player matching
- `src/lib/fantasypros.ts`, `src/app/api/rankings/route.ts` — consensus cheatsheet fetch/parse
- `src/lib/scoring.ts` — points-per-reception → Standard / Half PPR / Full PPR
- `src/app/api/draft/route.ts` — polled snapshot endpoint
- `src/components/*` — Board / My team / Teams / Log / Setup tabs

`docs/platform-notes.md` records what was verified against each platform's API, including ESPN's
live draft-room transport.
