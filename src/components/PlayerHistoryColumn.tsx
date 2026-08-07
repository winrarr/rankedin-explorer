import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  CircleHelp,
  LoaderCircle,
  Search,
} from 'lucide-react'
import {
  getEventMatches,
  getPlayerCurrentLeagueDivision,
  getPlayerProfile,
  type MatchRecord,
  type PlayerAnalysis,
  type PlayerDoublesStats,
  type PlayerEventAnalysis,
  type PlayerLeagueDivision,
  type PlayerRecord,
} from '../lib/rankedin'
import {
  compactClassName,
  formatDate,
  formatRating,
  formatWinLossRecord,
  initials,
  matchRecord,
  placementField,
  placementPosition,
} from '../lib/formatters'

type PlayerHistoryColumnProps = {
  player: PlayerRecord
  analysis: PlayerAnalysis | null
  error: string | null
  isLoading: boolean
  showContext: boolean
}

export function PlayerHistoryColumn({
  player,
  analysis,
  error,
  isLoading,
  showContext,
}: PlayerHistoryColumnProps) {
  const [matchStates, setMatchStates] = useState<Record<number, {
    matches: MatchRecord[] | null
    error: string | null
    isLoading: boolean
  }>>({})
  const [leagueDivision, setLeagueDivision] = useState<PlayerLeagueDivision | null | undefined>(undefined)
  const [isLoadingLeagueDivision, setIsLoadingLeagueDivision] = useState(false)
  const [leagueDivisionError, setLeagueDivisionError] = useState<string | null>(null)
  const [doublesStats, setDoublesStats] = useState<PlayerDoublesStats | null>(null)
  const [isLoadingDoublesStats, setIsLoadingDoublesStats] = useState(false)
  const [doublesStatsError, setDoublesStatsError] = useState<string | null>(null)
  const events = analysis?.events ?? []
  const matches = events.flatMap((event) => matchStates[event.id]?.matches ?? event.matches)
  const record = matchRecord(matches)

  useEffect(() => {
    setMatchStates({})
    setLeagueDivision(undefined)
    setIsLoadingLeagueDivision(false)
    setLeagueDivisionError(null)
    setDoublesStats(null)
    setIsLoadingDoublesStats(false)
    setDoublesStatsError(null)
  }, [analysis?.playerId])

  useEffect(() => {
    if (isLoading || analysis?.playerId === undefined) return
    let disposed = false
    setIsLoadingDoublesStats(true)
    setDoublesStatsError(null)
    void getPlayerProfile(player.rankedInId)
      .then((profile) => {
        if (!disposed) setDoublesStats(profile.doublesStats)
      })
      .catch((caught) => {
        if (!disposed) setDoublesStatsError(caught instanceof Error ? caught.message : 'Win/loss records could not be loaded.')
      })
      .finally(() => {
        if (!disposed) setIsLoadingDoublesStats(false)
      })

    return () => {
      disposed = true
    }
  }, [analysis?.playerId, isLoading, player.rankedInId])

  async function loadLeagueDivision() {
    if (isLoadingLeagueDivision || leagueDivision !== undefined) return

    setIsLoadingLeagueDivision(true)
    setLeagueDivisionError(null)
    try {
      setLeagueDivision(await getPlayerCurrentLeagueDivision(player.id))
    } catch (caught) {
      setLeagueDivisionError(caught instanceof Error ? caught.message : 'The current Lunar League division could not be loaded.')
    } finally {
      setIsLoadingLeagueDivision(false)
    }
  }

  async function loadMatchDetails(event: PlayerEventAnalysis) {
    if (!event.matchQuery || matchStates[event.id]?.isLoading || matchStates[event.id]?.matches) return

    setMatchStates((current) => ({
      ...current,
      [event.id]: { matches: null, error: null, isLoading: true },
    }))

    try {
      const eventMatches = await getEventMatches(
        event.matchQuery.tournamentId,
        event.matchQuery.classId,
        player.id,
      )
      setMatchStates((current) => ({
        ...current,
        [event.id]: { matches: eventMatches, error: null, isLoading: false },
      }))
    } catch (caught) {
      setMatchStates((current) => ({
        ...current,
        [event.id]: {
          matches: null,
          error: caught instanceof Error ? caught.message : 'Match details could not be loaded.',
          isLoading: false,
        },
      }))
    }
  }

  return (
    <section className="player-history-column">
      <div className="player-history-header">
        <div className="avatar">{initials(player.name)}</div>
        <div className="player-history-name">
          <strong>{player.name}</strong>
          <span>Rating at target event: {formatRating(player.rating)}</span>
        </div>
        <a
          className="player-profile-link"
          href={'https://www.rankedin.com' + player.url}
          target="_blank"
          rel="noreferrer"
          aria-label={'Open ' + player.name + ' on Rankedin'}
        >
          <ArrowUpRight size={15} />
        </a>
      </div>

      {isLoading && (
        <div className="loading-state">
          <LoaderCircle className="spin" size={19} /> Reading event history…
        </div>
      )}
      {error && <div className="error-banner small" role="alert"><CircleHelp size={15} /> {error}</div>}

      {!isLoading && analysis && (
        <>
          <section className="player-record-summary" aria-label={'Doubles records for ' + player.name}>
            <div>
              <span>{new Date().getFullYear()} DOUBLES</span>
              <strong>{isLoadingDoublesStats ? <LoaderCircle className="spin record-loading" size={15} aria-label="Reading current-year record" /> : formatWinLossRecord(doublesStats?.currentYear)}</strong>
              <small>current year</small>
            </div>
            <div>
              <span>CAREER DOUBLES</span>
              <strong>{isLoadingDoublesStats ? <LoaderCircle className="spin record-loading" size={15} aria-label="Reading career record" /> : formatWinLossRecord(doublesStats?.career)}</strong>
              <small>total wins–losses</small>
            </div>
          </section>
          {doublesStatsError && <div className="league-membership-status league-membership-error"><CircleHelp size={13} /> {doublesStatsError}</div>}
          <section className="league-membership" aria-label={'Current Lunar League division for ' + player.name}>
            <div className="league-membership-heading">
              <div>
                <div className="section-kicker">CURRENT LUNAR LEAGUE</div>
                <span>Newest division available in the public data</span>
              </div>
              {leagueDivision === undefined && !isLoadingLeagueDivision && (
                <button type="button" onClick={() => void loadLeagueDivision()}>Show division</button>
              )}
            </div>
            {isLoadingLeagueDivision && <div className="league-membership-status"><LoaderCircle className="spin" size={13} /> Reading current division…</div>}
            {leagueDivisionError && <div className="league-membership-status league-membership-error"><CircleHelp size={13} /> {leagueDivisionError}</div>}
            {leagueDivision && <div className="league-membership-list"><div className="league-membership-item"><strong>{leagueDivision.divisionName}</strong><span>current division</span></div></div>}
            {leagueDivision === null && <p className="league-membership-empty">No current Lunar League division found.</p>}
          </section>
          <div className="trace-metrics">
            <div><strong>{events.filter((event) => event.className).length}</strong><span>events found</span></div>
            <div><strong>{matches.length || '—'}</strong><span>matches loaded</span></div>
            <div><strong>{matches.length ? record.wins + '–' + record.losses : '—'}</strong><span>loaded record</span></div>
          </div>

          <div className="placement-list">
            <div className="placement-list-heading">
              <span>FINISHED EVENTS</span>
              <span>LAST {events.length}</span>
            </div>
            {events.map((event) => {
              const eventMatches = matchStates[event.id]?.matches ?? event.matches
              const eventMatchState = matchStates[event.id]
              const eventRecord = matchRecord(eventMatches)
              return (
                <article className="placement-item" key={player.id + '-' + event.id}>
                  <div className="placement-result">
                    <strong>{placementPosition(event)}</strong>
                    <span>{placementField(event)}</span>
                  </div>
                  <div className="placement-event">
                    <div className="placement-event-title">
                      <strong>{event.name}</strong>
                      <span>{formatDate(event.startDate)}</span>
                    </div>
                    <span className="placement-class">{event.className ? compactClassName(event.className) : 'Class result not published'}</span>
                    <span className="placement-partner">
                      {event.partner ? 'With ' + event.partner : 'Partner unavailable'}
                      {eventMatches.length ? ' · ' + eventRecord.wins + '–' + eventRecord.losses + ' in matches' : ''}
                    </span>
                    {event.matchQuery ? (
                      <details className="match-details" open={showContext}>
                        <summary>
                          <span>Explore match details</span>
                          <span>{eventMatches.length ? eventMatches.length + ' ' + (eventMatches.length === 1 ? 'match' : 'matches') : 'load matches'}</span>
                        </summary>
                        {eventMatches.length > 0 ? (
                          <div className="match-details-list">
                            {eventMatches.map((match) => (
                              <div className="match-detail-row" key={match.id}>
                                <span className={'match-result ' + (match.won === true ? 'win' : match.won === false ? 'loss' : '')}>
                                  {match.won === true ? 'W' : match.won === false ? 'L' : '—'}
                                </span>
                                <div className="match-detail-opponent">
                                  <strong>{match.opponents.length ? 'vs ' + match.opponents.join(' + ') : 'Opponent unavailable'}</strong>
                                  <span>{match.draw || match.className}</span>
                                </div>
                                <span className="match-detail-score">{match.score}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="match-loader">
                            {eventMatchState?.error && <span className="match-load-error">{eventMatchState.error}</span>}
                            {!eventMatchState?.error && <span>Match-by-match details are fetched only when requested.</span>}
                            <button type="button" onClick={() => void loadMatchDetails(event)} disabled={eventMatchState?.isLoading}>
                              {eventMatchState?.isLoading ? <LoaderCircle className="spin" size={13} /> : <Search size={13} />}
                              {eventMatchState?.isLoading ? 'Loading…' : 'Load match details'}
                            </button>
                          </div>
                        )}
                      </details>
                    ) : (
                      <span className="placement-partner">No public match details</span>
                    )}
                  </div>
                </article>
              )
            })}
            {!events.length && <p className="empty-history">No finished events were found for this player.</p>}
          </div>
        </>
      )}
    </section>
  )
}
