import { Fragment } from 'react'
import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  History,
  LoaderCircle,
} from 'lucide-react'
import { InfoTip } from './InfoTip'
import type {
  LeagueSeasonAnalysis,
  PlayerAnalysis,
} from '../lib/rankedin'
import {
  dateTimestamp,
  formatCompactDate,
  ordinalPosition,
  placementSummaryPosition,
} from '../lib/formatters'
import { placementGradient } from '../lib/placement'
import { leagueDivisionIndex } from '../lib/fieldBreakdown'
import { LeagueProgressChart } from './LeagueStandingChart'
import { progressPoints } from '../lib/playerProgress'
import { ExplorerPlayerLink } from './ExplorerPlayerLink'

function leagueSeasonMatches(season: LeagueSeasonAnalysis) {
  return season.fixtures.flatMap((fixture) => fixture.matches)
}

function leagueRecord(season: LeagueSeasonAnalysis) {
  const matches = leagueSeasonMatches(season)
  const wins = matches.filter((match) => match.won === true).length
  const losses = matches.filter((match) => match.won === false).length
  return { wins, losses, played: wins + losses }
}

function leagueDateRange(season: LeagueSeasonAnalysis) {
  return `${formatCompactDate(season.startDate)} – ${formatCompactDate(season.endDate)}`
}

function leagueFixtureResultLabel(result: boolean | null) {
  if (result === true) return 'W'
  if (result === false) return 'L'
  return 'D'
}

function leagueFixtureResultClass(result: boolean | null) {
  if (result === true) return 'win'
  if (result === false) return 'loss'
  return 'draw'
}

function orderedLeagueSeasons(seasons: LeagueSeasonAnalysis[]) {
  return [...seasons].sort((first, second) => dateTimestamp(second.startDate) - dateTimestamp(first.startDate))
}

function LeagueSeasonComparison({ seasons }: { seasons: LeagueSeasonAnalysis[] }) {
  const [current, previous] = orderedLeagueSeasons(seasons)
  if (!current || !previous) return null

  const currentDivision = leagueDivisionIndex(current.divisionName)
  const previousDivision = leagueDivisionIndex(previous.divisionName)
  const divisionMovement = currentDivision < previousDivision
    ? 'Moved up a division level'
    : currentDivision > previousDivision
      ? 'Moved down a division level'
      : 'Same division level'
  const standingMovement = current.teamStanding !== null && previous.teamStanding !== null
    ? `${ordinalPosition(previous.teamStanding)} → ${ordinalPosition(current.teamStanding)}`
    : '—'
  const currentFixtures = current.fixtures.filter((fixture) => fixture.won !== null)
  const currentWins = currentFixtures.filter((fixture) => fixture.won === true).length
  const previousFixtures = previous.fixtures.filter((fixture) => fixture.won !== null)
  const previousWins = previousFixtures.filter((fixture) => fixture.won === true).length

  return (
    <section className="field-card league-comparison-card" aria-label="Lunar League season comparison">
      <div className="card-heading">
        <div>
          <h2>Season comparison</h2>
          <p>{current.name} compared with {previous.name}. Division labels remain categorical.</p>
        </div>
        <History size={18} className="card-heading-icon" />
      </div>
      <div className="league-comparison-grid">
        <div><span>DIVISION LEVEL</span><strong>{divisionMovement}</strong><small>{previous.divisionName} → {current.divisionName}</small></div>
        <div><span>TABLE POSITION</span><strong>{standingMovement}</strong><small>previous → latest</small></div>
        <div><span>TEAM FORM</span><strong>{previousWins}–{previousFixtures.length - previousWins} → {currentWins}–{currentFixtures.length - currentWins}</strong><small>wins–losses by season</small></div>
      </div>
    </section>
  )
}

export function PlayerRecentForm({ analysis, seasons }: { analysis: PlayerAnalysis; seasons: LeagueSeasonAnalysis[] }) {
  const tournamentPoints = progressPoints(analysis.events)
    .sort((first, second) => dateTimestamp(second.event.startDate) - dateTimestamp(first.event.startDate))
    .slice(0, 5)
  const latestSeason = orderedLeagueSeasons(seasons)[0]
  const leagueFixtures = latestSeason?.fixtures
    .filter((fixture) => fixture.won !== null)
    .sort((first, second) => dateTimestamp(second.date) - dateTimestamp(first.date))
    .slice(0, 5) ?? []
  if (!tournamentPoints.length && !leagueFixtures.length) return null

  return (
    <section className="field-card recent-form-card" aria-label="Recent form">
      <div className="card-heading">
        <div>
          <h2>Recent form</h2>
        </div>
        <Activity size={18} className="card-heading-icon" />
      </div>
      <div className="recent-form-grid">
        <div className="recent-form-track">
          <span className="recent-form-label">TOURNAMENT FINISHES</span>
          <div className="recent-form-chips">
            {tournamentPoints.map((point) => (
              <span className="recent-form-chip tournament" key={point.event.id} style={placementGradient(point.event)} title={`${formatCompactDate(point.event.startDate)} · ${point.event.name}`}>
                {placementSummaryPosition(point.event)}
              </span>
            ))}
            {!tournamentPoints.length && <span className="recent-form-empty">No comparable finishes</span>}
          </div>
          <small>Higher relative finish is better · newest first</small>
        </div>
        <div className="recent-form-track">
          <span className="recent-form-label">LATEST LEAGUE FIXTURES</span>
          <div className="recent-form-chips">
            {leagueFixtures.map((fixture) => (
              <span className={`recent-form-chip league ${leagueFixtureResultClass(fixture.won)}`} key={fixture.id} title={`${formatCompactDate(fixture.date)} · vs ${fixture.opponentTeam}`}>
                {leagueFixtureResultLabel(fixture.won)}
              </span>
            ))}
            {!leagueFixtures.length && <span className="recent-form-empty">No played league fixtures</span>}
          </div>
          {latestSeason && <small>Newest season · {latestSeason.divisionName}</small>}
        </div>
      </div>
    </section>
  )
}

