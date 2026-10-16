import { useEffect, useRef, useState } from 'react'
import type { LeagueSearchResult, PlayerSearchResult, TournamentSearchResult } from './lib/rankedin'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences'
import { PlayerProgressWorkspace } from './components/PlayerProgressWorkspace'
import { AppHeader } from './components/AppHeader'
import { TournamentWorkspace } from './components/TournamentWorkspace'
import { LeagueExplorer } from './components/LeagueExplorer'
import { FeedbackDialog } from './components/FeedbackDialog'
import type { WorkspaceMode } from './lib/references'
import { readSharedLocation, updateSharedLocation, type SharedLocation } from './lib/sharedLocation'
import { WorkspaceSearch } from './components/WorkspaceSearch'
import { useTournamentWorkspace } from './hooks/useTournamentWorkspace'
import { usePlayerWorkspace } from './hooks/usePlayerWorkspace'
import { useLeagueWorkspace } from './hooks/useLeagueWorkspace'
import './App.css'

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
  const [shareCopied, setShareCopied] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const player = usePlayerWorkspace({
    reference: playerReference,
    onReferenceChange: setPlayerReference,
    isActive: activeMode === 'player',
    onLocationChange: updateSharedLocation,
    onShareCopied: setShareCopied,
  })
  const {
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
    analyzePlayer,
    reset: resetPlayer,
    suspend: suspendPlayer,
  } = player
  const league = useLeagueWorkspace({
    reference: leagueReference,
    onReferenceChange: setLeagueReference,
    isActive: activeMode === 'league',
    onLocationChange: updateSharedLocation,
    onShareCopied: setShareCopied,
  })
  const {
    leagueSnapshot,
    isAnalyzingLeague,
    isLoadingLeaguePool,
    leagueError,
    setLeagueError,
    analyzeLeague,
    chooseLeaguePool,
    selectLeaguePlayerSearchResult,
    reset: resetLeague,
    suspend: suspendLeague,
  } = league
  const tournament = useTournamentWorkspace({
    reference: tournamentUrl,
    onReferenceChange: setTournamentUrl,
    isActive: activeMode === 'tournament',
    historyLimit: preferences.historyLimit,
    onLocationChange: updateSharedLocation,
    onShareCopied: setShareCopied,
  })
  const {
    snapshot,
    error,
    setError,
    searchTerm,
    setSearchTerm,
    isAnalyzing,
    isLoadingClass,
    isLoadingPair,
    selectedPairId,
    usPairId,
    pairPreparation,
    isLoadingPairPreparation,
    pairPreparationError,
    pairHistory,
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
    analyzeTournament,
    chooseClass,
    inspectPair,
    setPairAsUs,
    clearUsPair,
    closePairHistory,
    reset: resetTournament,
    suspend: suspendTournament,
  } = tournament

  useEffect(() => {
    savePreferences(preferences)
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences])

  const initialAnalysisRef = useRef({ analyzeTournament, analyzePlayer, analyzeLeague })
  initialAnalysisRef.current = { analyzeTournament, analyzePlayer, analyzeLeague }

  useEffect(() => {
    const analysis = initialAnalysisRef.current
    if (initialLocation.mode === 'tournament' && initialLocation.tournamentReference) {
      void analysis.analyzeTournament(initialLocation.tournamentReference, initialLocation.classId)
    }
    if (initialLocation.mode === 'player' && initialLocation.playerReference) {
      void analysis.analyzePlayer(initialLocation.playerReference)
    }
    if (initialLocation.mode === 'league' && initialLocation.leagueReference) {
      void analysis.analyzeLeague(initialLocation.leagueReference, initialLocation.poolId)
    }
  }, [initialLocation])

  function selectPlayerSearchResult(player: PlayerSearchResult) {
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

  function clearReference() {
    if (activeMode === 'tournament') {
      setTournamentUrl('')
      updateSharedLocation({ mode: 'tournament' })
      return
    }

    setPlayerReference('')
    setLeagueReference('')
    if (activeMode === 'league') {
      updateSharedLocation({ mode: 'league' })
      return
    }
    updateSharedLocation({ mode: 'player' })
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

  function printPlayerReport() {
    if (!playerProfile) return
    window.print()
  }

  function resetToHome() {
    resetTournament()
    resetPlayer()
    resetLeague()
    setActiveMode('tournament')
    setTournamentUrl('')
    setPlayerReference('')
    setLeagueReference('')
    setShareCopied(false)
    updateSharedLocation({ mode: 'tournament' })
  }

  function switchMode(nextMode: WorkspaceMode) {
    if (nextMode === activeMode) return

    suspendTournament()
    suspendPlayer()
    suspendLeague()
    setActiveMode(nextMode)
    setError(null)
    setPlayerError(null)
    setPlayerLeagueError(null)
    setLeagueError(null)
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
      <AppHeader
        activeMode={activeMode}
        preferences={preferences}
        onPreferencesChange={setPreferences}
        onReset={resetToHome}
        onModeChange={switchMode}
        onFeedbackClick={() => setIsFeedbackOpen(true)}
      />
      <main>
        <WorkspaceSearch
          mode={activeMode}
          references={{ tournament: tournamentUrl, player: playerReference, league: leagueReference }}
          loading={{ tournament: isAnalyzing, player: isAnalyzingPlayer, league: isAnalyzingLeague }}
          hasPlayerProfile={Boolean(playerProfile)}
          hasLeagueSnapshot={Boolean(leagueSnapshot)}
          errors={{ tournament: error, player: playerError, league: leagueError }}
          onReferenceChange={(mode, value) => {
            if (mode === 'tournament') setTournamentUrl(value)
            else if (mode === 'player') setPlayerReference(value)
            else setLeagueReference(value)
          }}
          onSubmit={(mode) => {
            if (mode === 'tournament') void analyzeTournament()
            else if (mode === 'player') void analyzePlayer()
            else void analyzeLeague()
          }}
          onClearReference={clearReference}
          onSelectTournament={selectTournamentSearchResult}
          onSelectPlayer={selectPlayerSearchResult}
          onSelectLeague={selectLeagueSearchResult}
          onSelectLeaguePlayer={(player) => void selectLeaguePlayerSearchResult(player)}
        />

        {activeMode === 'tournament' && snapshot && (
          <TournamentWorkspace
            state={{
              snapshot,
              tournamentUrl,
              isAnalyzing,
              isLoadingClass,
              searchTerm,
              shareCopied,
              showContext: preferences.showContext,
              field: {
                placementSummaries: fieldPlacementSummaries,
                placementsLoaded: fieldPlacementsLoaded,
                isLoadingPlacements: isLoadingFieldPlacements,
                placementError: fieldPlacementError,
                dpfRankings: fieldDpfRankings,
                dpfRankingsLoaded: fieldDpfRankingsLoaded,
                isLoadingDpfRankings: isLoadingFieldDpfRankings,
                dpfRankingError: fieldDpfRankingError,
                leagueDivisions: fieldLeagueDivisions,
                leagueDivisionsLoaded: fieldLeagueDivisionsLoaded,
                isLoadingLeagueDivisions: isLoadingFieldLeagueDivisions,
                leagueDivisionError: fieldLeagueDivisionError,
              },
              pair: {
                selectedPairId,
                usPairId,
                preparation: pairPreparation,
                isLoadingPreparation: isLoadingPairPreparation,
                preparationError: pairPreparationError,
                history: pairHistory,
                isLoadingHistory: isLoadingPair,
              },
            }}
            actions={{
              onCopyShareLink: () => void copyShareLink(),
              onChooseClass: (classId) => void chooseClass(classId),
              onSearchTermChange: setSearchTerm,
              onInspectPair: (selectedPair) => void inspectPair(selectedPair),
              onToggleUsPair: (selectedPair) => void (usPairId === selectedPair.id
                ? clearUsPair()
                : setPairAsUs(selectedPair)),
              onClosePairHistory: closePairHistory,
            }}
          />
        )}

        {activeMode === 'player' ? (
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
        ) : activeMode === 'league' && leagueSnapshot ? (
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

      <footer className="footer">
        <span>Read-only · Public Rankedin data</span>
        <button className="footer-feedback" type="button" onClick={() => setIsFeedbackOpen(true)}>Send feedback</button>
      </footer>

      <FeedbackDialog
        isOpen={isFeedbackOpen}
        workspace={activeMode}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </div>
  )
}

export default App
