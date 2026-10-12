import { LoaderCircle } from 'lucide-react'
import type {
  PairRecord,
  PlayerAnalysis,
  PlayerEventAnalysis,
} from '../lib/rankedin'
import { InfoTip } from './InfoTip'
import { PairUsButton } from './PairUsButton'
import { RankedinLink } from './RankedinLink'
import {
  compactClassName,
  formatCompactDate,
  formatDpfPoints,
  formatRating,
  placementSummaryPosition,
} from '../lib/formatters'
import { placementGradient } from '../lib/placement'
import type {
  TournamentWorkspaceActions,
  TournamentWorkspaceFieldState,
  TournamentWorkspacePairState,
} from './tournamentTypes'

type TournamentRosterTableProps = {
  participants: PairRecord[]
  field: TournamentWorkspaceFieldState
  pair: TournamentWorkspacePairState
  actions: Pick<TournamentWorkspaceActions, 'onInspectPair' | 'onToggleUsPair'>
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

function fieldPlacementSummary(event: PlayerEventAnalysis) {
  return {
    date: formatCompactDate(event.startDate),
    className: compactClassName(event.className),
    position: placementSummaryPosition(event),
    fieldSize: event.fieldSize,
  }
}

export function TournamentRosterTable({ participants, field, pair, actions }: TournamentRosterTableProps) {
  const fieldPlacementSummaries = field.placementSummaries
  const fieldDpfRankings = field.dpfRankings
  const isLoadingFieldDpfRankings = field.isLoadingDpfRankings
  const isLoadingFieldPlacements = field.isLoadingPlacements
  const fieldPlacementsLoaded = field.placementsLoaded
  const {
    selectedPairId,
    usPairId,
    isLoadingPreparation: isLoadingPairPreparation,
    history: pairHistory,
    isLoadingHistory: isLoadingPair,
  } = pair
  const { onInspectPair, onToggleUsPair } = actions

  return (
            <div className="table-scroll roster-table-scroll">
              <table className="roster-table">
                <thead><tr><th>PAIR</th><th><span className="table-header-with-info">LAST 5 / PLAYER / DPF POINTS <InfoTip label="About DPF points" message="Current points in the official Dansk Padel Forbund ranking. Select a player’s points to open the Rankedin ranking." /></span></th><th><span className="table-header-with-info">SKILL <InfoTip label="About skill" message="Historical rating shown at tournament start, not a live rating." /></span></th></tr></thead>
                <tbody>
                  {participants.map((pair, index) => {
                    const rating = pairRating(pair)
                    const selected = pair.id === selectedPairId
                    return (
                      <tr
                        className={selected ? 'selected-row' : ''}
                        key={pair.id}
                        tabIndex={0}
                        aria-label={`View history for ${pair.first.name} and ${pair.second.name}`}
                        onClick={() => onInspectPair(pair)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onInspectPair(pair)
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
                                onToggle={() => onToggleUsPair(pair)}
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
                  {!participants.length && <tr><td colSpan={3} className="empty-table">No pairs match that search.</td></tr>}
                </tbody>
              </table>
            </div>
  )
}
