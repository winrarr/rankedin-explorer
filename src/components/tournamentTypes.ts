import type {
  DpfPlayerRanking,
  PairRecord,
  PlayerAnalysis,
  PlayerLeagueDivision,
  TournamentSnapshot,
} from '../lib/rankedin'
import type { PairPreparationContext } from '../lib/opponentContext'

export type FieldDpfLookup = {
  ranking: DpfPlayerRanking | null
  failed: boolean
}

export type PairPreparationState = {
  context: PairPreparationContext
  requestedEvents: number
  failedEvents: number
}

export type PairHistoryState = {
  first: { analysis: PlayerAnalysis | null; error: string | null }
  second: { analysis: PlayerAnalysis | null; error: string | null }
}

export type TournamentWorkspaceFieldState = {
  placementSummaries: Record<number, PlayerAnalysis | null>
  placementsLoaded: boolean
  isLoadingPlacements: boolean
  placementError: string | null
  dpfRankings: Record<number, FieldDpfLookup>
  dpfRankingsLoaded: boolean
  isLoadingDpfRankings: boolean
  dpfRankingError: string | null
  leagueDivisions: Record<number, PlayerLeagueDivision | null>
  leagueDivisionsLoaded: boolean
  isLoadingLeagueDivisions: boolean
  leagueDivisionError: string | null
}

export type TournamentWorkspacePairState = {
  selectedPairId: string | null
  usPairId: string | null
  preparation: PairPreparationState | null
  isLoadingPreparation: boolean
  preparationError: string | null
  history: PairHistoryState | null
  isLoadingHistory: boolean
}

export type TournamentWorkspaceState = {
  snapshot: TournamentSnapshot
  tournamentUrl: string
  isAnalyzing: boolean
  isLoadingClass: boolean
  searchTerm: string
  shareCopied: boolean
  showContext: boolean
  field: TournamentWorkspaceFieldState
  pair: TournamentWorkspacePairState
}

export type TournamentWorkspaceActions = {
  onCopyShareLink: () => void
  onChooseClass: (classId: number) => void
  onSearchTermChange: (value: string) => void
  onInspectPair: (pair: PairRecord) => void
  onToggleUsPair: (pair: PairRecord) => void
  onClosePairHistory: () => void
}
