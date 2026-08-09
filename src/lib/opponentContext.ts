import type { MatchRecord, PairRecord } from './rankedin'
import { dateTimestamp } from './formatters'

export type FieldOpponentSummary = {
  id: number
  name: string
  meetings: number
  wins: number
  losses: number
  draws: number
  latestDate: string
  latestWon: boolean | null
  latestScore: string
}

export type PairPreparationContext = {
  matchesChecked: number
  matchesWithFieldOpponents: number
  wins: number
  losses: number
  draws: number
  opponents: FieldOpponentSummary[]
}

function playerMap(participants: PairRecord[]) {
  return new Map(
    participants.flatMap((pair) => [pair.first, pair.second]).map((player) => [player.id, player.name]),
  )
}

export function summarizeFieldOpponents(
  matches: MatchRecord[],
  participants: PairRecord[],
  selectedPair: PairRecord,
): PairPreparationContext {
  const namesById = playerMap(participants)
  const selectedPlayerIds = new Set([selectedPair.first.id, selectedPair.second.id])
  const uniqueMatches = Array.from(new Map(matches.map((match) => [match.id, match])).values())
  const summaries = new Map<number, FieldOpponentSummary>()
  let matchesWithFieldOpponents = 0
  let wins = 0
  let losses = 0
  let draws = 0

  uniqueMatches.forEach((match) => {
    if (match.won === true) wins += 1
    if (match.won === false) losses += 1
    if (match.won === null) draws += 1

    const fieldOpponentIds = Array.from(new Set(match.opponentIds))
      .filter((id) => namesById.has(id) && !selectedPlayerIds.has(id))
    if (!fieldOpponentIds.length) return
    matchesWithFieldOpponents += 1

    fieldOpponentIds.forEach((id) => {
      const previous = summaries.get(id)
      const isNewer = !previous || dateTimestamp(match.date) >= dateTimestamp(previous.latestDate)
      summaries.set(id, {
        id,
        name: namesById.get(id) ?? 'Opponent unavailable',
        meetings: (previous?.meetings ?? 0) + 1,
        wins: (previous?.wins ?? 0) + (match.won === true ? 1 : 0),
        losses: (previous?.losses ?? 0) + (match.won === false ? 1 : 0),
        draws: (previous?.draws ?? 0) + (match.won === null ? 1 : 0),
        latestDate: isNewer ? match.date : previous.latestDate,
        latestWon: isNewer ? match.won : previous.latestWon,
        latestScore: isNewer ? match.score : previous.latestScore,
      })
    })
  })

  const opponents = [...summaries.values()].sort((first, second) => (
    second.meetings - first.meetings
    || dateTimestamp(second.latestDate) - dateTimestamp(first.latestDate)
    || first.name.localeCompare(second.name)
  ))

  return {
    matchesChecked: uniqueMatches.length,
    matchesWithFieldOpponents,
    wins,
    losses,
    draws,
    opponents,
  }
}
