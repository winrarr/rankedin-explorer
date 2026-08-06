# Rankedin API

## Authoritative contract

The [Rankedin Swagger document](https://api.rankedin.com/swagger/v1/swagger.json) is the authoritative API schema. This file is a maintained summary of the read paths currently used by the app, not a replacement for the Swagger document.

The browser client uses the public base URL `https://api.rankedin.com/v1`. API access is cross-origin from the deployed GitHub Pages site today, but that is an external fact that Rankedin can change.

## Read paths used by the app

- `GET /Player/PlayerProfileInfoAsync?rankedinId=...&language=en` resolves a public `R...` profile ID to the numeric player ID used by event and result endpoints.
- `GET /Search/GetPlayersByNameSimpleAsync?name=...&take=...&skip=...` returns compact public player search results with the numeric ID, display name and `R...` identifier.
- `GET /Search/GetTournamentsAsync?term=...&language=en&take=...&skip=...` returns public tournament suggestions with the event URL, name, date and sport.
- `GET /Player/ParticipatedEventsAsync?PlayerId=...&Language=en&Skip=...&Take=...` returns a player's participated events. The app currently keeps finished tournament events (`State === 4` and `Type === 4`).
- `GET /TeamLeague/GetHeaderAsync?id=...&language=en` and `GET /TeamLeague/GetTeamLeagueTeamDetailsAsync?teamLeagueId=...&participantId=...&language=en` resolve a player's Lunar League season and team without scanning every league pool.
- `GET /TeamLeague/GetTeamLeagueTeamHomepageAsync?TeamId=...&Language=en` resolves the team's pool, while `GET /TeamLeague/GetTeamStandingsAsync?poolId=...&language=en` returns the current/final team standing and `GET /TeamLeague/GetTeamMatchesAsync?teamId=...&language=en` returns the season fixtures.
- `GET /TeamLeague/GetMatchesForPoolAsync?poolId=...&language=en` returns every completed fixture in the pool, and `GET /TeamLeague/TeamLeagueTeamMatchStandingsAsync?teamMatchId=...&language=en` returns the aggregate contribution of both teams for one fixture. `GET /TeamLeague/GetStandingsRulesSettingsAsync?teamLeagueId=...&sport=...&language=en` returns the ordering rules used by the league table.
- `GET /TeamLeague/GetTeamLeagueTeamsMatchesAsync?teamMatchId=...&language=en` returns the individual doubles inside a team fixture. The app filters those matches by the selected player's numeric ID.
- `GET /Tournament/GetheaderAsync?id=...&language=en` returns tournament metadata.
- `GET /Tournament/GetStandingsAsync?id=...` returns the classes and ranking systems attached to an event.
- `GET /Tournament/GetPlayersForClassAsync?tournamentId=...&tournamentClassId=...&language=en` returns the pairs in a class.
- `GET /Tournament/GetResultsAsync?tournamentId=...&classId=...&rankingId=...&language=en` returns the class result rows used to identify a player's class, standing, field size and rating values.
- `GET /Tournament/GetClassesAndDrawNamesAsync?tournamentId=...` and `GET /Tournament/GetMatchesSectionAsync?...` provide draw and match data for exploratory detail.
- `GET /Player/GetLastEventsPlayedAsync?...` and `GET /Player/GetPlayerMatchesAsync?...` expose convenient recent-match/profile data, but neither returns the tournament class, final standing and field size needed for placement analysis. Keep using the event standings/results path for that insight.

The implementation and endpoint-specific raw types live in [`src/lib/rankedin.ts`](../src/lib/rankedin.ts). Keep PascalCase API payloads and URL construction there; UI code should consume normalized domain types.

## Interpretation rules

- A player's public `R...` identifier and the API's numeric `PlayerId` are different identifiers. Resolve the former before requesting event history.
- A participated event is not necessarily a usable placement. The event may be unfinished, cancelled, missing a matching result, or missing class data.
- `GetResultsAsync.Data.length` is the current app's field-size measure. It represents result rows returned for the class and should continue to be treated as source data, not as an independently inferred field size.
- `StandingRangeTo` can represent a tied or ranged placement. Numeric summaries should use the midpoint of `Standing` and `StandingRangeTo`; display should preserve the range.
- Class names are organizer-entered and vary in spelling, case and suffixes such as `FTM`, draw labels and session names. Normalize only for grouping and retain the raw class name for source details.
- API failures and incomplete records are normal states. Do not turn missing placement, field size or rating into zero.

## Request discipline

Keep requests read-only, bounded and cache-friendly. The API client has small in-memory response, participated-event and event-analysis caches, a shared 25-request active limit, bounded retries for transient HTTP/network failures (including `Retry-After` handling), parallel player/event analysis, and cancels remaining class probes after it finds the player. Class-result responses remain coalesced in the shared response cache so multiple players from the same event do not fetch the same class payload twice; an individual player's early-stop signal does not cancel that shared fetch for other consumers. Tournament and Lunar League analysis share one 50-event participated-history request per player. A feature that loads a full player history must page deliberately rather than assuming that the first response contains every event. Long analyses should expose partial results as they arrive.

The Swagger document defines no public numeric concurrency or rate-limit value. Its rate-limit health endpoint requires an API key. A bounded live probe on 6 August 2026 returned 200 for bursts up to 25 concurrent requests, while a 30-request burst returned one 429 with `Retry-After: 1` and materially higher tail latency. Treat 25 as an application ceiling, not a guaranteed Rankedin limit; do not raise it without new evidence.

Historical Lunar League table reconstruction costs one pool-fixture request, one standings-rules request, one final-standing request and one per-fixture standings request for each completed pool fixture. A seven-team pool therefore takes 24 requests per season. The per-fixture standings requests use a separate concurrency limit of six because the endpoint can return `429` under a wider burst; the shared queue still caps all in-flight API work at 25 and retries throttled requests with backoff. The reconstructed final table is checked against `GetTeamStandingsAsync` during live validation; if reconstruction fails, the season card remains available and the chart falls back to its final standing data.

Do not add mutations, authentication, API secrets, a proxy or a database without an explicit product and architecture decision. If CORS or API availability changes, update [`docs/constraints.md`](./constraints.md) and record any consequential architecture change in [`docs/decisions/`](./decisions/).
