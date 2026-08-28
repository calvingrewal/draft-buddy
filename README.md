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
- **ESPN live picks** additionally come from the draft room itself: the server joins ESPN's draft
  service (`fantasydraft.espn.com`) as your team and merges every `SELECTED` event into the polled
  board, because ESPN's v3 board may not update mid-draft. The room only exists while a draft is
  live, so before then the header just reports "Live draft room: not open yet" and retries. This
  needs `DEFAULT_ESPN_TEAM_ID` or your team id in Setup.
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

## Deploying to Vercel

The app is a stock Next.js App Router project, so no Vercel config is needed:

1. Push to GitHub (already done), then at [vercel.com/new](https://vercel.com/new) import
   `calvingrewal/draft-buddy`. Framework detection, build command and output are all automatic.
2. Before the first deploy, add the environment variables from the table above under
   **Settings → Environment Variables** (Production + Preview): `ESPN_S2`, `ESPN_SWID`,
   `DEFAULT_SEASON`, `DEFAULT_ESPN_LEAGUE_ID`, `DEFAULT_ESPN_TEAM_ID`,
   `DEFAULT_SLEEPER_LEAGUE_ID`, `DEFAULT_SLEEPER_SLOT`. They stay server-side; nothing is
   `NEXT_PUBLIC_`. Changing them later needs a redeploy to take effect.
3. Deploy, open the URL on your phone, and "Add to Home Screen" so it runs full-screen as a PWA.

Or from a terminal: `npx vercel@latest` (link the project), `npx vercel env add ESPN_S2` (repeat per
variable), then `npx vercel --prod`.

Caveat for ESPN's live feed: Vercel's serverless functions are frozen between requests, so the
draft-room stream lives only as long as the function instance that opened it. Polling every few
seconds while the app is open on your phone keeps an instance warm, and the v3 poll plus manual
cross-off cover any gap — but an always-on host (Fly.io, Render, Railway, `npm run build && npm
start` anywhere) keeps that stream connected for the whole draft.

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
- `src/lib/espnLive.ts` — ESPN draft-room stream that fills picks the v3 board is missing
- `src/app/api/draft/route.ts` — polled snapshot endpoint
- `src/components/*` — Board / My team / Teams / Log / Setup tabs

`docs/platform-notes.md` records what was verified against each platform's API, including ESPN's
live draft-room transport.