type LeagueProgressSectionProps = {
  seasons: LeagueSeasonAnalysis[]
  isLoading: boolean
  error: string | null
}

export function LeagueProgressSection({ seasons, isLoading, error }: LeagueProgressSectionProps) {
  if (!seasons.length && !isLoading && !error) return null

  return (
    <section className="field-card league-progress-card" aria-label="Lunar League progress">
      <div className="card-heading">
        <div>
          <h2>Lunar League divisions <InfoTip label="About Lunar League progress" message="Divisions are categorical, not numeric. The chart follows the player's division and team standing across each season." /></h2>
        </div>
      </div>
      {isLoading && !seasons.length && <div className="league-loading"><LoaderCircle className="spin" size={15} /> Reading finished league seasons…</div>}
      {error && <p className="league-error"><CircleHelp size={14} /> {error}</p>}
      {!!seasons.length && (
        <>
          <LeagueSeasonComparison seasons={seasons} />
          <LeagueProgressChart seasons={seasons} />
          <div className="league-season-grid">
            {seasons.map((season) => {
              const record = leagueRecord(season)
              const fixtureWins = season.fixtures.filter((fixture) => fixture.won === true).length
              const fixtureLosses = season.fixtures.filter((fixture) => fixture.won === false).length
              return (
                <article className="league-season-card" key={`${season.id}-${season.teamId}`}>
                  <div className="league-season-card-top">
                    <div>
                      <div className="league-season-name">{season.name}</div>
                      <div className="league-season-division">{season.regionName} · {season.divisionName}</div>
                    </div>
                    <span className="league-season-date">{leagueDateRange(season)}</span>
                  </div>
                  <div className="league-season-card-main">
                    <strong>{season.teamStanding ? ordinalPosition(season.teamStanding) : '—'}</strong>
                    <span>of {season.teamCount ?? '—'} teams</span>
                  </div>
                  <a className="league-team-link" href={`https://www.rankedin.com${season.teamUrl}`} target="_blank" rel="noreferrer">{season.teamName} <ArrowUpRight size={12} /></a>
                  <div className="league-season-stats">
                    <span><strong>{fixtureWins}–{fixtureLosses}</strong><small>team fixtures</small></span>
                    <span><strong>{record.wins}–{record.losses}</strong><small>player doubles</small></span>
                    <span><strong>{season.teamPoints ?? '—'}</strong><small>match points</small></span>
                  </div>
                  <details className="league-fixtures">
                    <summary><span>{season.fixtures.length} team fixtures</span><span>{record.played} individual appearances</span></summary>
                    <div className="league-fixture-list">
                      {season.fixtures.map((fixture) => (
                        <div className="league-fixture" key={fixture.id}>
                          <span className={`league-fixture-result ${fixture.won === true ? 'win' : fixture.won === false ? 'loss' : ''}`}>{fixture.won === true ? 'W' : fixture.won === false ? 'L' : '—'}</span>
                          <div className="league-fixture-main">
                            <span className="league-fixture-info"><strong>{formatCompactDate(fixture.date)} · round {fixture.round ?? '—'}</strong><span>vs {fixture.opponentTeam} · {fixture.teamScore ?? '—'}–{fixture.opponentScore ?? '—'} · {fixture.matches.length} personal {fixture.matches.length === 1 ? 'match' : 'matches'}</span></span>
                            {!!fixture.matches.length && (
                              <details className="league-individual-matches">
                                <summary><span>Individual matches</span><span>{fixture.matches.length}</span></summary>
                                <div className="league-individual-match-list">
                                  {fixture.matches.map((match) => (
                                    <div className="league-individual-match" key={match.id}>
                                      <span className={`league-individual-match-result ${match.won === true ? 'win' : match.won === false ? 'loss' : ''}`}>{match.won === true ? 'W' : match.won === false ? 'L' : '—'}</span>
                                      <div className="league-individual-match-info">
                                        <span>{match.partner ? <>With <ExplorerPlayerLink rankedInId={match.partner.rankedInId} name={match.partner.name}>{match.partner.name}</ExplorerPlayerLink></> : 'Partner unavailable'}</span>
                                        <span>{match.opponents.length ? <>vs {match.opponents.map((opponent, index) => (
                                          <Fragment key={`${opponent.rankedInId ?? opponent.name}-${index}`}>
                                            {index > 0 && ' + '}
                                            <ExplorerPlayerLink rankedInId={opponent.rankedInId} name={opponent.name}>{opponent.name}</ExplorerPlayerLink>
                                          </Fragment>
                                        ))}</> : 'Opponent unavailable'}</span>
                                      </div>
                                      <span className="league-individual-match-score">{match.score}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
