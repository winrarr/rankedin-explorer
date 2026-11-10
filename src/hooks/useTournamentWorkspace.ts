import { useEffect, useRef, useState } from 'react'
import {
  getClassParticipants,
  getEventMatches,
  getPlayerAnalysis,
  getTournamentSnapshot,
  getRecentPlayerMatches,
} from '../lib/rankedin'
import type {
  PairRecord,
  MatchRecord,
  TournamentSnapshot,
} from '../lib/rankedin'
import { summarizeFieldOpponents } from '../lib/opponentContext'
import type { SharedLocationUpdate } from '../lib/sharedLocation'
import { isDirectTournamentReference } from '../lib/references'
import { trackSuccessfulLookup } from '../lib/analytics'
import { useTournamentFieldData } from './useTournamentFieldData'
import type { PairHistoryState, PairPreparationState } from '../components/tournamentTypes'

type UseTournamentWorkspaceOptions = {
  reference: string
  onReferenceChange: (reference: string) => void
  isActive: boolean
  historyLimit: number
  onLocationChange: (location: SharedLocationUpdate) => void
  onShareCopied: (copied: boolean) => void
}

export function useTournamentWorkspace({
  reference,
  onReferenceChange,
  isActive,
  historyLimit,
  onLocationChange,
  onShareCopied,
}: UseTournamentWorkspaceOptions) {
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingClass, setIsLoadingClass] = useState(false)
  const [isLoadingPair, setIsLoadingPair] = useState(false)
  const [tournamentGames, setTournamentGames] = useState<MatchRecord[] | null>(null)
  const [isLoadingTournamentGames, setIsLoadingTournamentGames] = useState(false)
  const [tournamentGamesError, setTournamentGamesError] = useState<string | null>(null)
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null)
  const [usPairId, setUsPairId] = useState<string | null>(null)
  const [pairPreparation, setPairPreparation] = useState<PairPreparationState | null>(null)
  const [isLoadingPairPreparation, setIsLoadingPairPreparation] = useState(false)
  const [pairPreparationError, setPairPreparationError] = useState<string | null>(null)
  const [pairHistory, setPairHistory] = useState<PairHistoryState | null>(null)

  const tournamentRequestRef = useRef(0)
  const pairHistoryRequestRef = useRef(0)
  const pairPreparationRequestRef = useRef(0)
  const lastAnalyzedReferenceRef = useRef('')
  const fieldData = useTournamentFieldData({ participants: snapshot?.participants ?? null, isActive })
  const { reset: resetFieldData, suspend: suspendFieldData, ...fieldDataState } = fieldData

  function clearPairPreparation() {
    pairPreparationRequestRef.current += 1
    setUsPairId(null)
    setPairPreparation(null)
    setIsLoadingPairPreparation(false)
    setPairPreparationError(null)
  }

  function clearPairInspection() {
    pairHistoryRequestRef.current += 1
    setSelectedPairId(null)
    setPairHistory(null)
    setIsLoadingPair(false)
    setTournamentGames(null)
    setIsLoadingTournamentGames(false)
    setTournamentGamesError(null)
  }

  async function analyzeTournament(referenceValue = reference, selectedClassId?: number) {
    const normalizedReference = referenceValue.trim()
    if (!normalizedReference) return

    const requestId = tournamentRequestRef.current + 1
    tournamentRequestRef.current = requestId
    lastAnalyzedReferenceRef.current = normalizedReference
    resetFieldData()
    setIsAnalyzing(true)
    setIsLoadingClass(false)
    setError(null)
    onShareCopied(false)
    clearPairInspection()
    clearPairPreparation()
    onReferenceChange(normalizedReference)
    onLocationChange({ mode: 'tournament', tournament: normalizedReference, classId: selectedClassId })

    try {
      const result = await getTournamentSnapshot(normalizedReference, selectedClassId)
      if (requestId !== tournamentRequestRef.current) return
      trackSuccessfulLookup('tournament')
      setSnapshot(result)
      onLocationChange({ mode: 'tournament', tournament: normalizedReference, classId: result.selectedClass.id })
      setSearchTerm('')
    } catch (caught) {
      if (requestId !== tournamentRequestRef.current) return
      setError(caught instanceof Error ? caught.message : 'The tournament could not be loaded.')
    } finally {
      if (requestId === tournamentRequestRef.current) setIsAnalyzing(false)
    }
  }

  async function chooseClass(classId: number) {
    if (!snapshot) return
    const nextClass = snapshot.classes.find((item) => item.id === classId)
    if (!nextClass || nextClass.id === snapshot.selectedClass.id) return

    const requestId = tournamentRequestRef.current + 1
    tournamentRequestRef.current = requestId
    setIsLoadingClass(true)
    setError(null)

    try {
      const participants = await getClassParticipants(snapshot.tournamentId, classId)
      if (requestId !== tournamentRequestRef.current) return
      setSnapshot((current) => current ? ({ ...current, selectedClass: nextClass, participants }) : current)
      clearPairInspection()
      clearPairPreparation()
      resetFieldData()
      onLocationChange({ mode: 'tournament', tournament: reference, classId: nextClass.id })
    } catch (caught) {
      if (requestId !== tournamentRequestRef.current) return
      setError(caught instanceof Error ? caught.message : 'This class could not be loaded.')
    } finally {
      if (requestId === tournamentRequestRef.current) setIsLoadingClass(false)
    }
  }

  async function inspectPair(pair: PairRecord): Promise<PairHistoryState> {
    const requestId = pairHistoryRequestRef.current + 1
    pairHistoryRequestRef.current = requestId
    setSelectedPairId(pair.id)
    setPairHistory(null)
    setTournamentGames(null)
    setTournamentGamesError(null)
    setIsLoadingTournamentGames(true)
    if (pair.id !== usPairId) {
      setPairPreparation(null)
      setPairPreparationError(null)
    }
    setIsLoadingPair(true)

    const historyPromise = Promise.allSettled([
      getPlayerAnalysis(pair.first.id, historyLimit),
      getPlayerAnalysis(pair.second.id, historyLimit),
    ])
    const gamesPromise = snapshot
      ? getEventMatches(snapshot.tournamentId, snapshot.selectedClass.id, pair.first.id)
      : Promise.resolve([] as MatchRecord[])

    void gamesPromise
      .then((games) => {
        if (requestId === pairHistoryRequestRef.current) {
          setTournamentGames(games.filter((match) => match.partnerId === pair.second.id))
        }
      })
      .catch((caught: unknown) => {
        if (requestId === pairHistoryRequestRef.current) {
          setTournamentGamesError(caught instanceof Error
            ? caught.message
            : 'Games for this pair could not be loaded.')
        }
      })
      .finally(() => {
        if (requestId === pairHistoryRequestRef.current) setIsLoadingTournamentGames(false)
      })

    const [firstResult, secondResult] = await historyPromise
    const nextPairHistory: PairHistoryState = {
      first: firstResult.status === 'fulfilled'
        ? { analysis: { ...firstResult.value, playerName: pair.first.name }, error: null }
        : { analysis: null, error: firstResult.reason instanceof Error ? firstResult.reason.message : 'Player history could not be loaded.' },
      second: secondResult.status === 'fulfilled'
        ? { analysis: { ...secondResult.value, playerName: pair.second.name }, error: null }
        : { analysis: null, error: secondResult.reason instanceof Error ? secondResult.reason.message : 'Player history could not be loaded.' },
    }
    if (requestId === pairHistoryRequestRef.current) {
      setPairHistory(nextPairHistory)
      setIsLoadingPair(false)
    }
    return nextPairHistory
  }

  async function setPairAsUs(pair: PairRecord) {
    if (!snapshot || isLoadingPairPreparation) return

    const requestId = pairPreparationRequestRef.current + 1
    pairPreparationRequestRef.current = requestId
    setUsPairId(pair.id)
    setPairPreparation(null)
    setPairPreparationError(null)
    setIsLoadingPairPreparation(true)

    try {
      let analysis = pairHistory?.first.analysis
      if (!analysis || analysis.playerId !== pair.first.id) {
        const loadedPairHistory = await inspectPair(pair)
        if (requestId !== pairPreparationRequestRef.current) return
        analysis = loadedPairHistory.first.analysis
      }
      if (!analysis || analysis.playerId !== pair.first.id) {
        setPairPreparationError('This pair’s recent history could not be loaded.')
        return
      }
      const recentMatches = await getRecentPlayerMatches(analysis, 5)
      if (requestId !== pairPreparationRequestRef.current) return
      setPairPreparation({
        context: summarizeFieldOpponents(recentMatches.matches, snapshot.participants, pair),
        requestedEvents: recentMatches.requestedEvents,
        failedEvents: recentMatches.failedEvents,
      })
    } catch (caught) {
      if (requestId !== pairPreparationRequestRef.current) return
      setPairPreparationError(caught instanceof Error ? caught.message : 'Recent opponents could not be loaded.')
    } finally {
      if (requestId === pairPreparationRequestRef.current) setIsLoadingPairPreparation(false)
    }
  }

  function clearUsPair() {
    clearPairPreparation()
  }

  function closePairHistory() {
    clearPairInspection()
  }

  function reset() {
    tournamentRequestRef.current += 1
    pairPreparationRequestRef.current += 1
    lastAnalyzedReferenceRef.current = ''
    setSnapshot(null)
    setError(null)
    setSearchTerm('')
    setIsAnalyzing(false)
    setIsLoadingClass(false)
    clearPairInspection()
    resetFieldData()
    clearPairPreparation()
  }

  function suspend() {
    tournamentRequestRef.current += 1
    pairPreparationRequestRef.current += 1
    setIsAnalyzing(false)
    setIsLoadingClass(false)
    setIsLoadingPair(false)
    suspendFieldData()
    setIsLoadingPairPreparation(false)
  }

  const analyzeTournamentRef = useRef(analyzeTournament)
  analyzeTournamentRef.current = analyzeTournament

  useEffect(() => {
    const normalizedReference = reference.trim()
    if (!isActive || !isDirectTournamentReference(normalizedReference)) {
      lastAnalyzedReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedReferenceRef.current) return
      void analyzeTournamentRef.current(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [isActive, reference])

  return {
    ...fieldDataState,
    snapshot,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    isAnalyzing,
    isLoadingClass,
    isLoadingPair,
    tournamentGames,
    isLoadingTournamentGames,
    tournamentGamesError,
    selectedPairId,
    usPairId,
    pairPreparation,
    isLoadingPairPreparation,
    pairPreparationError,
    pairHistory,
    analyzeTournament,
    chooseClass,
    inspectPair,
    setPairAsUs,
    clearUsPair,
    closePairHistory,
    reset,
    suspend,
  }
}
