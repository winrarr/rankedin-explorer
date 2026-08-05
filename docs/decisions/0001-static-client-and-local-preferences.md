# 0001. Static client with narrow local preferences

- Status: accepted
- Date: 2026-08-05

## Decision

Ship the first version as a static Vite site that calls Rankedin's public API directly. Keep tournament and player analysis in temporary React state. Persist only small display preferences locally in the browser.

## Rationale

The project is personal and intended for GitHub Pages. A database would add deployment and account complexity without being required for the first use case. Lightweight preferences improve continuity without encouraging users to build a second, fragile data store inside browser storage.

## Consequences

- The tool can be deployed without a backend or secret API key.
- Shared reports must be represented by URL state or exported files.
- Saved player lists and long-lived snapshots are intentionally deferred.
- A change in Rankedin CORS policy would require an explicit architecture decision before adding a proxy.
