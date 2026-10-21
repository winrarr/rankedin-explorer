import {
  ChevronDown,
  History,
  LoaderCircle,
  Search,
} from 'lucide-react'
import type { PairRecord } from '../lib/rankedin'
import type {
  FieldClassSummary,
  FieldLeagueDivisionCount,
} from '../lib/fieldBreakdown'
import {
  FieldClassSummaryGrid,
  FieldLeagueDivisionSummary,
} from './FieldBreakdown'
import { InfoTip } from './InfoTip'
import { TournamentRosterTable } from './TournamentRosterTable'
import type {
  TournamentWorkspaceActions,
  TournamentWorkspaceState,
} from './tournamentTypes'

type TournamentFieldSummary = {
  classTitle: string
  fieldClassSummaries: FieldClassSummary[]
  fieldLeagueSummary: {
    divisions: FieldLeagueDivisionCount[]
    missingCount: number
  }
  isLoadingFieldData: boolean
  visibleParticipants: PairRecord[]
}

type TournamentFieldDashboardProps = {
  state: Pick<TournamentWorkspaceState, 'snapshot' | 'isAnalyzing' | 'isLoadingClass' | 'searchTerm' | 'field' | 'pair'>
  summary: TournamentFieldSummary
  actions: Pick<TournamentWorkspaceActions, 'onChooseClass' | 'onSearchTermChange' | 'onInspectPair' | 'onToggleUsPair'>
}

export function TournamentFieldDashboard({ state, summary, actions }: TournamentFieldDashboardProps) {
  const { snapshot, isAnalyzing, isLoadingClass, searchTerm, field, pair } = state
  const {
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
  } = field
  const {
    classTitle,
    fieldClassSummaries,
    fieldLeagueSummary,
    isLoadingFieldData,
    visibleParticipants,
  } = summary
  const normalizedFieldClassSummaries = fieldClassSummaries.filter((item) => item.kind === 'dpf')
  const otherFieldClassSummaries = fieldClassSummaries.filter((item) => item.kind !== 'dpf')
  const { onChooseClass, onSearchTermChange } = actions

  return (
        <section className="dashboard-grid">
          <div className="field-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">FIELD BREAKDOWN</div>
                <h2>{classTitle}</h2>
                <p>{snapshot.selectedClass.name.includes('(') ? snapshot.selectedClass.name.match(/\(([^)]+)\)/)?.[1] : 'Selected class'}</p>
              </div>
              <div className="field-card-tools">
                <div className={`placement-load-status ${isLoadingFieldData || isLoadingFieldDpfRankings ? 'is-loading' : ''}`} aria-live="polite">
                  {isLoadingFieldData || isLoadingFieldDpfRankings ? <LoaderCircle className="spin" size={14} /> : <History size={14} />}
                  {isLoadingFieldPlacements
                    ? `Reading recent form · ${Object.keys(fieldPlacementSummaries).length}/${snapshot.participants.length * 2} players…`
                    : isLoadingFieldLeagueDivisions
                      ? 'Reading current divisions…'
                      : isLoadingFieldDpfRankings
                        ? `Reading DPF points · ${Object.keys(fieldDpfRankings).length}/${snapshot.participants.length * 2} players…`
                        : fieldDpfRankingsLoaded ? 'Latest 5 + DPF points per player' : fieldPlacementsLoaded ? 'Latest 5 per player' : 'Placement summary unavailable'}
                </div>
                <div className="class-picker-wrap">
                  <select value={snapshot.selectedClass.id} onChange={(event) => onChooseClass(Number(event.target.value))} disabled={isLoadingClass || isAnalyzing} aria-label="Choose tournament class">
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
                    <p>Average of up to five latest finished tournaments for each player <span className="inline-guidance">· higher is better <InfoTip label="About relative finish" message="First place is 100% and last place is 0%, normalized to the field size. Tied placement ranges use their midpoint." /></span></p>
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
              <div className="table-search"><Search size={16} /><input value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} placeholder="Filter players" aria-label="Filter players" /></div>
              <span className="table-count">{visibleParticipants.length} of {snapshot.participants.length} pairs</span>
            </div>

            <TournamentRosterTable
              participants={visibleParticipants}
              field={field}
              pair={pair}
              actions={actions}
            />
          </div>

        </section>
  )
}
