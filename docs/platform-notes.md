# Platform notes

What was verified directly against each platform, and what is still unknown.

## Sleeper

Public, unauthenticated, read-only: `https://api.sleeper.app/v1`.

| Endpoint | Use |
| --- | --- |
| `GET /league/{leagueId}` | league name, `draft_id`, `roster_positions`, team count |
| `GET /draft/{draftId}` | rounds, teams, type, `draft_order` (userId → slot), `slot_to_roster_id` |
| `GET /draft/{draftId}/picks` | every pick: `pick_no`, `round`, `draft_slot`, `player_id`, `metadata` |
| `GET /league/{leagueId}/users`, `/rosters` | display names / team names per slot |

Verified: pick objects carry `metadata.first_name/last_name/position/team`, so no 15 MB player
dump is needed for names. Draft picks responses are served through a CDN with a long `s-maxage`,
so requests append a cache-busting query param and send `cache: no-store`.

Teams are keyed by **draft slot** rather than roster id — it is the only identifier present in
every draft type (including mocks, which have no league).

## ESPN

No supported public API. Reads go to `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl`
with `espn_s2` + `SWID` cookies; requests to `fantasy.espn.com` redirect.

| Endpoint | Use |
| --- | --- |
| `/seasons/{season}/segments/0/leagues/{leagueId}?view=mDraftDetail&view=mSettings&view=mTeam` | draft board, picks, teams, pick order, roster slots |
| `/seasons/{season}/players?scoringPeriodId=0&view=players_wl` (with `X-Fantasy-Filter` limit) | id → name/position/pro team; ~11.6k players, cached in memory for 6h |

Verified against the real league: `mDraftDetail.picks` is **pre-populated for every pick of the
draft** with `playerId: -1` placeholders, which gives the full board (round, round pick, team) up
front; `playerId` is filled in as picks are made. `defaultPositionId` maps 1=QB, 2=RB, 3=WR, 4=TE,
5=K, 16=D/ST.

### Scoring format

Both platforms expose points per reception, so the Standard / Half PPR / Full PPR bucket is
detected rather than asked for (with a manual override in Setup as the fallback):

| Platform | Field | Real value |
| --- | --- | --- |
| ESPN | `settings.scoringSettings.scoringItems[]` where `statId === 53` (receptions), `points` (or `pointsOverrides["16"]`) | `0.5` → Half PPR |
| Sleeper | `scoring_settings.rec` | `1.0` → Full PPR |

### Live draft room transport (not used yet)

The 2026 draft-room bundle connects to a dedicated draft service, not the v3 API:

1. `GET .../leagues/{leagueId}/teams/{teamId}/draftSecurity` returns a numeric token (verified 200).
2. The client builds `{fantasyGameId}:{leagueId}:{teamId}:{memberId}:{securityToken}`.
3. It opens `wss://fantasydraft.espn.com/game-{gameId}/league-{leagueId}/JOIN?1=…&8=KONA`,
   falling back to `…/sse/JOIN?…` (EventSource).
4. Messages are space-delimited text: `SELECTED {teamId} {playerId} {slotId}` for a pick,
   `SELECTING {teamId} {timeToPick}`, `CLOCK`, `STATE`, `UNDONE {pickNumber}`, `JOINED`, `CHAT`,
   and `INIT {base64 protobuf}` for the initial snapshot.

Both the socket and SSE endpoints currently answer `HTTP 500 LeagueId was either missing or
invalid` for this league, which is consistent with the draft room only existing once the draft is
live. **Open question:** whether `mDraftDetail` updates during a live ESPN draft (a maintained
draft-room extension polls the v3 API live; the popular Python wrapper claims it only updates
post-draft). Until that is confirmed on a live/mock ESPN draft, manual cross-off is the ESPN
safety net, and the socket transport above is the upgrade path if polling proves stale.

## FantasyPros

The consensus cheatsheet pages (`consensus-cheatsheets.php`, `half-point-ppr-cheatsheets.php`,
`ppr-cheatsheets.php`) embed their whole ranking table as a `var ecrData = {…};` literal, so the
server route brace-matches that object and parses it as JSON — no HTML scraping. Player records
carry `player_name`, `player_team_id`, `player_position_id`, `player_bye_week`, `rank_ecr`,
`pos_rank` and `tier`. Verified live: 498 (STD) / 861 (HALF) / 503 (PPR) players, QB/RB/WR/TE/K/DST.
