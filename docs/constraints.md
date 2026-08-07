# Constraints

- The initial deployment is a static GitHub Pages site.
- The initial product is a personal, read-only utility; it does not create or modify Rankedin data.
- There is no database in the initial architecture.
- Tournament selections, player selections and generated reports are temporary browser state.
- PDF, CSV and JSON exports are generated from the loaded browser state without additional API requests; downloaded files are user-owned output, not app persistence.
- Only lightweight presentation preferences may be stored in `localStorage`, under the versioned key managed by `src/lib/preferences.ts`.
- Rankedin's public API is the source of truth. API response fields can be incomplete, unavailable for some events, or changed by Rankedin.
- Public API calls should remain conservative and cache-friendly; the app must not assume unlimited request capacity.
