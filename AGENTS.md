# Rankedin Explorer

Rankedin Explorer is a read-only React/Vite site for making public Rankedin tournament, player and match data easier to compare. The first vertical slice analyzes a tournament field, loads class participants, and traces a selected player through finished events.

## Repository map

- `src/App.tsx` — application composition and user-facing interaction state.
- `src/lib/rankedin.ts` — Rankedin API client, response normalization and analysis workflow.
- `src/lib/preferences.ts` — versioned, lightweight local preference storage.
- `src/lib/*.test.ts` — focused pure-function tests.
- `docs/` — product scope, architecture, API contract notes, constraints and decisions.
- `.github/workflows/deploy.yml` — GitHub Pages deployment.

The Rankedin API is the source of truth for live data. Do not hard-code live tournament results into the application. New sessions should remain empty until the user provides a public tournament or player reference.

## Boundaries

- Keep the site read-only; do not add Rankedin mutations or account flows without an explicit product decision.
- Keep the project database-free. Tournament selections, player selections and reports are temporary page state.
- Only small display preferences may use `localStorage`; follow the policy in `src/lib/preferences.ts`.
- Keep API details behind `src/lib/rankedin.ts` so UI code depends on normalized domain types rather than Rankedin's PascalCase payloads.
- Treat API failures, incomplete events and unpublished results as normal states.

## Commands

Run these from the repository root:

- `npm run dev` — start the local Vite server.
- `npm run lint` — run Oxlint.
- `npm run test` — run focused Vitest tests once.
- `npm run build` — type-check and build the deployable site.
- `npm run check` — run lint, tests and build in the same order as CI.
- `npm run preview` — serve the production build locally.

Before handing off implementation work, run `npm run check`.

Unless the user explicitly asks for local-only changes, always deploy completed implementation changes before handoff. Run `npm run check`, commit only the scoped changes, push to the configured deployment branch, and verify the GitHub Pages workflow succeeds.

## Durable project knowledge

- `docs/architecture.md` — current data flow and component boundaries.
- `docs/rankedin-api.md` — authoritative Swagger link, read-only endpoints and payload interpretation.
- `docs/constraints.md` — external API, deployment and persistence boundaries.
- `docs/decisions/` — accepted consequential alternatives.
- `docs/progress-visualization.md` — discovery research and user stories for the next single-player feature; the graph is not implemented yet.
- `docs/user-stories.md` — broader product scope.

Keep implementation detail in code and tests. Update these documents when their subject changes; update this file when commands, boundaries or routing change.
