# Architecture

## Shape

Rankedin Explorer is a static React application built with Vite and deployed to GitHub Pages. The browser calls Rankedin's public v1 API directly; there is no application server, database or user account layer.

```text
Rankedin API
     │
     ▼
src/lib/rankedin.ts  ── normalized domain types ──>  React view state
                                                        │
                                                        ├─ temporary tournament exploration
                                                        ├─ temporary Lunar League exploration
                                                        ├─ temporary player progress analysis
                                                        ├─ browser-only report exports
                                                        └─ small local display preferences
```

## Boundaries

- `src/lib/rankedin.ts` owns URLs, raw API payloads, API errors and normalization. It should be the only place that knows Rankedin's PascalCase response shape.
- `src/lib/exports.ts` turns the normalized tournament view state into browser downloads. It must not fetch API data or become a second persistence layer.
- `src/hooks/usePublicSearch.ts` owns the shared debounce, timeout, cancellation and stale-response handling for tournament and player name searches.
- `src/lib/preferences.ts` owns the deliberately narrow local persistence policy.
- `src/App.tsx` owns the cross-screen interaction flow and temporary request state. Focused view pieces live in `src/components/`, while pure display transformations live in `src/lib/formatters.ts` and `src/lib/fieldBreakdown.ts`.
- `src/components/MetricCard.tsx`, `src/components/CardHeading.tsx`, `src/components/RankedinLink.tsx`, `src/components/InfoTip.tsx` and `src/components/LoadingValue.tsx` are shared semantic display primitives. Domain-specific components compose them instead of duplicating their structure.
- `src/App.css` owns the visual system and responsive layout. Avoid one-off positional fixes; use the existing grid, flex and card primitives.
- `src/styles/theme.css` is the single source for the light/dark palette and chart colors.

## Analysis flow

### Tournament Explorer

1. Parse a public tournament URL or ID.
2. Load the tournament header and standings metadata.
3. Load participants for the selected class.
4. When a pair is selected, page through each player's participated events and keep finished events; the pair card also reads the profile's current-year and career doubles records.
5. For each event, locate the player's result by numeric participant ID across classes.
6. For the field summary, select each player's newest `Type === 3` Lunar League event and resolve only its division name; older seasons and placement are excluded.
7. Load matches for the matching class and normalize partners, opponents, scores and outcomes.

### Player Progress

1. Parse a public player profile URL or `R...` ID.
2. Resolve the public ID to the API's numeric player ID and profile metadata.
3. Load one bounded participated-event window and split it into finished tournament events and finished Lunar League seasons.
4. Analyze tournament placements and league seasons in parallel. For tournaments, locate the player's result by numeric participant ID across event classes.
5. For Lunar League, resolve the player's team directly, then load pool standing, team fixtures and individual doubles in parallel within the shared request queue.
6. For the combined league chart, load the pool fixture list, the league ordering rules and one aggregate standing response per completed fixture. Reconstruct the selected team's rank after each of its own fixtures using all pool fixtures completed by that point, while keeping fixture result, score and opponent on the checkpoint. Show only divisions the player has entered, use the player's first-to-last fixture as each season slot, and compress gaps between chronological slots while preserving fixture order within each slot.
7. Normalize organizer-entered tournament class labels for chart series while retaining raw labels in the result table; keep league division names categorical and preserve region/pool suffixes as metadata.
8. Derive tournament placement percentage from standing and field size, using the midpoint for ranged standings.

Both modes render incomplete records honestly rather than treating missing data as zero.

### Lunar League Explorer

1. Parse a public Lunar League URL or numeric league ID.
2. Load league metadata, public pool options and aggregate league totals.
3. Select a pool, then load its teams, standings and fixtures in parallel.
4. Show team membership and source links without loading individual doubles by default; detailed match payloads remain a later, explicit drill-down.
5. Preserve the selected pool in the share URL so a league link opens in the same region/division context.

League loading is league-scoped rather than player-scoped. The Player Progress view continues to enrich only the selected player's teams and fixtures, while League Explorer can show the whole selected pool.

### Search and loading reliability

Name searches are debounced before requesting the public API. Each search has an abortable request, an eight-second timeout and a request generation check, so stale responses cannot overwrite newer input or leave the interface stuck in a searching state. Tournament, player and Lunar League searches use their corresponding public search paths. Direct public IDs bypass name search. Long analyses expose partial results and use explicit loading/error states; a later request generation supersedes earlier work without allowing its callbacks to update the current view.

### Report export

Report exports are derived from the already-loaded normalized React state and make no additional Rankedin requests. Tournament and Player Progress views expose a direct Save PDF action that uses the browser's print flow and print media styles to omit app chrome. Tournament CSV contains one row per player with pair, ranking, skill, current Lunar League division and up to five recent results. Tournament JSON contains the normalized report, source links, raw class labels, current League divisions and explicit partial/complete data status. The app does not persist any of these reports; sharing a durable copy is done through a URL or a downloaded file.

The API currently permits cross-origin browser requests from a GitHub Pages-style origin. This is an external deployment fact, not an application guarantee; if Rankedin changes its CORS policy, the project will need an explicitly approved proxy or server-backed architecture.
