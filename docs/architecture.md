# Architecture

## Shape

Rankedin Explorer is a static React application built with Vite and deployed to GitHub Pages. The browser calls Rankedin's public v1 API directly; there is no application server, database or user account layer.

```text
Rankedin API
     │
     ▼
src/lib/rankedin.ts  ── normalized domain types ──>  React view state
                                                        │
                                                        ├─ temporary tournament/player analysis
                                                        └─ small local display preferences
```

## Boundaries

- `src/lib/rankedin.ts` owns URLs, raw API payloads, API errors and normalization. It should be the only place that knows Rankedin's PascalCase response shape.
- `src/lib/preferences.ts` owns the deliberately narrow local persistence policy.
- `src/App.tsx` owns the current vertical-slice interaction flow. When the product grows, split screens and hooks out of this file without moving API concerns into components.
- `src/App.css` owns the visual system and responsive layout. Avoid one-off positional fixes; use the existing grid, flex and card primitives.

## Analysis flow

1. Parse a public tournament URL or ID.
2. Load the tournament header and standings metadata.
3. Load participants for the selected class.
4. When a player is selected, page through their participated events and keep finished events.
5. For each event, locate the player's result by numeric participant ID across classes.
6. Load matches for the matching class and normalize partners, opponents, scores and outcomes.
7. Render incomplete records honestly rather than treating missing data as zero.

The API currently permits cross-origin browser requests from a GitHub Pages-style origin. This is an external deployment fact, not an application guarantee; if Rankedin changes its CORS policy, the project will need an explicitly approved proxy or server-backed architecture.
