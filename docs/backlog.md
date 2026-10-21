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

## BL-PP-01 — Compare two players' progress

- Status: Backlog
- Related stories: 27, 29, P2–P11 in [`docs/user-stories.md`](./user-stories.md)

### Goal

Let a user compare the progress histories of two selected public player profiles in one view.

### Rationale

Player Progress currently explains one profile at a time. Comparing two people could help users understand recent form and longer-term results, but the comparison needs its own design because histories can cover different dates, event types, classes and amounts of available data.

### Constraints

- Keep the existing single-player flow easy to use and make the second profile an explicit choice.
- Use only public Rankedin read endpoints and normalized data behind `src/lib/rankedin.ts`.
- Keep both profiles and their records clearly attributed; do not imply tournament classes or league divisions are directly equivalent when they are not.
- Preserve missing, partial and differently scoped histories as such instead of treating them as zero or silently comparing mismatched measures.
- Do not add accounts, a database or persistent player selections.

### Acceptance criteria

- From Player Progress, a user can choose a second public profile and inspect both players together without losing the first profile's context.
- The user can replace or remove the second profile and return to the existing single-player view.
- Each displayed measure identifies which player and time or event scope it represents, and only comparable measures are directly contrasted.
- Partial or unavailable data for one profile remains visible as a limitation without hiding the other profile's available history.
- A comparison can be reopened from a share URL using public player references without a database or account.
