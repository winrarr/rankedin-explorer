import { useEffect, useRef, useState } from 'react'
import {
  getPlayerAnalysis,
  getPlayerCurrentLeagueDivision,
  getPlayerDpfRankings,
} from '../lib/rankedin'
import type { PairRecord, PlayerAnalysis, PlayerLeagueDivision } from '../lib/rankedin'
import type { FieldDpfLookup } from '../components/tournamentTypes'

const FIELD_PLACEMENT_CONCURRENCY = 3
const FIELD_PLACEMENT_EVENT_LIMIT = 5
const FIELD_LEAGUE_CONCURRENCY = 6
const FIELD_DPF_CONCURRENCY = 3

async function settleWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
  onSettled?: (result: PromiseSettledResult<R>, index: number) => void,
) {
  const results: PromiseSettledResult<R>[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      try {
        results[currentIndex] = { status: 'fulfilled', value: await mapper(items[currentIndex]) }
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }
      onSettled?.(results[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

type UseTournamentFieldDataOptions = {
  participants: PairRecord[] | null
  isActive: boolean
}

export function useTournamentFieldData({ participants, isActive }: UseTournamentFieldDataOptions) {
  const [fieldPlacementSummaries, setFieldPlacementSummaries] = useState<Record<number, PlayerAnalysis | null>>({})
  const [fieldPlacementsLoaded, setFieldPlacementsLoaded] = useState(false)
  const [isLoadingFieldPlacements, setIsLoadingFieldPlacements] = useState(false)
  const [fieldPlacementError, setFieldPlacementError] = useState<string | null>(null)
  const [fieldDpfRankings, setFieldDpfRankings] = useState<Record<number, FieldDpfLookup>>({})
  const [fieldDpfRankingsLoaded, setFieldDpfRankingsLoaded] = useState(false)
  const [isLoadingFieldDpfRankings, setIsLoadingFieldDpfRankings] = useState(false)
  const [fieldDpfRankingError, setFieldDpfRankingError] = useState<string | null>(null)
  const [fieldLeagueDivisions, setFieldLeagueDivisions] = useState<Record<number, PlayerLeagueDivision | null>>({})
  const [fieldLeagueDivisionsLoaded, setFieldLeagueDivisionsLoaded] = useState(false)
  const [isLoadingFieldLeagueDivisions, setIsLoadingFieldLeagueDivisions] = useState(false)
  const [fieldLeagueDivisionError, setFieldLeagueDivisionError] = useState<string | null>(null)

  const fieldPlacementRequestRef = useRef(0)
  const fieldDpfRequestRef = useRef(0)
  const fieldLeagueRequestRef = useRef(0)

  async function loadFieldPlacements(participants: PairRecord[]) {
    const requestId = fieldPlacementRequestRef.current + 1
    fieldPlacementRequestRef.current = requestId
    const players = participants.flatMap((pair) => [pair.first, pair.second])
    setIsLoadingFieldPlacements(true)
    setFieldPlacementError(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)

    let playersToLoad = players
    const failedPlayerIds = new Set<number>()

    for (let eventCount = 1; eventCount <= FIELD_PLACEMENT_EVENT_LIMIT && playersToLoad.length; eventCount += 1) {
      if (requestId !== fieldPlacementRequestRef.current) return

      const nextPlayers: typeof players = []
      await settleWithConcurrency(
        playersToLoad,
        FIELD_PLACEMENT_CONCURRENCY,
        (player) => getPlayerAnalysis(player.id, eventCount),
        (result, index) => {
          if (requestId !== fieldPlacementRequestRef.current) return
          const player = playersToLoad[index]

          if (result.status === 'rejected') {
            failedPlayerIds.add(player.id)
            if (eventCount === 1) {
              setFieldPlacementSummaries((current) => ({ ...current, [player.id]: null }))
            }
            return
          }

          const analysis = { ...result.value, playerName: player.name }
          setFieldPlacementSummaries((current) => ({ ...current, [player.id]: analysis }))
          if (analysis.events.length >= eventCount && eventCount < FIELD_PLACEMENT_EVENT_LIMIT) {
            nextPlayers.push(player)
          }
        },
      )

      playersToLoad = nextPlayers
    }

    if (requestId !== fieldPlacementRequestRef.current) return

    setFieldPlacementsLoaded(true)
    if (failedPlayerIds.size) {
      setFieldPlacementError(`${failedPlayerIds.size} player ${failedPlayerIds.size === 1 ? 'history was' : 'histories were'} incomplete.`)
    }
    setIsLoadingFieldPlacements(false)
  }

  async function loadFieldDpfRankings(participants: PairRecord[]) {
    const requestId = fieldDpfRequestRef.current + 1
    fieldDpfRequestRef.current = requestId
    const players = participants.flatMap((pair) => [pair.first, pair.second])
    setIsLoadingFieldDpfRankings(true)
    setFieldDpfRankingError(null)
    setFieldDpfRankings({})
    setFieldDpfRankingsLoaded(false)

    const results = await settleWithConcurrency(players, FIELD_DPF_CONCURRENCY, async (player) => {
      try {
        const rankings = await getPlayerDpfRankings(player)
        const lookup = { ranking: rankings[0] ?? null, failed: false }
        if (requestId === fieldDpfRequestRef.current) {
          setFieldDpfRankings((current) => ({ ...current, [player.id]: lookup }))
        }
        return lookup
      } catch {
        const lookup = { ranking: null, failed: true }
        if (requestId === fieldDpfRequestRef.current) {
          setFieldDpfRankings((current) => ({ ...current, [player.id]: lookup }))
        }
        throw new Error(`DPF ranking could not be read for ${player.name}.`)
      }
    })

    if (requestId !== fieldDpfRequestRef.current) return
    const failedCount = results.filter((result) => result.status === 'rejected').length
    setFieldDpfRankingsLoaded(true)
    if (failedCount) {
      setFieldDpfRankingError(`${failedCount} DPF ${failedCount === 1 ? 'ranking was' : 'rankings were'} unavailable.`)
    }
    setIsLoadingFieldDpfRankings(false)
  }

  async function loadFieldLeagueDivisions(participants: PairRecord[]) {
    const requestId = fieldLeagueRequestRef.current + 1
    fieldLeagueRequestRef.current = requestId
    const players = participants.flatMap((pair) => [pair.first, pair.second])
    setIsLoadingFieldLeagueDivisions(true)
    setFieldLeagueDivisionError(null)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)

    const results = await settleWithConcurrency(
      players,
      FIELD_LEAGUE_CONCURRENCY,
      (player) => getPlayerCurrentLeagueDivision(player.id),
    )
    const divisions: Record<number, PlayerLeagueDivision | null> = {}
    let failedCount = 0

    results.forEach((result, index) => {
      const player = players[index]
      if (result.status === 'fulfilled') {
        divisions[player.id] = result.value
        return
      }
      divisions[player.id] = null
      failedCount += 1
    })

    if (requestId !== fieldLeagueRequestRef.current) return

    setFieldLeagueDivisions(divisions)
    setFieldLeagueDivisionsLoaded(true)
    if (failedCount) {
      setFieldLeagueDivisionError(`${failedCount} player ${failedCount === 1 ? 'division was' : 'divisions were'} unavailable.`)
    }
    setIsLoadingFieldLeagueDivisions(false)
  }

  function reset() {
    fieldPlacementRequestRef.current += 1
    fieldDpfRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setIsLoadingFieldPlacements(false)
    setFieldPlacementError(null)
    setFieldDpfRankings({})
    setFieldDpfRankingsLoaded(false)
    setIsLoadingFieldDpfRankings(false)
    setFieldDpfRankingError(null)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)
    setIsLoadingFieldLeagueDivisions(false)
    setFieldLeagueDivisionError(null)
  }

  function suspend() {
    fieldPlacementRequestRef.current += 1
    fieldDpfRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setIsLoadingFieldPlacements(false)
    setIsLoadingFieldDpfRankings(false)
    setIsLoadingFieldLeagueDivisions(false)
  }

  useEffect(() => {
    if (!isActive || !participants) return
    void loadFieldPlacements(participants)
    void loadFieldDpfRankings(participants)
    void loadFieldLeagueDivisions(participants)
  }, [isActive, participants])

  return {
    fieldPlacementSummaries,
    fieldPlacementsLoaded,
    isLoadingFieldPlacements,
    fieldPlacementError,
    fieldDpfRankings,
    fieldDpfRankingsLoaded,
    isLoadingFieldDpfRankings,
    fieldDpfRankingError,
    fieldLeagueDivisions,
    fieldLeagueDivisionsLoaded,
    isLoadingFieldLeagueDivisions,
    fieldLeagueDivisionError,
    reset,
    suspend,
  }
}
