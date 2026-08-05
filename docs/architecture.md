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
                                                        ├─ temporary player progress analysis
                                                        └─ small local display preferences
```

## Boundaries

- `src/lib/rankedin.ts` owns URLs, raw API payloads, API errors and normalization. It should be the only place that knows Rankedin's PascalCase response shape.
- `src/lib/preferences.ts` owns the deliberately narrow local persistence policy.
- `src/App.tsx` owns the current vertical-slice interaction flow. When the product grows, split screens and hooks out of this file without moving API concerns into components.
- `src/App.css` owns the visual system and responsive layout. Avoid one-off positional fixes; use the existing grid, flex and card primitives.

## Analysis flow

### Tournament Explorer

1. Parse a public tournament URL or ID.
2. Load the tournament header and standings metadata.
3. Load participants for the selected class.
4. When a pair is selected, page through each player's participated events and keep finished events.
5. For each event, locate the player's result by numeric participant ID across classes.
6. Load matches for the matching class and normalize partners, opponents, scores and outcomes.

### Player Progress

1. Parse a public player profile URL or `R...` ID.
2. Resolve the public ID to the API's numeric player ID and profile metadata.
3. Load one bounded participated-event window and split it into finished tournament events and finished Lunar League seasons.
4. Analyze tournament placements and league seasons in parallel. For tournaments, locate the player's result by numeric participant ID across event classes.
5. For Lunar League, resolve the player's team directly, then load pool standing, team fixtures and individual doubles in parallel within the shared request queue.
6. For the combined league chart, load the pool fixture list, the league ordering rules and one aggregate standing response per completed fixture. Reconstruct the selected team's rank after each of its own fixtures using all pool fixtures completed by that point, while keeping fixture result, score and opponent on the checkpoint. Show only divisions the player has entered, and compress gaps between chronological season slots while preserving fixture order within each slot.
7. Normalize organizer-entered tournament class labels for chart series while retaining raw labels in the result table; keep league division names categorical and preserve region/pool suffixes as metadata.
8. Derive tournament placement percentage from standing and field size, using the midpoint for ranged standings.

Both modes render incomplete records honestly rather than treating missing data as zero.

The API currently permits cross-origin browser requests from a GitHub Pages-style origin. This is an external deployment fact, not an application guarantee; if Rankedin changes its CORS policy, the project will need an explicitly approved proxy or server-backed architecture.
