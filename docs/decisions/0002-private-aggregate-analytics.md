# 0002. Optional private aggregate analytics

- Status: accepted
- Date: 2026-10-15

## Decision

Use optional GoatCounter analytics for aggregate site visits and successful tournament, player and Lunar League lookups. Configure the public site code through a GitHub Actions repository variable. Keep the site static and do not store analytics identifiers or lookup references in the browser or event payloads.

## Rationale

The owner wants private visitor and product-usage statistics while preserving the existing database-free GitHub Pages deployment. GoatCounter provides a private dashboard and named events without cookies or persistent browser storage.

## Consequences

- Analytics are disabled until `GOATCOUNTER_CODE` is configured.
- The dashboard counts successful lookup actions, including repeat lookups, but does not reveal which records were viewed.
- Browser privacy tools may block tracking, so reported counts are approximate.
- GoatCounter remains an external service; its data handling is described in [`analytics.md`](../analytics.md).
