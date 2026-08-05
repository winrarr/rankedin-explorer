# Rankedin Explorer

Rankedin Explorer is a read-only React/Vite site for making public Rankedin tournament, player and match data easier to compare. The first vertical slice analyzes a tournament field, loads class participants, and traces a selected player through finished events.

## Repository map

- `src/App.tsx` — application composition and user-facing interaction state.
- `src/lib/rankedin.ts` — Rankedin API client, response normalization and analysis workflow.
- `src/lib/preferences.ts` — versioned, lightweight local preference storage.
- `src/lib/*.test.ts` — focused pure-function tests.
- `docs/` — product scope, architecture, constraints and decisions.
- `.github/workflows/deploy.yml` — GitHub Pages deployment.

The Rankedin API is the source of truth for live data. Do not hard-code live tournament results into the application. Preview data in `App.tsx` is an intentional first-screen fallback for offline use and should remain clearly labeled as preview data.

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
- `npm run preview` — serve the production build locally.

Before handing off implementation work, run `npm run lint`, `npm run test` and `npm run build`.

## Maintenance routing

Keep implementation detail in code and tests. Update `docs/architecture.md` when data flow or component boundaries materially change, `docs/constraints.md` when external API or deployment facts change, `docs/decisions/` for consequential alternatives, and `docs/user-stories.md` when the product scope changes. Keep this file concise and update commands when the package scripts change.
