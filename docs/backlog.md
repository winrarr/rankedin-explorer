# Product backlog

This backlog records planned product outcomes that are intentionally not part of the current implementation. Each item includes the user value, boundaries and acceptance criteria needed to implement it later.

## BL-LL-01 — Historical Lunar League seasons

- Status: Backlog
- Related stories: L4–L8 in [`docs/user-stories.md`](./user-stories.md)

### Goal

Let a user who has opened a current Lunar League team or player view opt into prior public seasons and inspect the same team- and league-level context over time.

### Rationale

The current season is the primary answer when a user searches their name or teammate. Historical seasons are valuable for context, but showing them by default would make the current-team flow harder to understand and could mix active and finished standings.

### Constraints

- Keep the current season as the default and visually distinguish it from historical seasons.
- Use only public Rankedin read endpoints and normalized data behind `src/lib/rankedin.ts`.
- Do not add accounts, mutations, a database or persistent player/team selections.
- Treat unpublished pools, missing team membership, incomplete fixtures and unavailable historic seasons as normal states.
- Preserve the current league view’s pool, standings and fixture language instead of creating a separate historical visual system.

### Acceptance criteria

- From a loaded current Lunar League team/player context, a user can open a list of prior public seasons without losing the current-season view.
- Each available season identifies its name, date range, status, team, division and region when those values are public.
- Selecting a prior season updates the league-specific team, pool, standings and fixture context to that season and clearly labels it as historical.
- The current season remains easy to return to and is never silently replaced by historical data.
- Missing or unpublished historical data produces an honest explanation and does not appear as an empty or zero-valued season.
- If a season or pool is shared through the URL, the selected historical context can be reopened without requiring a database or account.

### Out of scope for this item

- Cross-season ranking or strength scoring.
- Automatic comparisons between all seasons.
- Historical data for every player in the system before a user selects a relevant team or player.
