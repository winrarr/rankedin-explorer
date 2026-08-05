# Single-player progress view

Status: implemented as the initial Player Progress mode.

The proposed feature starts from one public Rankedin player profile and visualizes finished tournament placements over time. It should remain a temporary, read-only browser view with no saved player history.

## Data check: Rasmus Kock Thygesen

The discovery check used [Rasmus Kock Thygesen's public Rankedin profile](https://www.rankedin.com/en/player/R000229993/rasmus-kock-thygesen/info) on 2026-08-05 and the public API described in [`rankedin-api.md`](./rankedin-api.md).

Observed data:

- The profile resolves to numeric player ID `1228468`.
- The participated-events response contained 26 events. One was not finished, leaving 25 finished tournament events to inspect.
- 22 finished events had a matching class result. Three finished events did not expose a matching result through the current class-result lookup and should be represented as unavailable data, not silently treated as placements.
- Usable placement dates run from 01/03/2024 to 03/07/2026.
- Normalized class groups are DPF25 Herrer: 12 results, DPF35 Herrer: 9 results, and DPF50 Herrer: 1 result.
- Field sizes range from 7 to 16 pairs.
- Placement percentages range from Top 12.5% to Top 100%. Using placement divided by field size, DPF25 Herrer averages about Top 60%, DPF35 Herrer about Top 62%, and the one DPF50 Herrer result is Top 88%.

## Does the graph make sense?

Yes, with a careful visual treatment. Rasmus has enough results for two useful series, and the class changes are exactly the kind of context a raw win rate misses. However, a conventional smoothed line chart would overstate the evidence:

- DPF50 has one point, so it has no trend.
- There is a long gap between the 2024 and 2025 results.
- Class names vary substantially in their raw spelling and include organizer-specific draw/session suffixes.
- Moving from DPF25 to DPF35 changes the difficulty context, so a single undifferentiated line would be misleading.
- A lower percentage is better, but `1st of 8` is Top 12.5%, not zero; the axis and legend need to explain this clearly.

## Implemented design

The current view uses a single-player timeline scatter plot with optional connecting segments:

1. The x-axis is event date.
2. The y-axis is finish percentage (`placement / field size`), with Top 0% at the top and Top 100% at the bottom. Label it as “finish percentage — lower is better”.
3. Each normalized level/class combination gets a color and legend entry.
4. Each finished placement is a point. Solid lines connect points only within the same series, and dotted lines show a least-squares linear direction for series with at least two dated points. A dotted line is a visual summary, not a forecast.
5. Hover or tap reveals date, event, raw class label, placement, field size, partner and a link to the source event.
6. Summary cards show count, average, median, best, latest and the recent direction for each selected series.
7. Filters allow all classes, one class, a date range and a recent-result limit. The raw event list remains available below the chart for verification.
8. Missing results appear in a separate notice or event list so the chart never turns unavailable data into a bad finish.
9. The chart legend toggles individual series, and the results table links each point back to its Rankedin tournament.

This is better described as a timeline with evidence points than as a continuous performance curve. A rolling median or trend line can be considered later, but should not be the default because the sample is sparse and the classes are not equivalent.

## Lunar League progress view

The player view now includes a separate Lunar League section instead of mixing league standings into the tournament placement percentage chart. League division is categorical: the vertical scale runs from Elitedivision through Serie 5, with higher divisions higher on the chart. Each season is drawn in its own horizontal fixture slot, and the marker label shows team standing, such as `1st / 7`.

The chart is paired with season evidence cards. Each card keeps the full division name, region and A/B pool suffix, team link, team standing, team fixture record, selected-player doubles record and match points. Fixture details stay exploratory behind a disclosure control, where individual partners, opponents, scores and outcomes are available.

The Lunar League chart combines both ideas in one data-driven view. Each division is a vertical band, ordered from higher divisions at the top to lower divisions at the bottom. Within a band's season range, rank 1 is near the top and the last team is near the bottom, so each checkpoint shows both the division and the selected team's table position. A circle marked `W`, rounded square `L` or diamond `D` shows the fixture result; the marker title includes the score, opponent and resulting rank. This makes a rank drop after a win legible when other teams have played in the meantime. Seasons are intentionally not connected: comparing their separate slots and labels shows division changes without making a gap look like a match result, and no checkpoint is emitted when the selected team did not play.

The visible division window contains only divisions the player has actually played in. The horizontal axis shows the player's seasons in chronological sequence; each slot spans the player's first-to-last fixture, fixture dates remain ordered and proportionally spaced within that slot, and a small visual gap separates the slots. Season labels and the evidence cards retain the real official date ranges.

For the current seven-team Lunar League pools, reconstruction uses the pool fixture list and one aggregate standings response for each completed team fixture. The resulting final aggregate is validated against Rankedin's final standings endpoint. The implementation deliberately keeps this league-specific concurrency at six because a 25-request burst caused throttling during API exploration, while transient 429 responses are retried by the shared request queue.

This separation keeps two different kinds of evidence honest: tournament charts answer “how did the player finish relative to that field?”, while the league chart answers “which division did the player compete in, and how did their team and individual record look that season?”.

The API client discovers both kinds of history through one shared participated-events request, then uses direct player-to-team league lookups and bounded concurrent fixture enrichment. Transient throttling and network failures are retried with backoff, while partial season cards can render as they arrive.

## Open design decisions before implementation

- Whether the first release should accept a profile URL, a Rankedin `R...` ID, or both.
- Whether “level + class” should normalize to level plus gender (`DPF25 Herrer`) or preserve additional organizer distinctions such as `A`, `B`, speed format and session.
- Whether the default history should load all paged finished events or start with a bounded recent window.
- Whether a separate rating-history overlay is useful. It should use a second scale or a separate panel; it should not share the placement percentage axis.
- How to show a result with a `StandingRangeTo` without hiding the uncertainty.
