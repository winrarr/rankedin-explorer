# Rankedin API

## Authoritative contract

The [Rankedin Swagger document](https://api.rankedin.com/swagger/v1/swagger.json) is the authoritative API schema. This file is a maintained summary of the read paths currently used by the app, not a replacement for the Swagger document.

The browser client uses the public base URL `https://api.rankedin.com/v1`. API access is cross-origin from the deployed GitHub Pages site today, but that is an external fact that Rankedin can change.

## Read paths used by the app

- `GET /Player/PlayerProfileInfoAsync?rankedinId=...&language=en` resolves a public `R...` profile ID to the numeric player ID used by event and result endpoints.
- The same profile response exposes current-year and career doubles records; the pair history displays those normalized win-loss values without fetching every career match.
- `GET /Search/GetPlayersByNameSimpleAsync?name=...&take=...&skip=...` returns compact public player search results with the numeric ID, display name and `R...` identifier.
- Lunar League discovery reuses that public player search, then reads the player’s participated events (`Type === 3`) and resolves the latest league/team through `GET /TeamLeague/GetTeamLeagueTeamDetailsAsync?teamLeagueId=...&participantId=...&language=en`; this avoids requiring users to discover a league ID elsewhere.
- `GET /Search/GetTournamentsAsync?term=...&language=en&take=...&skip=...` returns public tournament suggestions with the event URL, name, date and sport.
- `GET /Search/GetTeamLeaguesAsync?term=...&language=en&take=...&skip=...` returns public team league suggestions with the league URL, name, date and sport.
- `GET /Player/ParticipatedEventsAsync?PlayerId=...&Language=en&Skip=...&Take=...` returns a player's participated events. The app currently keeps finished tournament events (`State === 4` and `Type === 4`).
- The tournament field view can reuse that participated-event response to select each player's newest Lunar League event (`Type === 3`) and then resolve only its `divisionName` through the team-detail endpoint. Older seasons, standings and placement are intentionally excluded from this summary.
- `GET /TeamLeague/GetHeaderAsync?id=...&language=en` and `GET /TeamLeague/GetTeamLeagueTeamDetailsAsync?teamLeagueId=...&participantId=...&language=en` resolve a player's Lunar League season and team without scanning every league pool.
- `GET /TeamLeague/GetInfoAsync?id=...&language=en` returns league-level totals, organization metadata and pool statistics. `GET /TeamLeague/GetPoolsInfoAsync?id=...` returns the public pool list for direct Lunar League exploration.
- `GET /TeamLeague/GetPoolTeamsAsync?poolId=...&language=en`, `GET /TeamLeague/GetTeamStandingsAsync?poolId=...&language=en` and `GET /TeamLeague/GetMatchesForPoolAsync?poolId=...&language=en` provide the teams, aggregate standings and fixtures for a selected pool.
- `GET /TeamLeague/GetTeamLeagueTeamHomepageAsync?TeamId=...&Language=en` resolves the team's pool, while `GET /TeamLeague/GetTeamStandingsAsync?poolId=...&language=en` returns the current/final team standing and `GET /TeamLeague/GetTeamMatchesAsync?teamId=...&language=en` returns the season fixtures.
- `GET /TeamLeague/GetMatchesForPoolAsync?poolId=...&language=en` returns every completed fixture in the pool, and `GET /TeamLeague/TeamLeagueTeamMatchStandingsAsync?teamMatchId=...&language=en` returns the aggregate contribution of both teams for one fixture. `GET /TeamLeague/GetStandingsRulesSettingsAsync?teamLeagueId=...&sport=...&language=en` returns the ordering rules used by the league table.
- `GET /TeamLeague/GetTeamLeagueTeamsMatchesAsync?teamMatchId=...&language=en` returns the individual doubles inside a team fixture. The app filters those matches by the selected player's numeric ID.
- `GET /Tournament/GetheaderAsync?id=...&language=en` returns tournament metadata.
- `GET /Tournament/GetStandingsAsync?id=...` returns the classes and ranking systems attached to an event.
- `GET /Tournament/GetPlayersForClassAsync?tournamentId=...&tournamentClassId=...&language=en` returns the pairs in a class.
- `GET /Tournament/GetResultsAsync?tournamentId=...&classId=...&rankingId=...&language=en` returns the class result rows used to identify a player's class, standing, field size and rating values.
- `GET /Tournament/GetClassesAndDrawNamesAsync?tournamentId=...` and `GET /Tournament/GetMatchesSectionAsync?...` provide draw and match data for exploratory detail.
- Match sides include numeric `Player1Id` and `Player2Id` values. The normalized match record retains those opponent IDs so the selected-pair preparation context can check up to five recent event histories and intersect opponents with the current class roster without fetching history for every participant.
- `GET /Player/GetLastEventsPlayedAsync?...` and `GET /Player/GetPlayerMatchesAsync?...` expose convenient recent-match/profile data, but neither returns the tournament class, final standing and field size needed for placement analysis. Keep using the event standings/results path for that insight.

The implementation and endpoint-specific raw types live in [`src/lib/rankedin.ts`](../src/lib/rankedin.ts). Keep PascalCase API payloads, URL construction and the mixed-case team-league search/fixture payloads there; UI code should consume normalized domain types.

## Interpretation rules

- A player's public `R...` identifier and the API's numeric `PlayerId` are different identifiers. Resolve the former before requesting event history.
- A participated event is not necessarily a usable placement. The event may be unfinished, cancelled, missing a matching result, or missing class data.
- `GetResultsAsync.Data.length` is the current app's field-size measure. It represents result rows returned for the class and should continue to be treated as source data, not as an independently inferred field size.
- `StandingRangeTo` can represent a tied or ranged placement. Numeric summaries should use the midpoint of `Standing` and `StandingRangeTo`; display should preserve the range.
- Class names are organizer-entered and vary in spelling, case and suffixes such as `FTM`, draw labels and session names. The client normalizes reliable DPF, gender and junior signals for grouping, while keeping unrecognized labels in a separate group and retaining the raw class name for source details. Lunar League is a separate event type and remains outside tournament placement percentages.
- API failures and incomplete records are normal states. Do not turn missing placement, field size or rating into zero.

## Request discipline

Keep requests read-only, bounded and cache-friendly. The API client has small in-memory response, participated-event and event-analysis caches, the validated shared 25-request active limit, bounded retries for transient HTTP/network failures (including `Retry-After` handling), a queue pause after `429`, and layered concurrency limits for field, event, class-probe and league-standing work. Failed event analyses are evicted so a later inspection can retry them. Class-result responses remain coalesced in the shared response cache so multiple players from the same event do not fetch the same class payload twice; an individual player's early-stop signal does not cancel that shared fetch for other consumers. Tournament and Lunar League analysis share one 50-event participated-history request per player. A feature that loads a full player history must page deliberately rather than assuming that the first response contains every event. Long analyses should expose partial results as they arrive.

The concurrency controls only change how work is scheduled; they do not reduce the requested history windows. The current windows are 50 participated events per player, the latest five finished tournament events for Tournament Explorer field form, up to 25 finished tournament events for Player Progress, and up to 10 Lunar League seasons for Player Progress. Pair history uses the user's selected history-depth preference. Field history work is scheduled three players at a time, current League division lookups six players at a time, event analysis four at a time, class probes two at a time and League fixture standings four at a time, all inside the shared 25-request queue.

When a `429` response includes `Retry-After`, the client honors that delay (bounded to its retry limit) and temporarily prevents queued requests from starting; active requests are not cancelled. When `Retry-After` is absent, retry delays use exponential backoff with jitter, roughly 0.5–0.75 seconds, 1–1.25 seconds and 2–2.25 seconds for the first retries. The same fallback timing is used for retryable network failures.

The Swagger document defines no public numeric concurrency or rate-limit value. Its rate-limit health endpoint requires an API key. A bounded live probe on 6 August 2026 returned 200 for bursts up to 25 concurrent requests, while a 30-request burst returned one 429 with `Retry-After: 1` and materially higher tail latency. Treat 25 as an observed ceiling, not a guaranteed Rankedin limit; do not raise it without new evidence.

Historical Lunar League table reconstruction costs one pool-fixture request, one standings-rules request, one final-standing request and one per-fixture standings request for each completed pool fixture. A seven-team pool therefore takes 24 requests per season. The per-fixture standings requests use a separate concurrency limit of four because the endpoint can return `429` under a wider burst; the shared queue still caps all in-flight API work at 25 and pauses new work after throttling before retrying with backoff. The reconstructed final table is checked against `GetTeamStandingsAsync` during live validation; if reconstruction fails, the season card remains available and the chart falls back to its final standing data.

Do not add mutations, authentication, API secrets, a proxy or a database without an explicit product and architecture decision. If CORS or API availability changes, update [`docs/constraints.md`](./constraints.md) and record any consequential architecture change in [`docs/decisions/`](./decisions/).
