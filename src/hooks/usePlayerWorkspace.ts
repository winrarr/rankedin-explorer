import { useEffect, useRef, useState } from 'react'
import {
  getPlayerDpfRankings,
  getPlayerAnalysis,
  getPlayerLeagueAnalysis,
  getPlayerProfile,
} from '../lib/rankedin'
import type { DpfPlayerRanking, PlayerAnalysis, PlayerLeagueAnalysis, PlayerProfile } from '../lib/rankedin'
import { isDirectPlayerReference } from '../lib/references'
import { trackSuccessfulLookup } from '../lib/analytics'
import type { SharedLocationUpdate } from '../lib/sharedLocation'

const PLAYER_PROGRESS_HISTORY_LIMIT = 25

type UsePlayerWorkspaceOptions = {
  reference: string
  onReferenceChange: (reference: string) => void
  isActive: boolean
  onLocationChange: (location: SharedLocationUpdate) => void
  onShareCopied: (copied: boolean) => void
}

export function usePlayerWorkspace({
  reference,
  onReferenceChange,
  isActive,
  onLocationChange,
  onShareCopied,
}: UsePlayerWorkspaceOptions) {
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [playerAnalysis, setPlayerAnalysis] = useState<PlayerAnalysis | null>(null)
  const [playerDpfRankings, setPlayerDpfRankings] = useState<DpfPlayerRanking[] | null>(null)
  const [isLoadingPlayerDpfRankings, setIsLoadingPlayerDpfRankings] = useState(false)
  const [playerDpfRankingError, setPlayerDpfRankingError] = useState<string | null>(null)
  const [playerLeagueAnalysis, setPlayerLeagueAnalysis] = useState<PlayerLeagueAnalysis | null>(null)
  const [isAnalyzingPlayer, setIsAnalyzingPlayer] = useState(false)
  const [isLoadingLeague, setIsLoadingLeague] = useState(false)
  const [playerLoadingStage, setPlayerLoadingStage] = useState<'profile' | 'history' | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [playerLeagueError, setPlayerLeagueError] = useState<string | null>(null)
  const playerRequestRef = useRef(0)
  const lastAnalyzedReferenceRef = useRef('')

  async function analyzePlayer(referenceValue = reference) {
    const normalizedReference = referenceValue.trim()
    if (!normalizedReference) return

    lastAnalyzedReferenceRef.current = normalizedReference
    const requestId = playerRequestRef.current + 1
    playerRequestRef.current = requestId
    setIsAnalyzingPlayer(true)
    setPlayerLoadingStage('profile')
    setPlayerError(null)
    setPlayerLeagueError(null)
    onShareCopied(false)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerDpfRankings(null)
    setIsLoadingPlayerDpfRankings(false)
    setPlayerDpfRankingError(null)
    setPlayerLeagueAnalysis(null)
    setIsLoadingLeague(false)
    onReferenceChange(normalizedReference)
    onLocationChange({ mode: 'player', player: normalizedReference })

    try {
      const profile = await getPlayerProfile(normalizedReference)
      if (requestId !== playerRequestRef.current) return
      trackSuccessfulLookup('player')
      onLocationChange({ mode: 'player', player: profile.rankedInId })
      setPlayerProfile(profile)
      setPlayerAnalysis({ playerId: profile.id, playerName: profile.name, events: [] })
      setIsLoadingPlayerDpfRankings(true)
      setPlayerLeagueAnalysis({ playerId: profile.id, playerName: profile.name, seasons: [] })
      setIsLoadingLeague(true)
      setPlayerLoadingStage('history')
      void getPlayerDpfRankings(profile)
        .then((rankings) => {
          if (requestId === playerRequestRef.current) setPlayerDpfRankings(rankings)
        })
        .catch(() => {
          if (requestId === playerRequestRef.current) {
            setPlayerDpfRankingError('Current DPF points could not be loaded.')
          }
        })
        .finally(() => {
          if (requestId === playerRequestRef.current) setIsLoadingPlayerDpfRankings(false)
        })

      const [tournamentResult, leagueResult] = await Promise.allSettled([
        getPlayerAnalysis(profile.id, PLAYER_PROGRESS_HISTORY_LIMIT, (event) => {
          if (requestId !== playerRequestRef.current) return
          setPlayerAnalysis((current) => {
            if (!current || current.playerId !== profile.id) return current
            return {
              ...current,
              events: [...current.events, event].sort((first, second) => (
                new Date(second.startDate).getTime() - new Date(first.startDate).getTime()
              )),
            }
          })
        }),
        getPlayerLeagueAnalysis(profile.id, 10, (season) => {
          if (requestId !== playerRequestRef.current) return
          setPlayerLeagueAnalysis((current) => {
            if (!current || current.playerId !== profile.id) return current
            const seasons = [...current.seasons.filter((item) => `${item.id}-${item.teamId}` !== `${season.id}-${season.teamId}`), season]
              .sort((first, second) => new Date(second.startDate).getTime() - new Date(first.startDate).getTime())
            return { ...current, seasons }
          })
        }),
      ])
      if (requestId !== playerRequestRef.current) return
      if (tournamentResult.status === 'fulfilled') {
        setPlayerAnalysis({ ...tournamentResult.value, playerName: profile.name })
      } else {
        setPlayerError(tournamentResult.reason instanceof Error ? tournamentResult.reason.message : 'Tournament history could not be loaded.')
      }
      if (leagueResult.status === 'fulfilled') {
        setPlayerLeagueAnalysis({ ...leagueResult.value, playerName: profile.name })
      } else {
        setPlayerLeagueError('Lunar League history could not be loaded.')
      }
    } catch (caught) {
      if (requestId !== playerRequestRef.current) return
      setPlayerError(caught instanceof Error ? caught.message : 'The player could not be loaded.')
    } finally {
      if (requestId === playerRequestRef.current) {
        setIsLoadingLeague(false)
        setIsAnalyzingPlayer(false)
        setPlayerLoadingStage(null)
      }
    }
  }

  function reset() {
    playerRequestRef.current += 1
    lastAnalyzedReferenceRef.current = ''
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerDpfRankings(null)
    setIsLoadingPlayerDpfRankings(false)
    setPlayerDpfRankingError(null)
    setPlayerLeagueAnalysis(null)
    setIsAnalyzingPlayer(false)
    setIsLoadingLeague(false)
    setPlayerLoadingStage(null)
    setPlayerError(null)
    setPlayerLeagueError(null)
  }

  function suspend() {
    playerRequestRef.current += 1
    setIsAnalyzingPlayer(false)
    setIsLoadingLeague(false)
    setIsLoadingPlayerDpfRankings(false)
    setPlayerLoadingStage(null)
  }

  const analyzePlayerRef = useRef(analyzePlayer)
  analyzePlayerRef.current = analyzePlayer

  useEffect(() => {
    const normalizedReference = reference.trim()
    if (!isActive || !isDirectPlayerReference(normalizedReference)) {
      lastAnalyzedReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedReferenceRef.current) return
      void analyzePlayerRef.current(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [isActive, reference])

  return {
    playerProfile,
    playerAnalysis,
    playerDpfRankings,
    isLoadingPlayerDpfRankings,
    playerDpfRankingError,
    playerLeagueAnalysis,
    isAnalyzingPlayer,
    isLoadingLeague,
    playerLoadingStage,
    playerError,
    setPlayerError,
    playerLeagueError,
    setPlayerLeagueError,
    setPlayerReference: onReferenceChange,
    analyzePlayer,
    reset,
    suspend,
  }
}
