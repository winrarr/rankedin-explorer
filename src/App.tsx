import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  History,
  LoaderCircle,
  LineChart,
  Printer,
  Search,
  Settings2,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  getClassParticipants,
  getCurrentPlayerLeague,
  getPlayerDpfRankings,
  getPlayerAnalysis,
  getPlayerCurrentLeagueDivision,
  getPlayerLeagueAnalysis,
  getPlayerProfile,
  getRecentPlayerMatches,
  getLeagueSnapshot,
  searchTeamLeaguesByName,
  searchPlayersByName,
  searchTournamentsByName,
  getTournamentSnapshot,
  type PairRecord,
  type PlayerAnalysis,
  type PlayerEventAnalysis,
  type DpfPlayerRanking,
  type PlayerLeagueAnalysis,
  type PlayerLeagueDivision,
  type LeagueSearchResult,
  type LeagueSnapshot,
  type PlayerProfile,
  type PlayerSearchResult,
  type TournamentSearchResult,
  type TournamentSnapshot,
} from './lib/rankedin'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences'
import { MetricCard } from './components/MetricCard'
import { RankedinLink } from './components/RankedinLink'
import { LoadingValue } from './components/LoadingValue'
import {
  FieldClassSummaryGrid,
  FieldLeagueDivisionSummary,
} from './components/FieldBreakdown'
import { InfoTip } from './components/InfoTip'
import {
  mostCommonRecentClass,
  summarizeFieldPlacements,
  summarizeFieldLeagueDivisions,
} from './lib/fieldBreakdown'
import {
  compactClassName,
  formatCompactDate,
  formatDate,
  formatDpfPoints,
  formatRating,
  placementSummaryPosition,
} from './lib/formatters'
import { placementGradient } from './lib/placement'
import { PlayerProgressWorkspace } from './components/PlayerProgressWorkspace'
import { PlayerHistoryColumn } from './components/PlayerHistoryColumn'
import { LeagueExplorer } from './components/LeagueExplorer'
import { PairUsButton } from './components/PairUsButton'
import { PairPreparationPanel } from './components/PairPreparationPanel'
import { summarizeFieldOpponents, type PairPreparationContext } from './lib/opponentContext'
import { usePublicSearch } from './hooks/usePublicSearch'
import {
  downloadTournamentCsv,
  downloadTournamentJson,
} from './lib/exports'
import './App.css'

const PLAYER_PROGRESS_HISTORY_LIMIT = 25
const FIELD_PLACEMENT_CONCURRENCY = 3
const FIELD_LEAGUE_CONCURRENCY = 6
const FIELD_DPF_CONCURRENCY = 3

type WorkspaceMode = 'tournament' | 'player' | 'league'
type PairPreparationState = {
  context: PairPreparationContext
  requestedEvents: number
  failedEvents: number
}
type PairHistoryState = {
  first: { analysis: PlayerAnalysis | null; error: string | null }
  second: { analysis: PlayerAnalysis | null; error: string | null }
}
type FieldDpfLookup = {
  ranking: DpfPlayerRanking | null
  failed: boolean
}

type SharedLocation = {
  mode: WorkspaceMode
  tournamentReference: string
  classId: number | undefined
  playerReference: string
  leagueReference: string
  poolId: number | undefined
}

function readSharedLocation(): SharedLocation {
  if (typeof window === 'undefined') {
    return { mode: 'tournament', tournamentReference: '', classId: undefined, playerReference: '', leagueReference: '', poolId: undefined }
  }

  const params = new URLSearchParams(window.location.search)
  const tournamentReference = params.get('tournament')?.trim() ?? ''
  const playerReference = params.get('player')?.trim() ?? ''
  const leagueReference = params.get('league')?.trim() ?? ''
  const modeParam = params.get('mode')
  const mode: WorkspaceMode = modeParam === 'league' || (!tournamentReference && !playerReference && leagueReference)
    ? 'league'
    : modeParam === 'player' || (!tournamentReference && playerReference)
      ? 'player'
      : 'tournament'
  const classValue = Number(params.get('class'))
  const poolValue = Number(params.get('pool'))

  return {
    mode,
    tournamentReference,
    classId: Number.isInteger(classValue) && classValue > 0 ? classValue : undefined,
    playerReference,
    leagueReference,
    poolId: Number.isInteger(poolValue) && poolValue > 0 ? poolValue : undefined,
  }
}

function updateSharedLocation({ mode, tournament, classId, player, league, poolId }: {
  mode: WorkspaceMode
  tournament?: string
  classId?: number
  player?: string
  league?: string
  poolId?: number
}) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams()
  if (mode === 'tournament' && tournament?.trim()) {
    params.set('mode', mode)
    params.set('tournament', tournament.trim())
    if (classId) params.set('class', String(classId))
  }
  if (mode === 'player' && player?.trim()) {
    params.set('mode', mode)
    params.set('player', player.trim())
  }
  if (mode === 'league' && league?.trim()) {
    params.set('mode', mode)
    params.set('league', league.trim())
    if (poolId) params.set('pool', String(poolId))
  }

  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}

function isDirectTournamentReference(value: string) {
  const trimmed = value.trim()
  return /^\d{3,}$/.test(trimmed) || /\/tournament\/\d+/i.test(trimmed)
}

function isDirectPlayerReference(value: string) {
  const trimmed = value.trim()
  return /^R\d+$/i.test(trimmed) || /\/player\/R\d+/i.test(trimmed)
}

function isDirectLeagueReference(value: string) {
  const trimmed = value.trim()
  return /^\d{2,}$/.test(trimmed) || /\/teamleague\/\d+/i.test(trimmed)
}

function pairRating(pair: PairRecord) {
  const ratings = [pair.first.rating, pair.second.rating].filter(
    (rating): rating is number => rating !== null,
  )
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null
}

function fieldPlacementEvents(analysis: PlayerAnalysis | null) {
  return analysis?.events.filter((event) => event.className).slice(0, 5) ?? []
}

async function settleWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
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
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

function fieldPlacementSummary(event: PlayerEventAnalysis) {
  return {
    date: formatCompactDate(event.startDate),
    className: compactClassName(event.className),
    position: placementSummaryPosition(event),
    fieldSize: event.fieldSize,
  }
}

