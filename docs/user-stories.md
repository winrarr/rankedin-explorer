# User stories

These stories define the current product direction. The MVP is intentionally focused on read-only tournament preparation while leaving room for broader Rankedin exploration.

## Tournament and class exploration

1. As a user, I want to paste a Rankedin tournament URL so that the event loads automatically.
2. As a user, I want to search for tournaments by name, date, sport or location.
3. As a user, I want to see every class in a tournament.
4. As a user, I want to see the registered players, pairs or teams in a class.
5. As a user, I want to see historical skill ratings at event entry.
6. As a user, I want to see seeds, rankings, license state and confirmation state.
7. As a user, I want to filter and sort the participant list.
8. As a user, I want to see the rating distribution within a class.
9. As a user, I want to compare the strength of multiple classes.
10. As a user, I want to see an event's sport, format, location, dates and state.
11. As a user, I want to see draws, rounds and completed results.

## Player history and strength

12. As a user, I want to select any player from a tournament roster.
13. As a user, I want to see that player's latest finished tournaments.
14. As a user, I want to choose whether to inspect 5, 10 or 25 events.
15. As a user, I want to see the exact class entered in each event.
16. As a user, I want to see the ranking system or competition level used.
17. As a user, I want to see final placement and tied placement ranges.
18. As a user, I want to see partners for each event.
19. As a user, I want to see opponents and match outcomes.
20. As a user, I want to see set scores, tiebreak scores, draw and round.
21. As a user, I want to see win/loss records and rating movement.
22. As a user, I want to see ranking points earned in each event.
23. As a user, I want to distinguish finished, upcoming, cancelled and incomplete events.
24. As a user, I want to see when a player has little or no reliable tournament history.
25. As a user, I want to include a player's history across Rankedin-supported sports.
26. As a user, I want to compare a player's actual entries with the level of the current class.

## Comparisons and preparation

27. As a user, I want to compare two or more players side by side.
28. As a user, I want to compare pairs or teams rather than only individuals.
29. As a user, I want to compare recent form separately from long-term history.
30. As a user, I want to identify unusually strong participants using multiple signals.
31. As a user, I want to compare a player across different class levels.
32. As a user, I want to inspect head-to-head history when available.
33. As a user, I want to see recurring partners and opponents.
34. As a user, I want to compare multiple editions of an event.
35. As a user, I want to estimate difficult opponents without relying on raw win rate alone.

## Rankedin and club exploration

36. As a user, I want to open the source Rankedin profile, event, class or match.
37. As a user, I want to search for a player without starting from a tournament.
38. As a user, I want to explore clubs and organizations and their events.
39. As an organizer, I want to inspect participation and results across my events.
40. As a user, I want to see ranking and skill-rating history over time.
41. As a user, I want to inspect the event points behind a ranking.
42. As a user, I want to discover active players by club, region or sport.

## Single-player progress view — discovery

These stories describe the Player Progress mode. The initial view supports the profile lookup, timeline, series summaries, source links and honest missing-data treatment; filtering and deeper comparisons remain follow-up scope.

P1. As a player, I want to paste my Rankedin profile URL or ID so that I can start from my own history.
P2. As a player, I want to see my finished tournament placements on a time-based view so that I can understand change over time.
P3. As a player, I want each normalized level and class combination to have its own visual series so that moving between DPF25 and DPF35 is visible.
P4. As a player, I want the vertical scale to explain that a lower placement percentage is better so that the chart is not misleading.
P5. As a player, I want each point to show the exact date, event, raw class name, placement and field size so that I can verify the story behind the graph.
P6. As a player, I want to filter the chart to one or more class series so that sparse or irrelevant history does not overwhelm the view.
P7. As a player, I want a summary for each series with result count, average, median, best and latest finish so that I can scan the signal without reading every point.
P8. As a player, I want gaps and single-result classes to remain visible as sparse data so that the tool does not imply a trend that does not exist.
P9. As a player, I want incomplete events and unavailable placements called out separately so that missing data is not treated as a poor result.
P10. As a player, I want to limit the date range or number of recent results so that I can focus on current form or long-term history.
P11. As a player, I want to see recurring partners alongside the points so that I can distinguish individual progress from pair changes.
P12. As a player, I want to open the source Rankedin event from a chart point so that I can inspect the original draw and matches.
P13. As a player, I want the view to work without saving my profile or history in a database so that it remains a small private utility.
P14. As a player, I want a clear empty state when my profile cannot be found or has too little history to chart so that I know what to do next.
P15. As a player, I want class labels normalized for grouping while retaining the raw label in details so that tournament-specific suffixes do not create fake series.

## Personal utility

43. As a user, I want to share a comparison or report through a URL.
44. As a user, I want to export results to CSV or JSON.
45. As a user, I want to print a compact tournament report.
46. As a user, I want small display preferences to persist locally without saving my analysis data.
47. As a user, I want to know when data was last refreshed.
48. As a user, I want cached responses to make repeated analysis faster.
49. As a user, I want useful error messages when Rankedin data is incomplete or unavailable.

## MVP selection

The first release targets stories 1, 3–8, 12–24, 27, 29, 36, 43–47 and 49. The remaining stories are intentionally retained as product direction, not promises for the first release.
