# Rankedin API

## Authoritative contract

The [Rankedin Swagger document](https://api.rankedin.com/swagger/v1/swagger.json) is the authoritative API schema. This file is a maintained summary of the read paths currently used by the app, not a replacement for the Swagger document.

The browser client uses the public base URL `https://api.rankedin.com/v1`. API access is cross-origin from the deployed GitHub Pages site today, but that is an external fact that Rankedin can change.

## Read paths used by the app

- `GET /Player/PlayerProfileInfoAsync?rankedinId=...&language=en` resolves a public `R...` profile ID to the numeric player ID used by event and result endpoints.
- `GET /Player/ParticipatedEventsAsync?PlayerId=...&Language=en&Skip=...&Take=...` returns a player's participated events. The app currently keeps finished tournament events (`State === 4` and `Type === 4`).
- `GET /Tournament/GetheaderAsync?id=...&language=en` returns tournament metadata.
- `GET /Tournament/GetStandingsAsync?id=...` returns the classes and ranking systems attached to an event.
- `GET /Tournament/GetPlayersForClassAsync?tournamentId=...&tournamentClassId=...&language=en` returns the pairs in a class.
- `GET /Tournament/GetResultsAsync?tournamentId=...&classId=...&rankingId=...&language=en` returns the class result rows used to identify a player's class, standing, field size and rating values.
- `GET /Tournament/GetClassesAndDrawNamesAsync?tournamentId=...` and `GET /Tournament/GetMatchesSectionAsync?...` provide draw and match data for exploratory detail.

The implementation and endpoint-specific raw types live in [`src/lib/rankedin.ts`](../src/lib/rankedin.ts). Keep PascalCase API payloads and URL construction there; UI code should consume normalized domain types.

## Interpretation rules

- A player's public `R...` identifier and the API's numeric `PlayerId` are different identifiers. Resolve the former before requesting event history.
- A participated event is not necessarily a usable placement. The event may be unfinished, cancelled, missing a matching result, or missing class data.
- `GetResultsAsync.Data.length` is the current app's field-size measure. It represents result rows returned for the class and should continue to be treated as source data, not as an independently inferred field size.
- `StandingRangeTo` can represent a tied or ranged placement. Numeric summaries should use the midpoint of `Standing` and `StandingRangeTo`; display should preserve the range.
- Class names are organizer-entered and vary in spelling, case and suffixes such as `FTM`, draw labels and session names. Normalize only for grouping and retain the raw class name for source details.
- API failures and incomplete records are normal states. Do not turn missing placement, field size or rating into zero.

## Request discipline

Keep requests read-only, bounded and cache-friendly. The API client has a small in-memory response cache and bounded event analysis concurrency. A feature that loads a full player history must page deliberately rather than assuming that the first response contains every event.

Do not add mutations, authentication, API secrets, a proxy or a database without an explicit product and architecture decision. If CORS or API availability changes, update [`docs/constraints.md`](./constraints.md) and record any consequential architecture change in [`docs/decisions/`](./decisions/).
