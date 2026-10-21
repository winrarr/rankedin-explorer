import type { MatchRecord, PlayerEventAnalysis } from './rankedin'

export type PlayerPartnerSummary = {
  name: string
  rankedInId: string | null
  eventCount: number
}

export type PlayerOpponentSummary = {
  name: string
  rankedInId: string | null
  matchCount: number
  wins: number
  losses: number
  unknownResults: number
}

export type LoadedPlayerMatchState = {
  matches: MatchRecord[] | null
  playerRankedInIds: Record<number, string>
}

export type PlayerConnectionsSummary = {
  partners: PlayerPartnerSummary[]
  opponents: PlayerOpponentSummary[]
  loadedMatchEventCount: number
}

function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase()
}

function sortByFrequency<T extends { name: string }>(
  first: T & { eventCount?: number; matchCount?: number },
  second: T & { eventCount?: number; matchCount?: number },
) {
  const firstCount = first.eventCount ?? first.matchCount ?? 0
  const secondCount = second.eventCount ?? second.matchCount ?? 0
  return secondCount - firstCount || first.name.localeCompare(second.name)
}

function partnerSummaries(events: PlayerEventAnalysis[]) {
  const summaries = new Map<string, PlayerPartnerSummary>()
  for (const event of events) {
    const name = event.partner?.trim()
    if (!name) continue
    const rankedInId = event.partnerRankedInId?.toUpperCase() ?? null
    const key = rankedInId ? `rankedin:${rankedInId}` : `name:${normalizedName(name)}`
    const summary = summaries.get(key)
    if (summary) {
      summary.eventCount += 1
      continue
    }
    summaries.set(key, { name, rankedInId, eventCount: 1 })
  }
  return [...summaries.values()].sort(sortByFrequency)
}

function opponentSummaries(
  events: PlayerEventAnalysis[],
  matchStates: Record<number, LoadedPlayerMatchState>,
) {
  const summaries = new Map<string, PlayerOpponentSummary>()
  let loadedMatchEventCount = 0

  for (const event of events) {
    const loadedMatches = matchStates[event.id]?.matches
    const matches = loadedMatches ?? event.matches
    if (loadedMatches === null || (loadedMatches === undefined && !event.matches.length)) continue
    loadedMatchEventCount += 1

    for (const match of matches) {
      const seenInMatch = new Set<string>()
      for (let index = 0; index < match.opponents.length; index += 1) {
        const name = match.opponents[index]?.trim()
        if (!name) continue
        const playerId = match.opponentIds[index]
        const rankedInId = playerId === undefined
          ? null
          : matchStates[event.id]?.playerRankedInIds[playerId]?.toUpperCase() ?? null
        const key = playerId !== undefined
          ? `player:${playerId}`
          : rankedInId
            ? `rankedin:${rankedInId}`
            : `name:${normalizedName(name)}`
        if (seenInMatch.has(key)) continue
        seenInMatch.add(key)

        const summary = summaries.get(key)
        if (summary) {
          summary.matchCount += 1
          summary.rankedInId ??= rankedInId
          if (match.won === true) summary.wins += 1
          else if (match.won === false) summary.losses += 1
          else summary.unknownResults += 1
          continue
        }

        summaries.set(key, {
          name,
          rankedInId,
          matchCount: 1,
          wins: match.won === true ? 1 : 0,
          losses: match.won === false ? 1 : 0,
          unknownResults: match.won === null ? 1 : 0,
        })
      }
    }
  }

  return {
    opponents: [...summaries.values()].sort(sortByFrequency),
    loadedMatchEventCount,
  }
}

export function summarizePlayerConnections(
  events: PlayerEventAnalysis[],
  matchStates: Record<number, LoadedPlayerMatchState>,
): PlayerConnectionsSummary {
  const { opponents, loadedMatchEventCount } = opponentSummaries(events, matchStates)
  return {
    partners: partnerSummaries(events),
    opponents,
    loadedMatchEventCount,
  }
}
