import { useMemo } from 'react'
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  History,
  Printer,
  Users,
} from 'lucide-react'
import { LoadingValue } from './LoadingValue'
import { MetricCard } from './MetricCard'
import {
  mostCommonRecentClass,
  summarizeFieldLeagueDivisions,
  summarizeFieldPlacements,
} from '../lib/fieldBreakdown'
import { formatDate, formatRating } from '../lib/formatters'
import type { TournamentSnapshot } from '../lib/rankedin'
import { TournamentPairHistory } from './TournamentPairHistory'
import { TournamentFieldDashboard } from './TournamentFieldDashboard'
import {
  downloadTournamentCsv,
  downloadTournamentJson,
} from '../lib/exports'
import type {
  TournamentWorkspaceActions,
  TournamentWorkspaceState,
} from './tournamentTypes'

type TournamentWorkspaceProps = {
  state: TournamentWorkspaceState
  actions: TournamentWorkspaceActions
}

function averageTournamentRating(snapshot: TournamentSnapshot) {
  const ratings = snapshot.participants
    .flatMap((pair) => [pair.first.rating, pair.second.rating])
    .filter((rating): rating is number => rating !== null)
  return ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null
}

export function TournamentWorkspace({ state, actions }: TournamentWorkspaceProps) {
  const {
    snapshot,
    tournamentUrl,
    isAnalyzing,
    searchTerm,
    shareCopied,
    showContext,
    field,
    pair,
  } = state
  const {
    placementSummaries: fieldPlacementSummaries,
    placementsLoaded: fieldPlacementsLoaded,
    isLoadingPlacements: isLoadingFieldPlacements,
    leagueDivisions: fieldLeagueDivisions,
    leagueDivisionsLoaded: fieldLeagueDivisionsLoaded,
    isLoadingLeagueDivisions: isLoadingFieldLeagueDivisions,
  } = field
  const { selectedPairId } = pair
  const { onCopyShareLink } = actions
  const averageRating = averageTournamentRating(snapshot)
  const selectedPair = snapshot.participants.find((item) => item.id === selectedPairId)
  const classTitle = snapshot.selectedClass.name.replace(/\s*\([^)]*\)/, '')
  const fieldClassSummaries = useMemo(
    () => summarizeFieldPlacements(fieldPlacementSummaries),
    [fieldPlacementSummaries],
  )
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
  const canExportTournament = !isAnalyzing
  const visibleParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return snapshot.participants

    return snapshot.participants.filter((item) =>
      `${item.first.name} ${item.second.name}`.toLowerCase().includes(normalizedSearch),
    )
  }, [searchTerm, snapshot])

  function tournamentExportInput() {
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

  function printTournamentReport() {
    if (!canExportTournament) return
    window.print()
  }

  function exportTournamentCsv() {
    if (!canExportTournament) return
    downloadTournamentCsv(tournamentExportInput())
  }

  function exportTournamentJson() {
    if (!canExportTournament) return
    downloadTournamentJson(tournamentExportInput())
  }

  return (
    <>
            <section className="workspace-heading">
          <div>
            <div className="eyebrow">CURRENT FIELD</div>
            <h2>{snapshot.name}</h2>
            <p>{snapshot.location}, {snapshot.country} <span className="muted-divider">/</span> {snapshot.sport} <span className="muted-divider">/</span> {formatDate(snapshot.startDate)}</p>
            <p className="print-report-meta">Tournament overview · {classTitle} · Generated {formatDate(new Date().toISOString())} · rankedin.com/en/tournament/{snapshot.tournamentId}</p>
          </div>
          <div className="workspace-actions">
            <button className="text-button share-button" type="button" onClick={onCopyShareLink} disabled={!tournamentUrl.trim()}>
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

        <TournamentFieldDashboard
          state={state}
          summary={{
            classTitle,
            fieldClassSummaries,
            fieldLeagueSummary,
            isLoadingFieldData,
            visibleParticipants,
          }}
          actions={actions}
        />

        <TournamentPairHistory
          selectedPair={selectedPair}
          state={pair}
          showContext={showContext}
          onToggleUsPair={actions.onToggleUsPair}
          onClose={actions.onClosePairHistory}
        />

    </>
  )
}