function App() {
  const [initialLocation] = useState<SharedLocation>(() => readSharedLocation())
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES
    return loadPreferences()
  })
  const [activeMode, setActiveMode] = useState<WorkspaceMode>(initialLocation.mode)
  const [tournamentUrl, setTournamentUrl] = useState(initialLocation.tournamentReference)
  const [playerReference, setPlayerReference] = useState(initialLocation.playerReference)
  const [leagueReference, setLeagueReference] = useState(initialLocation.leagueReference)
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
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null)
  const [leagueSnapshot, setLeagueSnapshot] = useState<LeagueSnapshot | null>(null)
  const [isAnalyzingLeague, setIsAnalyzingLeague] = useState(false)
  const [isLoadingLeaguePool, setIsLoadingLeaguePool] = useState(false)
  const [leagueError, setLeagueError] = useState<string | null>(null)
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null)
  const [usPairId, setUsPairId] = useState<string | null>(null)
  const [pairPreparation, setPairPreparation] = useState<PairPreparationState | null>(null)
  const [isLoadingPairPreparation, setIsLoadingPairPreparation] = useState(false)
  const [pairPreparationError, setPairPreparationError] = useState<string | null>(null)
  const [pairHistory, setPairHistory] = useState<PairHistoryState | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingClass, setIsLoadingClass] = useState(false)
  const [isLoadingPair, setIsLoadingPair] = useState(false)
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
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)
  const [showTournamentSearch, setShowTournamentSearch] = useState(false)
  const [showLeagueSearch, setShowLeagueSearch] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const fieldPlacementRequestRef = useRef(0)
  const fieldDpfRequestRef = useRef(0)
  const fieldLeagueRequestRef = useRef(0)
  const tournamentRequestRef = useRef(0)
  const playerRequestRef = useRef(0)
  const leagueRequestRef = useRef(0)
  const pairPreparationRequestRef = useRef(0)
  const lastAnalyzedTournamentReferenceRef = useRef('')
  const lastAnalyzedPlayerReferenceRef = useRef('')
  const lastAnalyzedLeagueReferenceRef = useRef('')
  const searchAnchorRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)

  const playerSearch = usePublicSearch({
    enabled: activeMode === 'player' && showPlayerSearch && !isDirectPlayerReference(playerReference),
    term: playerReference,
    label: 'Player',
    search: searchPlayersByName,
  })
  const tournamentSearch = usePublicSearch({
    enabled: activeMode === 'tournament' && showTournamentSearch && !isDirectTournamentReference(tournamentUrl),
    term: tournamentUrl,
    label: 'Tournament',
    search: searchTournamentsByName,
  })
  const leagueSearch = usePublicSearch({
    enabled: activeMode === 'league' && showLeagueSearch && !isDirectLeagueReference(leagueReference),
    term: leagueReference,
    label: 'League',
    search: searchTeamLeaguesByName,
  })
  const leaguePlayerSearch = usePublicSearch({
    enabled: activeMode === 'league' && showLeagueSearch && !isDirectLeagueReference(leagueReference),
    term: leagueReference,
    label: 'Player',
    search: searchPlayersByName,
  })

  useEffect(() => {
    savePreferences(preferences)
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences])

  useEffect(() => {
    if (initialLocation.mode === 'tournament' && initialLocation.tournamentReference) {
      void analyzeTournament(initialLocation.tournamentReference, initialLocation.classId)
    }
    if (initialLocation.mode === 'player' && initialLocation.playerReference) {
      void analyzePlayer(initialLocation.playerReference)
    }
    if (initialLocation.mode === 'league' && initialLocation.leagueReference) {
      void analyzeLeague(initialLocation.leagueReference, initialLocation.poolId)
    }
  }, [initialLocation])

  useEffect(() => {
    function closeSearchMenus(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (!searchAnchorRef.current?.contains(event.target)) {
        setShowPlayerSearch(false)
        setShowTournamentSearch(false)
        setShowLeagueSearch(false)
      }
    }

    document.addEventListener('click', closeSearchMenus)
    return () => document.removeEventListener('click', closeSearchMenus)
  }, [])

  useEffect(() => {
    const normalizedReference = playerReference.trim()
    if (activeMode !== 'player' || !isDirectPlayerReference(normalizedReference)) {
      lastAnalyzedPlayerReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedPlayerReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedPlayerReferenceRef.current) return
      void analyzePlayer(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [activeMode, playerReference])

  useEffect(() => {
    const normalizedReference = tournamentUrl.trim()
    if (activeMode !== 'tournament' || !isDirectTournamentReference(normalizedReference)) {
      lastAnalyzedTournamentReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedTournamentReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedTournamentReferenceRef.current) return
      void analyzeTournament(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [activeMode, tournamentUrl])

  useEffect(() => {
    const normalizedReference = leagueReference.trim()
    if (activeMode !== 'league' || !isDirectLeagueReference(normalizedReference)) {
      lastAnalyzedLeagueReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedLeagueReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedLeagueReferenceRef.current) return
      void analyzeLeague(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [activeMode, leagueReference])

  useEffect(() => {
    if (activeMode !== 'tournament' || !snapshot) return
    void loadFieldPlacements(snapshot.participants)
    void loadFieldDpfRankings(snapshot.participants)
    void loadFieldLeagueDivisions(snapshot.participants)
  }, [activeMode, snapshot])

  const visibleParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return snapshot?.participants ?? []

    return (snapshot?.participants ?? []).filter((pair) =>
      `${pair.first.name} ${pair.second.name}`.toLowerCase().includes(normalizedSearch),
    )
  }, [searchTerm, snapshot])

  const ratings = (snapshot?.participants ?? [])
    .map(pairRating)
    .filter((rating): rating is number => rating !== null)
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null
  const selectedPair = snapshot?.participants.find((pair) => pair.id === selectedPairId)
  const classTitle = snapshot?.selectedClass.name.replace(/\s*\([^)]*\)/, '') ?? ''
  const fieldClassSummaries = useMemo(
    () => summarizeFieldPlacements(fieldPlacementSummaries),
    [fieldPlacementSummaries],
  )
  const normalizedFieldClassSummaries = fieldClassSummaries.filter((summary) => summary.kind === 'dpf')
  const otherFieldClassSummaries = fieldClassSummaries.filter((summary) => summary.kind !== 'dpf')
  const commonRecentClass = useMemo(
    () => mostCommonRecentClass(fieldClassSummaries),
    [fieldClassSummaries],
  )
  const fieldLeagueSummary = useMemo(
    () => summarizeFieldLeagueDivisions(fieldLeagueDivisions),
    [fieldLeagueDivisions],
  )
  const currentLeagueDivisionPlayers = fieldLeagueSummary.divisions.reduce(
    (total, division) => total + division.playerCount,
    0,
  )
  const isLoadingFieldData = isLoadingFieldPlacements || isLoadingFieldLeagueDivisions
  const canExportTournament = Boolean(snapshot && !isAnalyzing)

  function tournamentExportInput() {
    if (!snapshot) return null
    return {
      snapshot,
      averageRating,
      fieldClassSummaries,
      fieldLeagueSummary,
      fieldPlacementSummaries,
      fieldLeagueDivisions,
      fieldPlacementsLoaded,
      fieldLeagueDivisionsLoaded,
    }
  }

  function clearPairPreparation() {
    pairPreparationRequestRef.current += 1
    setUsPairId(null)
    setPairPreparation(null)
    setIsLoadingPairPreparation(false)
    setPairPreparationError(null)
  }

  async function analyzeTournament(reference = tournamentUrl, selectedClassId?: number) {
    const normalizedReference = reference.trim()
    if (!normalizedReference) return

    const requestId = tournamentRequestRef.current + 1
    tournamentRequestRef.current = requestId
    lastAnalyzedTournamentReferenceRef.current = normalizedReference
    setShowTournamentSearch(false)
    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setIsAnalyzing(true)
    setIsLoadingClass(false)
    setError(null)
    setShareCopied(false)
    setSelectedPairId(null)
    setPairHistory(null)
    clearPairPreparation()
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)
    setFieldLeagueDivisionError(null)
    setIsLoadingFieldLeagueDivisions(false)
    setTournamentUrl(normalizedReference)
    updateSharedLocation({ mode: 'tournament', tournament: normalizedReference, classId: selectedClassId })

    try {
      const result = await getTournamentSnapshot(normalizedReference, selectedClassId)
      if (requestId !== tournamentRequestRef.current) return
      setSnapshot(result)
      updateSharedLocation({ mode: 'tournament', tournament: normalizedReference, classId: result.selectedClass.id })
      setSearchTerm('')
    } catch (caught) {
      if (requestId !== tournamentRequestRef.current) return
      setError(caught instanceof Error ? caught.message : 'The tournament could not be loaded.')
    } finally {
      if (requestId === tournamentRequestRef.current) setIsAnalyzing(false)
    }
  }

  async function analyzeLeague(reference = leagueReference, selectedPoolId?: number) {
    const normalizedReference = reference.trim()
    if (!normalizedReference) return

    const requestId = leagueRequestRef.current + 1
    leagueRequestRef.current = requestId
    lastAnalyzedLeagueReferenceRef.current = normalizedReference
    setLeagueReference(normalizedReference)
    setShowLeagueSearch(false)
    setIsAnalyzingLeague(true)
    setIsLoadingLeaguePool(false)
    setLeagueError(null)
    setLeagueSnapshot(null)
    setShareCopied(false)
    updateSharedLocation({ mode: 'league', league: normalizedReference, poolId: selectedPoolId })

    try {
      const result = await getLeagueSnapshot(normalizedReference, selectedPoolId)
      if (requestId !== leagueRequestRef.current) return
      setLeagueSnapshot(result)
      updateSharedLocation({ mode: 'league', league: normalizedReference, poolId: result.selectedPool?.id })
    } catch (caught) {
      if (requestId !== leagueRequestRef.current) return
      setLeagueError(caught instanceof Error ? caught.message : 'The Lunar League could not be loaded.')
    } finally {
      if (requestId === leagueRequestRef.current) setIsAnalyzingLeague(false)
    }
  }

  async function analyzePlayer(reference = playerReference) {
    const normalizedReference = reference.trim()
    if (!normalizedReference) return

    lastAnalyzedPlayerReferenceRef.current = normalizedReference
    const requestId = playerRequestRef.current + 1
    playerRequestRef.current = requestId
    setIsAnalyzingPlayer(true)
    setPlayerLoadingStage('profile')
    setPlayerError(null)
    setPlayerLeagueError(null)
    setShowPlayerSearch(false)
    setShareCopied(false)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerDpfRankings(null)
    setIsLoadingPlayerDpfRankings(false)
    setPlayerDpfRankingError(null)
    setPlayerLeagueAnalysis(null)
    setIsLoadingLeague(false)
    setPlayerReference(normalizedReference)
    updateSharedLocation({ mode: 'player', player: normalizedReference })

    try {
      const profile = await getPlayerProfile(normalizedReference)
      if (requestId !== playerRequestRef.current) return
      updateSharedLocation({ mode: 'player', player: profile.rankedInId })
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

  function selectPlayerSearchResult(player: PlayerSearchResult) {
    setShowPlayerSearch(false)
    setPlayerReference(player.rankedInId)
    void analyzePlayer(player.rankedInId)
  }

  function selectTournamentSearchResult(tournament: TournamentSearchResult) {
    setTournamentUrl(String(tournament.id))
    void analyzeTournament(String(tournament.id))
  }

  function selectLeagueSearchResult(league: LeagueSearchResult) {
    setLeagueReference(String(league.id))
    void analyzeLeague(String(league.id))
  }

  async function selectLeaguePlayerSearchResult(player: PlayerSearchResult) {
    const requestId = leagueRequestRef.current + 1
    leagueRequestRef.current = requestId
    setShowLeagueSearch(false)
    setLeagueReference(player.name)
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
      setLeagueReference(String(league.leagueId))
      await analyzeLeague(String(league.leagueId))
    } catch (caught) {
      if (requestId !== leagueRequestRef.current) return
      setLeagueError(caught instanceof Error ? caught.message : 'The player’s Lunar League could not be found.')
      setIsAnalyzingLeague(false)
    }
  }

  function clearReference() {
    if (activeMode === 'tournament') {
      setTournamentUrl('')
      setShowTournamentSearch(false)
      updateSharedLocation({ mode: 'tournament' })
      return
    }

    setPlayerReference('')
    setLeagueReference('')
    setShowPlayerSearch(false)
    setShowLeagueSearch(false)
    if (activeMode === 'league') {
      updateSharedLocation({ mode: 'league' })
      return
    }
    updateSharedLocation({ mode: 'player' })
  }

  async function chooseLeaguePool(poolId: number) {
    if (!leagueSnapshot || poolId === leagueSnapshot.selectedPool?.id) return
    const requestId = leagueRequestRef.current + 1
    leagueRequestRef.current = requestId
    setIsLoadingLeaguePool(true)
    setLeagueError(null)
    try {
      const result = await getLeagueSnapshot(leagueReference, poolId)
      if (requestId !== leagueRequestRef.current) return
      setLeagueSnapshot(result)
      updateSharedLocation({ mode: 'league', league: leagueReference, poolId: result.selectedPool?.id })
    } catch (caught) {
      if (requestId !== leagueRequestRef.current) return
      setLeagueError(caught instanceof Error ? caught.message : 'This league pool could not be loaded.')
    } finally {
      if (requestId === leagueRequestRef.current) setIsLoadingLeaguePool(false)
    }
  }

  async function copyShareLink() {
    if (typeof window === 'undefined') return

    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 2200)
    } catch {
      const message = 'The share link could not be copied. Copy the address from your browser instead.'
      if (activeMode === 'tournament') setError(message)
      else if (activeMode === 'player') setPlayerError(message)
      else setLeagueError(message)
    }
  }

  function printTournamentReport() {
    if (!canExportTournament) return
    window.print()
  }

  function printPlayerReport() {
    if (!playerProfile) return
    window.print()
  }

  function exportTournamentCsv() {
    const input = tournamentExportInput()
    if (!input || !canExportTournament) return
    downloadTournamentCsv(input)
  }

  function exportTournamentJson() {
    const input = tournamentExportInput()
    if (!input || !canExportTournament) return
    downloadTournamentJson(input)
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
      fieldPlacementRequestRef.current += 1
      fieldLeagueRequestRef.current += 1
      setSnapshot((current) => current ? ({ ...current, selectedClass: nextClass, participants }) : current)
      setSelectedPairId(null)
      setPairHistory(null)
      clearPairPreparation()
      setFieldPlacementSummaries({})
      setFieldPlacementsLoaded(false)
      setFieldPlacementError(null)
      setIsLoadingFieldPlacements(false)
      fieldDpfRequestRef.current += 1
      setFieldDpfRankings({})
      setFieldDpfRankingsLoaded(false)
      setFieldDpfRankingError(null)
      setIsLoadingFieldDpfRankings(false)
      setFieldLeagueDivisions({})
      setFieldLeagueDivisionsLoaded(false)
      setFieldLeagueDivisionError(null)
      setIsLoadingFieldLeagueDivisions(false)
      updateSharedLocation({ mode: 'tournament', tournament: tournamentUrl, classId: nextClass.id })
    } catch (caught) {
      if (requestId !== tournamentRequestRef.current) return
      setError(caught instanceof Error ? caught.message : 'This class could not be loaded.')
    } finally {
      if (requestId === tournamentRequestRef.current) setIsLoadingClass(false)
    }
  }

  async function inspectPair(pair: PairRecord): Promise<PairHistoryState> {
    setSelectedPairId(pair.id)
    setPairHistory(null)
    if (pair.id !== usPairId) {
      setPairPreparation(null)
      setPairPreparationError(null)
    }
    setIsLoadingPair(true)

    const results = await Promise.allSettled([
      getPlayerAnalysis(pair.first.id, preferences.historyLimit),
      getPlayerAnalysis(pair.second.id, preferences.historyLimit),
    ])

    const [firstResult, secondResult] = results
    const nextPairHistory: PairHistoryState = {
      first: firstResult.status === 'fulfilled'
        ? { analysis: { ...firstResult.value, playerName: pair.first.name }, error: null }
        : { analysis: null, error: firstResult.reason instanceof Error ? firstResult.reason.message : 'Player history could not be loaded.' },
      second: secondResult.status === 'fulfilled'
        ? { analysis: { ...secondResult.value, playerName: pair.second.name }, error: null }
        : { analysis: null, error: secondResult.reason instanceof Error ? secondResult.reason.message : 'Player history could not be loaded.' },
    }
    setPairHistory(nextPairHistory)
    setIsLoadingPair(false)
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

  async function loadFieldPlacements(participants: PairRecord[]) {
    const requestId = fieldPlacementRequestRef.current + 1
    fieldPlacementRequestRef.current = requestId
    const players = participants.flatMap((pair) => [pair.first, pair.second])
    setIsLoadingFieldPlacements(true)
    setFieldPlacementError(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)

    const results = await settleWithConcurrency(
      players,
      FIELD_PLACEMENT_CONCURRENCY,
      async (player) => {
        const analysis = await getPlayerAnalysis(player.id, 5, (event) => {
          if (requestId !== fieldPlacementRequestRef.current) return
          setFieldPlacementSummaries((current) => {
            const previous = current[player.id]
            const events = [...(previous?.events ?? []), event].sort((first, second) => (
              new Date(second.startDate).getTime() - new Date(first.startDate).getTime()
            ))
            return {
              ...current,
              [player.id]: {
                playerId: player.id,
                playerName: player.name,
                events,
              },
            }
          })
        })
        if (requestId === fieldPlacementRequestRef.current) {
          setFieldPlacementSummaries((current) => ({
            ...current,
            [player.id]: { ...analysis, playerName: player.name },
          }))
        }
        return { player, analysis }
      },
    )
    let failedCount = 0

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') return
      const player = players[index]
      if (requestId === fieldPlacementRequestRef.current) {
        setFieldPlacementSummaries((current) => ({ ...current, [player.id]: null }))
      }
      failedCount += 1
    })

    if (requestId !== fieldPlacementRequestRef.current) return

    setFieldPlacementsLoaded(true)
    if (failedCount) {
      setFieldPlacementError(`${failedCount} player ${failedCount === 1 ? 'summary was' : 'summaries were'} unavailable.`)
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

  function resetToHome() {
    tournamentRequestRef.current += 1
    playerRequestRef.current += 1
    leagueRequestRef.current += 1
    setActiveMode('tournament')
    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setSnapshot(null)
    setLeagueSnapshot(null)
    setTournamentUrl('')
    setPlayerReference('')
    setLeagueReference('')
    setSelectedPairId(null)
    setPairHistory(null)
    clearPairPreparation()
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)
    setFieldLeagueDivisionError(null)
    setIsLoadingFieldLeagueDivisions(false)
    setIsAnalyzing(false)
    setIsAnalyzingLeague(false)
    setIsLoadingLeaguePool(false)
    setIsLoadingClass(false)
    setIsLoadingPair(false)
    setSearchTerm('')
    setError(null)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerLeagueAnalysis(null)
    setIsLoadingLeague(false)
    setPlayerError(null)
    setPlayerLeagueError(null)
    setIsAnalyzingPlayer(false)
    setPlayerLoadingStage(null)
    setLeagueError(null)
    setShowPlayerSearch(false)
    setShowTournamentSearch(false)
    setShowLeagueSearch(false)
    setShareCopied(false)
    updateSharedLocation({ mode: 'tournament' })
  }

  function switchMode(nextMode: WorkspaceMode) {
    if (nextMode === activeMode) return

    tournamentRequestRef.current += 1
    playerRequestRef.current += 1
    leagueRequestRef.current += 1
    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setIsAnalyzing(false)
    setIsAnalyzingLeague(false)
    setIsLoadingLeaguePool(false)
    setIsLoadingClass(false)
    setIsLoadingPair(false)
    setIsLoadingFieldPlacements(false)
    setIsLoadingFieldLeagueDivisions(false)
    if (nextMode === 'tournament') {
      setIsAnalyzingPlayer(false)
      setPlayerLoadingStage(null)
    }
    setActiveMode(nextMode)
    setShowPlayerSearch(false)
    setShowTournamentSearch(false)
    setShowLeagueSearch(false)
    setError(null)
    setPlayerError(null)
    setPlayerLeagueError(null)
    setShareCopied(false)
    updateSharedLocation({
      mode: nextMode,
      tournament: tournamentUrl,
      classId: snapshot?.selectedClass.id,
      player: playerReference,
      league: leagueReference,
      poolId: leagueSnapshot?.selectedPool?.id,
    })
  }

  return (
    <div className={`app-shell ${preferences.density === 'compact' ? 'density-compact' : ''}`}>
      <header className="topbar">
        <a className="brand" href="." aria-label="Rankedin Explorer home" onClick={(event) => { event.preventDefault(); resetToHome() }}>
          <span className="brand-mark"><Activity size={16} strokeWidth={2.5} /></span>
          <span>rankedin <strong>explorer</strong></span>
        </a>

        <div className="topbar-actions">
          <a className="source-link" href="https://www.rankedin.com" target="_blank" rel="noreferrer" aria-label="Open Rankedin">
            <span className="source-link-label">Rankedin source</span> <ExternalLink size={14} />
          </a>
          <button
            className="icon-button quiet"
            type="button"
            aria-label="Open preferences"
            aria-expanded={showPreferences}
            onClick={() => setShowPreferences((open) => !open)}
          >
            <Settings2 size={18} />
          </button>
        </div>

        {showPreferences && (
          <div className="preferences-popover">
            <div className="popover-heading">
              <div>
                <h3>Preferences</h3>
              </div>
              <button className="icon-button quiet" type="button" aria-label="Close preferences" onClick={() => setShowPreferences(false)}>
                <X size={16} />
              </button>
            </div>
            <label className="preference-row">
              <span>Theme</span>
              <select
                value={preferences.theme}
                onChange={(event) => setPreferences((current) => ({ ...current, theme: event.target.value as Preferences['theme'] }))}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="preference-row">
              <span>Pair history depth</span>
              <select
                value={preferences.historyLimit}
                onChange={(event) => setPreferences((current) => ({ ...current, historyLimit: Number(event.target.value) as Preferences['historyLimit'] }))}
              >
                <option value={5}>5 events</option>
                <option value={10}>10 events</option>
                <option value={25}>25 events</option>
              </select>
            </label>
            <label className="preference-row">
              <span>Table density</span>
              <select
                value={preferences.density}
                onChange={(event) => setPreferences((current) => ({ ...current, density: event.target.value as Preferences['density'] }))}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="preference-row preference-checkbox">
              <span>Open match details by default</span>
              <input
                type="checkbox"
                checked={preferences.showContext}
                onChange={(event) => setPreferences((current) => ({ ...current, showContext: event.target.checked }))}
              />
            </label>
            <p className="popover-note">Tournament and pair choices aren't saved. Player history covers up to 25 finished events.</p>
          </div>
        )}
      </header>

      <nav className="workspace-nav" aria-label="Choose workspace">
        <div className="workspace-nav-inner">
          <div className="workspace-nav-tabs" role="tablist">
            <button
              className={activeMode === 'tournament' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'tournament'}
              onClick={() => switchMode('tournament')}
            >
              <Trophy size={15} /> <span className="workspace-tab-full">Tournament Explorer</span><span className="workspace-tab-short">Tournament</span>
            </button>
            <button
              className={activeMode === 'player' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'player'}
              onClick={() => switchMode('player')}
            >
              <LineChart size={15} /> <span className="workspace-tab-full">Player Progress</span><span className="workspace-tab-short">Player</span>
            </button>
            <button
              className={activeMode === 'league' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'league'}
              onClick={() => switchMode('league')}
            >
              <GitBranch size={15} /> <span className="workspace-tab-full">Lunar League Explorer</span><span className="workspace-tab-short">League</span>
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero-grid">
          <div className="hero-copy">
            <h1>{activeMode === 'tournament' ? 'Explore a tournament' : activeMode === 'player' ? 'Track player progress' : 'Explore a Lunar League'}</h1>

            <div className="input-card">
              <label htmlFor={activeMode === 'tournament' ? 'tournament-url' : activeMode === 'player' ? 'player-reference' : 'league-reference'}>
                {activeMode === 'tournament' ? 'Find a public tournament' : activeMode === 'player' ? 'Find a public player' : 'Find a public Lunar League'}
              </label>
              <div className="reference-search-anchor" ref={searchAnchorRef}>
                <div className="url-input-row">
                  <div className="url-input-wrap">
                    {activeMode === 'tournament' || activeMode === 'league' ? <GitBranch size={17} /> : <Search size={17} />}
                    <input
                      id={activeMode === 'tournament' ? 'tournament-url' : activeMode === 'player' ? 'player-reference' : 'league-reference'}
                      value={activeMode === 'tournament' ? tournamentUrl : activeMode === 'player' ? playerReference : leagueReference}
                      onChange={(event) => {
                        if (activeMode === 'tournament') {
                          setTournamentUrl(event.target.value)
                          setShowTournamentSearch(true)
                        } else if (activeMode === 'player') {
                          setPlayerReference(event.target.value)
                          setShowPlayerSearch(true)
                        } else {
                          setLeagueReference(event.target.value)
                          setShowLeagueSearch(true)
                        }
                      }}
                      onFocus={() => {
                        if (activeMode === 'tournament' && !isDirectTournamentReference(tournamentUrl)) setShowTournamentSearch(true)
                        if (activeMode === 'player') setShowPlayerSearch(true)
                        if (activeMode === 'league' && !isDirectLeagueReference(leagueReference)) setShowLeagueSearch(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (activeMode === 'tournament' || (activeMode === 'player' && isDirectPlayerReference(playerReference)) || (activeMode === 'league' && isDirectLeagueReference(leagueReference)))) {
                          void (activeMode === 'tournament' ? analyzeTournament() : activeMode === 'player' ? analyzePlayer() : analyzeLeague())
                        }
                      }}
                      placeholder={activeMode === 'tournament' ? 'Name, URL or ID' : activeMode === 'player' ? 'Name, URL or R-number' : 'League or player name'}
                    />
                    {(activeMode === 'tournament' ? tournamentUrl : activeMode === 'player' ? playerReference : leagueReference) && <button className="clear-input" type="button" aria-label={`Clear ${activeMode} reference`} onClick={clearReference}><X size={14} /></button>}
                  </div>
                  <button className="primary-button" type="button" onClick={() => void (activeMode === 'tournament' ? analyzeTournament() : activeMode === 'player' ? analyzePlayer() : analyzeLeague())} disabled={activeMode === 'tournament' ? isAnalyzing || !tournamentUrl.trim() : activeMode === 'player' ? isAnalyzingPlayer || !isDirectPlayerReference(playerReference) : isAnalyzingLeague || !isDirectLeagueReference(leagueReference)}>
                    {(activeMode === 'tournament' ? isAnalyzing : activeMode === 'player' ? isAnalyzingPlayer : isAnalyzingLeague) ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                    {(activeMode === 'tournament' ? isAnalyzing : activeMode === 'player' ? isAnalyzingPlayer : isAnalyzingLeague) ? 'Reading…' : activeMode === 'tournament' ? 'Analyze field' : activeMode === 'player' ? 'Read progress' : 'Read league'}
                  </button>
                </div>
                {activeMode === 'tournament' && showTournamentSearch && !isDirectTournamentReference(tournamentUrl) && (
                  <div className="tournament-search-panel" role="status">
                    {tournamentSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin tournaments…</p>}
                    {tournamentSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {tournamentSearch.error}</p>}
                    {!tournamentSearch.isSearching && !tournamentSearch.error && tournamentUrl.trim().length >= 2 && !tournamentSearch.results.length && <p className="player-search-status">No public tournaments matched that name.</p>}
                    {!!tournamentSearch.results.length && (
                      <div className="tournament-search-results" role="listbox" aria-label="Tournament search results">
                        {tournamentSearch.results.map((tournament) => (
                          <button className="tournament-search-result" type="button" role="option" key={`${tournament.id}-${tournament.startDate}`} onClick={() => selectTournamentSearchResult(tournament)}>
                            <span className="tournament-search-result-name">{tournament.name}</span>
                            <span className="tournament-search-result-meta">{tournament.startDate || 'Date unavailable'} · {tournament.sport ?? 'Sport unavailable'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeMode === 'player' && showPlayerSearch && !isDirectPlayerReference(playerReference) && (
                  <div className="player-search-panel">
                    {playerSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin profiles…</p>}
                    {playerSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {playerSearch.error}</p>}
                    {!playerSearch.isSearching && !playerSearch.error && playerReference.trim().length >= 2 && !isDirectPlayerReference(playerReference) && !playerSearch.results.length && <p className="player-search-status">No public players matched that name.</p>}
                    {!!playerSearch.results.length && (
                      <div className="player-search-results" role="listbox" aria-label="Player search results">
                        {playerSearch.results.map((player) => (
                          <button className="player-search-result" type="button" role="option" key={player.rankedInId} onClick={() => selectPlayerSearchResult(player)}>
                            <span className="player-search-result-name">{player.name}</span>
                            <span className="player-search-result-id">{player.rankedInId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeMode === 'league' && showLeagueSearch && !isDirectLeagueReference(leagueReference) && (
                  <div className="tournament-search-panel" role="status">
                    {leagueSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching Lunar Leagues…</p>}
                    {leagueSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {leagueSearch.error}</p>}
                    {leaguePlayerSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching player names…</p>}
                    {leaguePlayerSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {leaguePlayerSearch.error}</p>}
                    {!leagueSearch.isSearching && !leagueSearch.error && !leaguePlayerSearch.isSearching && !leaguePlayerSearch.results.length && leagueReference.trim().length >= 2 && !leagueSearch.results.length && <p className="player-search-status">No public Lunar Leagues matched that name.</p>}
                    {!!leagueSearch.results.length && (
                      <div className="tournament-search-results" role="listbox" aria-label="Lunar League search results">
                        {leagueSearch.results.map((league) => (
                          <button className="tournament-search-result" type="button" role="option" key={`${league.id}-${league.startDate}`} onClick={() => selectLeagueSearchResult(league)}>
                            <span className="tournament-search-result-name">{league.name}</span>
                            <span className="tournament-search-result-meta">{league.startDate || 'Date unavailable'} · {league.sport ?? 'Sport unavailable'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!!leaguePlayerSearch.results.length && (
                      <>
                        <div className="search-section-label">FIND A LUNAR LEAGUE BY PLAYER</div>
                        <div className="player-search-results" role="listbox" aria-label="Players with Lunar League history">
                          {leaguePlayerSearch.results.map((player) => (
                            <button className="player-search-result" type="button" role="option" key={player.rankedInId} onClick={() => void selectLeaguePlayerSearchResult(player)}>
                              <span className="player-search-result-name">{player.name}</span>
                              <span className="player-search-result-id">Find current Lunar League</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {((activeMode === 'tournament' && isAnalyzing) || (activeMode === 'player' && isAnalyzingPlayer && !playerProfile) || (activeMode === 'league' && isAnalyzingLeague && !leagueSnapshot)) && (
                <div className="lookup-loading-state" role="status" aria-live="polite">
                  <LoaderCircle className="spin" size={16} />
                  <div className="lookup-loading-copy">
                    <strong>{activeMode === 'tournament' ? 'Loading tournament field' : activeMode === 'player' ? 'Finding public profile' : 'Loading Lunar League'}</strong>
                  </div>
                </div>
              )}
            </div>
            {(activeMode === 'tournament' ? error : activeMode === 'player' ? playerError : leagueError) && <div className="error-banner" role="alert"><CircleHelp size={16} /> {activeMode === 'tournament' ? error : activeMode === 'player' ? playerError : leagueError}</div>}
          </div>

        </section>

        {activeMode === 'tournament' ? (
          snapshot ? (
          <>
            <section className="workspace-heading">
          <div>
            <div className="eyebrow">CURRENT FIELD</div>
            <h2>{snapshot.name}</h2>
            <p>{snapshot.location}, {snapshot.country} <span className="muted-divider">/</span> {snapshot.sport} <span className="muted-divider">/</span> {formatDate(snapshot.startDate)}</p>
            <p className="print-report-meta">Tournament overview · {classTitle} · Generated {formatDate(new Date().toISOString())} · rankedin.com/en/tournament/{snapshot.tournamentId}</p>
          </div>
          <div className="workspace-actions">
            <button className="text-button share-button" type="button" onClick={() => void copyShareLink()} disabled={!tournamentUrl.trim()}>
              {shareCopied ? <Check size={15} /> : <Copy size={15} />} {shareCopied ? 'Link copied' : 'Copy share link'}
            </button>
            <details className="export-menu">
              <summary className="outline-button export-menu-summary"><Download size={14} /> Save overview</summary>
              <div className="export-menu-panel" aria-label="Export tournament overview">
                <button className="export-menu-item" type="button" onClick={printTournamentReport} disabled={!canExportTournament}>
                  <Printer size={14} /> Print / save PDF
                </button>
                <button className="export-menu-item" type="button" onClick={exportTournamentCsv} disabled={!canExportTournament}>
                  <FileSpreadsheet size={14} /> Download CSV
                </button>
                <button className="export-menu-item" type="button" onClick={exportTournamentJson} disabled={!canExportTournament}>
                  <FileJson size={14} /> Download JSON
                </button>
              </div>
            </details>
            <a className="outline-button" href={`https://www.rankedin.com/en/tournament/${snapshot.tournamentId}`} target="_blank" rel="noreferrer">Open event <ArrowUpRight size={15} /></a>
          </div>
        </section>

        <section className="metric-grid" aria-label="Field summary">
          <MetricCard dark icon={<Users size={15} />} label="REGISTERED IN CLASS" value={snapshot.participants.length * 2} detail={`players / ${snapshot.participants.length} pairs`} />
          <MetricCard icon={<Gauge size={15} />} label="AVERAGE SKILL" value={formatRating(averageRating)} detail="historical rating at entry" />
          <MetricCard
            icon={<GitBranch size={15} />}
            label="CURRENT LUNAR LEAGUE"
            value={fieldLeagueDivisionsLoaded
              ? `${currentLeagueDivisionPlayers} / ${snapshot.participants.length * 2}`
              : isLoadingFieldLeagueDivisions ? <LoadingValue /> : '—'}
            detail="players with a current division"
          />
          <MetricCard
            icon={<History size={15} />}
            label="MOST COMMON RECENT CLASS"
            value={commonRecentClass?.className ?? (isLoadingFieldPlacements ? <LoadingValue /> : '—')}
            detail={commonRecentClass
              ? `${Math.round(commonRecentClass.averageRelativeFinish * 100)}% average relative finish · ${commonRecentClass.playerCount} players`
              : 'latest five form results'}
          />
        </section>

        <section className="dashboard-grid">
          <div className="field-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">FIELD BREAKDOWN</div>
                <h2>{classTitle}</h2>
                <p>{snapshot.selectedClass.name.includes('(') ? snapshot.selectedClass.name.match(/\(([^)]+)\)/)?.[1] : 'Selected class'} <span className="muted-divider">/</span> {snapshot.participants.length} pairs visible</p>
              </div>
              <div className="field-card-tools">
                <div className={`placement-load-status ${isLoadingFieldData || isLoadingFieldDpfRankings ? 'is-loading' : ''}`} aria-live="polite">
                  {isLoadingFieldData || isLoadingFieldDpfRankings ? <LoaderCircle className="spin" size={14} /> : <History size={14} />}
                  {isLoadingFieldPlacements
                    ? `Reading latest 5 · ${Object.keys(fieldPlacementSummaries).length}/${snapshot.participants.length * 2} players…`
                    : isLoadingFieldLeagueDivisions
                      ? 'Reading current divisions…'
                      : isLoadingFieldDpfRankings
                        ? `Reading DPF points · ${Object.keys(fieldDpfRankings).length}/${snapshot.participants.length * 2} players…`
                        : fieldDpfRankingsLoaded ? 'Latest 5 + DPF points per player' : fieldPlacementsLoaded ? 'Latest 5 per player' : 'Placement summary unavailable'}
                </div>
                <div className="class-picker-wrap">
                  <select value={snapshot.selectedClass.id} onChange={(event) => void chooseClass(Number(event.target.value))} disabled={isLoadingClass || isAnalyzing} aria-label="Choose tournament class">
                    {snapshot.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  {isLoadingClass ? <LoaderCircle className="picker-loader spin" size={15} /> : <ChevronDown className="picker-chevron" size={15} />}
                </div>
                {fieldPlacementError && <span className="placement-load-note">{fieldPlacementError}</span>}
                {fieldDpfRankingError && <span className="placement-load-note">{fieldDpfRankingError}</span>}
                {fieldLeagueDivisionError && <span className="placement-load-note">{fieldLeagueDivisionError}</span>}
              </div>
            </div>

            {(fieldPlacementsLoaded || Object.keys(fieldPlacementSummaries).length > 0) && (
              <section className="field-aggregate" aria-label="Average recent relative finish by class">
                <div className="field-aggregate-heading">
                  <div>
                    <div className="section-kicker">RECENT FORM BY CLASS</div>
                    <p>Average of the latest five finished tournaments for each player <span className="inline-guidance">· higher is better <InfoTip label="About relative finish" message="First place is 100% and last place is 0%, normalized to the field size. Tied placement ranges use their midpoint." /></span></p>
                  </div>
                </div>
                {fieldClassSummaries.length ? (
                  <>
                    {!!normalizedFieldClassSummaries.length && (
                      <FieldClassSummaryGrid summaries={normalizedFieldClassSummaries} />
                    )}
                    {!!otherFieldClassSummaries.length && (
                      <div className="field-aggregate-other">
                        <div className="field-aggregate-other-heading">
                          <div className="section-kicker">OTHER / UNCLASSIFIED CLASSES</div>
                        </div>
                        <FieldClassSummaryGrid summaries={otherFieldClassSummaries} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="field-aggregate-empty">No comparable finished placements were found yet.</p>
                )}
              </section>
            )}

            {(fieldLeagueDivisionsLoaded || Object.keys(fieldLeagueDivisions).length > 0) && (
              <section className="field-aggregate league-field-summary" aria-label="Current Lunar League divisions">
                <div className="field-aggregate-heading">
                  <div>
                    <div className="section-kicker">CURRENT LUNAR LEAGUE</div>
                  </div>
                </div>
                <FieldLeagueDivisionSummary
                  divisions={fieldLeagueSummary.divisions}
                  missingCount={fieldLeagueSummary.missingCount}
                  totalPlayers={snapshot.participants.length * 2}
                />
              </section>
            )}

            <div className="table-toolbar">
              <div className="table-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Filter players" aria-label="Filter players" /></div>
              <span className="table-count">{visibleParticipants.length} of {snapshot.participants.length} pairs</span>
            </div>

            <div className="table-scroll roster-table-scroll">
              <table className="roster-table">
                <thead><tr><th>PAIR</th><th><span className="table-header-with-info">LAST 5 / PLAYER / DPF POINTS <InfoTip label="About DPF points" message="Current points in the official Dansk Padel Forbund ranking. Select a player’s points to open the Rankedin ranking." /></span></th><th><span className="table-header-with-info">SKILL <InfoTip label="About skill" message="Historical rating shown at tournament start, not a live rating." /></span></th></tr></thead>
                <tbody>
                  {visibleParticipants.map((pair, index) => {
                    const rating = pairRating(pair)
                    const selected = pair.id === selectedPairId
                    return (
                      <tr
                        className={selected ? 'selected-row' : ''}
                        key={pair.id}
                        tabIndex={0}
                        aria-label={`View history for ${pair.first.name} and ${pair.second.name}`}
                        onClick={() => void inspectPair(pair)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void inspectPair(pair)
                          }
                        }}
                      >
                        <td>
                          <div className="pair-cell">
                            <span className="pair-index">{String(index + 1).padStart(2, '0')}</span>
                            <div>
                              <strong>{pair.first.name}</strong>
                              <span>{pair.second.name}</span>
                              <PairUsButton
                                pair={pair}
                                selected={pair.id === usPairId}
                                isLoading={isLoadingPairPreparation && pair.id === usPairId}
                                disabled={isLoadingPairPreparation || (selected && isLoadingPair && !pairHistory?.first.analysis)}
                                onToggle={() => pair.id === usPairId ? clearUsPair() : void setPairAsUs(pair)}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="field-placement-cell">
                            {[pair.first, pair.second].map((player) => {
                              const summary = fieldPlacementSummaries[player.id]
                              const hasSummary = Object.prototype.hasOwnProperty.call(fieldPlacementSummaries, player.id)
                              const dpfLookup = fieldDpfRankings[player.id]
                              const dpfRanking = dpfLookup?.ranking ?? null
                              const events = fieldPlacementEvents(summary ?? null)
                              return (
                                <div className="field-placement-player" key={player.id}>
                                  <div className="field-placement-player-name">
                                    <span className="field-placement-name">{player.name}</span>
                                    {dpfRanking ? (
                                      <RankedinLink
                                        className="field-dpf-summary"
                                        path={dpfRanking.rankingUrl}
                                        showIcon={false}
                                        ariaLabel={`${player.name}: ${formatDpfPoints(dpfRanking.points)} current DPF points, rank ${dpfRanking.position} · ${dpfRanking.ageGroup ?? dpfRanking.matchType}${dpfRanking.rankingDate ? ` · updated ${formatCompactDate(dpfRanking.rankingDate)}` : ''}`}
                                      >DPF {formatDpfPoints(dpfRanking.points)}</RankedinLink>
                                    ) : (
                                      <span className="field-dpf-summary field-dpf-summary-muted">
                                        {!dpfLookup && isLoadingFieldDpfRankings
                                          ? 'DPF points…'
                                          : dpfLookup?.failed ? 'DPF unavailable' : 'No current DPF points'}
                                      </span>
                                    )}
                                  </div>
                                  <span className="field-placement-tags">
                                    {!hasSummary && isLoadingFieldPlacements && <span className="field-placement-muted loading-inline"><LoaderCircle className="spin" size={11} aria-hidden="true" /> Reading…</span>}
                                    {!hasSummary && !isLoadingFieldPlacements && !fieldPlacementsLoaded && <span className="field-placement-muted">Not loaded</span>}
                                    {hasSummary && summary === null && <span className="field-placement-muted">Unavailable</span>}
                                    {hasSummary && summary && !events.length && <span className="field-placement-muted">No finished events</span>}
                                    {events.map((event) => {
                                      const placement = fieldPlacementSummary(event)
                                      return (
                                        <div
                                          className="field-placement-tag"
                                          key={`${player.id}-${event.id}`}
                                          style={placementGradient(event)}
                                          title={`${event.name} · ${event.className ?? 'Class unavailable'}`}
                                        >
                                          <span className="field-placement-date">{placement.date}</span>
                                          <span className="field-placement-class">{placement.className}</span>
                                          <strong className="field-placement-result">{placement.position}</strong>
                                          {placement.fieldSize && <span className="field-placement-field">of <span className="field-placement-field-count">{placement.fieldSize}</span> pairs</span>}
                                        </div>
                                      )
                                    })}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                        <td><span className="rating-value">{formatRating(rating)}</span><span className="rating-caption">avg. start</span></td>
                      </tr>
                    )
                  })}
                  {!visibleParticipants.length && <tr><td colSpan={3} className="empty-table">No pairs match that search.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </section>

        {selectedPair && (
          <section className="history-card pair-history-panel" aria-label={`Pair history for ${selectedPair.first.name} and ${selectedPair.second.name}`}>
            <div className="card-heading card-heading-small">
              <div>
                <div className="section-kicker">PAIR HISTORY</div>
                <h2>{selectedPair.first.name} + {selectedPair.second.name}</h2>
              </div>
              <div className="pair-history-actions">
                <PairUsButton
                  pair={selectedPair}
                  selected={usPairId === selectedPair.id}
                  isLoading={isLoadingPairPreparation && usPairId === selectedPair.id}
                  disabled={isLoadingPairPreparation || (!pairHistory?.first.analysis && isLoadingPair)}
                  onToggle={() => usPairId === selectedPair.id ? clearUsPair() : void setPairAsUs(selectedPair)}
                />
                <button className="icon-button quiet" type="button" onClick={() => { setSelectedPairId(null); setPairHistory(null) }} aria-label="Close pair history"><X size={17} /></button>
              </div>
            </div>

            <div className="pair-history-grid">
              <PlayerHistoryColumn
                player={selectedPair.first}
                analysis={pairHistory?.first.analysis ?? null}
                error={pairHistory?.first.error ?? null}
                isLoading={isLoadingPair}
                showContext={preferences.showContext}
              />
              <PlayerHistoryColumn
                player={selectedPair.second}
                analysis={pairHistory?.second.analysis ?? null}
                error={pairHistory?.second.error ?? null}
                isLoading={isLoadingPair}
                showContext={preferences.showContext}
              />
            </div>
            {usPairId === selectedPair.id && (
              <PairPreparationPanel
                pair={selectedPair}
                context={pairPreparation?.context ?? null}
                isLoading={isLoadingPairPreparation}
                error={pairPreparationError}
                requestedEvents={pairPreparation?.requestedEvents ?? 0}
                failedEvents={pairPreparation?.failedEvents ?? 0}
              />
            )}
          </section>
        )}

          </>
          ) : null
        ) : activeMode === 'player' ? (
          <PlayerProgressWorkspace
            profile={playerProfile}
            analysis={playerAnalysis}
            dpfRankings={playerDpfRankings}
            dpfRankingError={playerDpfRankingError}
            isLoadingDpfRankings={isLoadingPlayerDpfRankings}
            leagueAnalysis={playerLeagueAnalysis}
            leagueError={playerLeagueError}
            isLoadingLeague={isLoadingLeague}
            error={playerError}
            isLoading={isAnalyzingPlayer}
            loadingStage={playerLoadingStage}
            onCopyShareLink={() => void copyShareLink()}
            onPrintReport={printPlayerReport}
            shareCopied={shareCopied}
            canShare={Boolean(playerProfile && playerReference.trim())}
            canPrintReport={Boolean(playerProfile)}
          />
        ) : leagueSnapshot ? (
          <LeagueExplorer
            snapshot={leagueSnapshot}
            isLoadingPool={isLoadingLeaguePool}
            onPoolChange={(poolId) => void chooseLeaguePool(poolId)}
            onCopyShareLink={() => void copyShareLink()}
            shareCopied={shareCopied}
            canShare={Boolean(leagueReference.trim())}
          />
        ) : null}
      </main>

      <footer className="footer">Read-only · Public Rankedin data</footer>
    </div>
  )
}

export default App
