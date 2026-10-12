import { useEffect, useRef, useState } from 'react'
import {
  getCurrentPlayerLeague,
  getLeagueSnapshot,
} from '../lib/rankedin'
import type { LeagueSnapshot, PlayerSearchResult } from '../lib/rankedin'
import { isDirectLeagueReference } from '../lib/references'
import type { SharedLocationUpdate } from '../lib/sharedLocation'

type UseLeagueWorkspaceOptions = {
  reference: string
  onReferenceChange: (reference: string) => void
  isActive: boolean
  onLocationChange: (location: SharedLocationUpdate) => void
  onShareCopied: (copied: boolean) => void
}

export function useLeagueWorkspace({
  reference,
  onReferenceChange,
  isActive,
  onLocationChange,
  onShareCopied,
}: UseLeagueWorkspaceOptions) {
  const [leagueSnapshot, setLeagueSnapshot] = useState<LeagueSnapshot | null>(null)
  const [isAnalyzingLeague, setIsAnalyzingLeague] = useState(false)
  const [isLoadingLeaguePool, setIsLoadingLeaguePool] = useState(false)
  const [leagueError, setLeagueError] = useState<string | null>(null)
  const leagueRequestRef = useRef(0)
  const lastAnalyzedReferenceRef = useRef('')

  async function analyzeLeague(referenceValue = reference, selectedPoolId?: number) {
    const normalizedReference = referenceValue.trim()
    if (!normalizedReference) return

    const requestId = leagueRequestRef.current + 1
    leagueRequestRef.current = requestId
    lastAnalyzedReferenceRef.current = normalizedReference
    onReferenceChange(normalizedReference)
    setIsAnalyzingLeague(true)
    setIsLoadingLeaguePool(false)
    setLeagueError(null)
    setLeagueSnapshot(null)
    onShareCopied(false)
    onLocationChange({ mode: 'league', league: normalizedReference, poolId: selectedPoolId })

    try {
      const result = await getLeagueSnapshot(normalizedReference, selectedPoolId)
      if (requestId !== leagueRequestRef.current) return
      setLeagueSnapshot(result)
      onLocationChange({ mode: 'league', league: normalizedReference, poolId: result.selectedPool?.id })
    } catch (caught) {
      if (requestId !== leagueRequestRef.current) return
      setLeagueError(caught instanceof Error ? caught.message : 'The Lunar League could not be loaded.')
    } finally {
      if (requestId === leagueRequestRef.current) setIsAnalyzingLeague(false)
    }
  }
  async function selectLeaguePlayerSearchResult(player: PlayerSearchResult) {
    const requestId = leagueRequestRef.current + 1
    leagueRequestRef.current = requestId
    onReferenceChange(player.name)
    setLeagueSnapshot(null)
    setLeagueError(null)
    setIsAnalyzingLeague(true)

    try {
      const league = await getCurrentPlayerLeague(player.id)
      if (requestId !== leagueRequestRef.current) return
      if (!league) {
        setLeagueError('No public Lunar League was found for ' + player.name + '. Try the league name or another player.')
        setIsAnalyzingLeague(false)
        return
      }
      onReferenceChange(String(league.leagueId))
      await analyzeLeague(String(league.leagueId))
    } catch (caught) {
      if (requestId !== leagueRequestRef.current) return
      setLeagueError(caught instanceof Error ? caught.message : 'The player’s Lunar League could not be found.')
      setIsAnalyzingLeague(false)
    }
  }
  async function chooseLeaguePool(poolId: number) {
    if (!leagueSnapshot || poolId === leagueSnapshot.selectedPool?.id) return
    const requestId = leagueRequestRef.current + 1
    leagueRequestRef.current = requestId
    setIsLoadingLeaguePool(true)
    setLeagueError(null)
    try {
      const result = await getLeagueSnapshot(reference, poolId)
      if (requestId !== leagueRequestRef.current) return
      setLeagueSnapshot(result)
      onLocationChange({ mode: 'league', league: reference, poolId: result.selectedPool?.id })
    } catch (caught) {
      if (requestId !== leagueRequestRef.current) return
      setLeagueError(caught instanceof Error ? caught.message : 'This league pool could not be loaded.')
    } finally {
      if (requestId === leagueRequestRef.current) setIsLoadingLeaguePool(false)
    }
  }

  function reset() {
    leagueRequestRef.current += 1
    lastAnalyzedReferenceRef.current = ''
    setLeagueSnapshot(null)
    setIsAnalyzingLeague(false)
    setIsLoadingLeaguePool(false)
    setLeagueError(null)
  }

  function suspend() {
    leagueRequestRef.current += 1
    setIsAnalyzingLeague(false)
    setIsLoadingLeaguePool(false)
  }

  const analyzeLeagueRef = useRef(analyzeLeague)
  analyzeLeagueRef.current = analyzeLeague

  useEffect(() => {
    const normalizedReference = reference.trim()
    if (!isActive || !isDirectLeagueReference(normalizedReference)) {
      lastAnalyzedReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedReferenceRef.current) return
      void analyzeLeagueRef.current(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [isActive, reference])

  return {
    leagueSnapshot,
    isAnalyzingLeague,
    isLoadingLeaguePool,
    leagueError,
    setLeagueError,
    setLeagueReference: onReferenceChange,
    analyzeLeague,
    chooseLeaguePool,
    selectLeaguePlayerSearchResult,
    reset,
    suspend,
  }
}
