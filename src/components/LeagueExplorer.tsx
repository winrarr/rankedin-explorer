import { CalendarDays, CircleHelp, GitBranch, LoaderCircle, Trophy, Users } from 'lucide-react'
import type { LeagueFixture, LeagueSnapshot, LeagueStanding } from '../lib/rankedin'
import { formatCompactDate, formatDate, ordinalPosition } from '../lib/formatters'
import { CardHeading } from './CardHeading'
import { MetricCard } from './MetricCard'
import { RankedinLink } from './RankedinLink'

type LeagueExplorerProps = {
  snapshot: LeagueSnapshot
  isLoadingPool: boolean
  onPoolChange: (poolId: number) => void
  onCopyShareLink: () => void
  shareCopied: boolean
  canShare: boolean
}

function fixtureResult(fixture: LeagueFixture) {
  if (!fixture.showResults) return '·'
  if (fixture.team1.isWinner === false && fixture.team2.isWinner === false) return 'D'
  return '✓'
}

function fixtureResultClass(fixture: LeagueFixture) {
  if (!fixture.showResults) return ''
  if (fixture.team1.isWinner === false && fixture.team2.isWinner === false) return 'draw'
  return 'win'
}

function fixtureOpponent(fixture: LeagueFixture) {
  return `${fixture.team1.name} · ${fixture.team2.name}`
}

function standingForTeam(standings: LeagueStanding[], teamId: number) {
  return standings.find((standing) => standing.teamId === teamId) ?? null
}

function LeagueStandingTable({ snapshot }: { snapshot: LeagueSnapshot }) {
  return (
    <div className="table-scroll league-table-scroll">
      <table className="league-standings-table">
        <thead>
          <tr><th>#</th><th>TEAM</th><th>W–L</th><th>POINTS</th><th>DIFF.</th></tr>
        </thead>
        <tbody>
          {snapshot.standings.map((standing) => (
            <tr key={`${standing.teamId}-${standing.teamName}`}>
              <td><strong className={standing.standing === 1 ? 'league-rank-highlight' : ''}>{ordinalPosition(standing.standing)}</strong></td>
              <td>
                <RankedinLink className="league-table-team" path={standing.teamUrl} iconSize={12}>
                  <strong>{standing.teamName}</strong>
                </RankedinLink>
              </td>
              <td>{standing.wins}–{standing.losses}{standing.draws ? `–${standing.draws}` : ''}</td>
              <td><strong>{standing.matchPoints}</strong></td>
              <td>{standing.pointsDifference > 0 ? '+' : ''}{standing.pointsDifference}</td>
            </tr>
          ))}
          {!snapshot.standings.length && <tr><td colSpan={5} className="empty-table">No public standings are available yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function LeagueFixtureList({ snapshot }: { snapshot: LeagueSnapshot }) {
  return (
    <div className="league-explorer-fixture-list">
      {snapshot.fixtures.map((fixture) => (
        <article className="league-explorer-fixture" key={fixture.id}>
          <span className={`league-fixture-result ${fixtureResultClass(fixture)}`}>{fixtureResult(fixture)}</span>
          <div className="league-explorer-fixture-main">
            <div className="league-explorer-fixture-heading">
              <strong>{fixtureOpponent(fixture)}</strong>
              <span>{formatCompactDate(fixture.date)}</span>
            </div>
            <span>{fixture.round ? `Round ${fixture.round}` : 'Round unavailable'} · {fixture.showResults ? `${fixture.team1.score ?? '—'}–${fixture.team2.score ?? '—'}` : 'Result not published'}</span>
          </div>
          <RankedinLink className="league-fixture-source" path={fixture.url} iconSize={14} ariaLabel={`Open fixture ${fixture.id} on Rankedin`} />
        </article>
      ))}
      {!snapshot.fixtures.length && <p className="empty-history">No public fixtures are available for this pool yet.</p>}
    </div>
  )
}

function LeagueTeamGrid({ snapshot }: { snapshot: LeagueSnapshot }) {
  return (
    <div className="league-explorer-team-grid">
      {snapshot.teams.map((team) => {
        const standing = standingForTeam(snapshot.standings, team.id)
        return (
          <article className="league-explorer-team-card" key={team.id}>
            <div className="league-explorer-team-heading">
              <div>
                <RankedinLink path={team.teamUrl} iconSize={12}><strong>{team.name}</strong></RankedinLink>
                <span>{team.homeClubName || 'Club unavailable'}</span>
              </div>
              {standing && <b>{ordinalPosition(standing.standing)} <small>/ {snapshot.standings.length}</small></b>}
            </div>
            <div className="league-explorer-team-players">
              {team.players.map((player) => (
                <RankedinLink path={player.url} showIcon={false} key={player.url}>
                  <span>{player.name}</span>{player.isCaptain && <small>captain</small>}
                </RankedinLink>
              ))}
              {!team.players.length && <span className="muted">No public players listed.</span>}
            </div>
          </article>
        )
      })}
      {!snapshot.teams.length && <p className="empty-history">No public teams are available for this pool yet.</p>}
    </div>
  )
}

export function LeagueExplorer({ snapshot, isLoadingPool, onPoolChange, onCopyShareLink, shareCopied, canShare }: LeagueExplorerProps) {
  const pool = snapshot.selectedPool
  const completedFixtures = snapshot.fixtures.filter((fixture) => fixture.showResults).length

  return (
    <>
      <section className="workspace-heading">
        <div>
          <div className="eyebrow">LUNAR LEAGUE SNAPSHOT <span className="live-dot" /> LIVE DATA</div>
          <h2>{snapshot.name}</h2>
          <p>{snapshot.location}, {snapshot.country} <span className="muted-divider">/</span> {snapshot.sport} <span className="muted-divider">/</span> {formatDate(snapshot.startDate)} – {formatDate(snapshot.endDate)}</p>
          <p className="print-report-meta">Lunar League overview · {pool?.name ?? 'No pool selected'} · Generated {formatDate(new Date().toISOString())} · rankedin.com{snapshot.eventUrl}</p>
        </div>
        <div className="workspace-actions">
          <button className="text-button share-button" type="button" onClick={onCopyShareLink} disabled={!canShare}>
            {shareCopied ? 'Link copied' : 'Copy share link'}
          </button>
          <RankedinLink className="outline-button" path={snapshot.eventUrl} iconSize={15}>Open Lunar League</RankedinLink>
        </div>
      </section>

      <section className="metric-grid" aria-label="League summary">
        <MetricCard dark icon={<GitBranch size={15} />} label="SELECTED POOL" value={pool?.divisionName ?? '—'} detail={pool?.regionName ?? 'No public pool selected'} />
        <MetricCard icon={<Users size={15} />} label="TEAMS IN POOL" value={snapshot.teams.length || pool?.teamCount || '—'} detail={`${snapshot.totalTeamCount || '—'} across league`} />
        <MetricCard icon={<Trophy size={15} />} label="STANDINGS READ" value={snapshot.standings.length || '—'} detail={`${completedFixtures} completed fixtures`} />
        <MetricCard icon={<CalendarDays size={15} />} label="PUBLIC PLAYERS" value={pool?.playerCount || snapshot.totalPlayerCount || '—'} detail={snapshot.clubName ?? 'Club unavailable'} />
      </section>

      <section className="field-card league-selector-card">
        <div className="league-selector-copy">
          <div className="section-kicker">POOL CONTEXT</div>
          <h2>{pool ? `${pool.regionName} · ${pool.divisionName}` : 'Pools are not published yet'}</h2>
          <p>{pool ? 'Standings, fixtures and team members are shown for this pool.' : 'The league header is public, but Rankedin has not published its pools yet.'}</p>
        </div>
        {!!snapshot.pools.length && (
          <label className="league-pool-picker">
            <span>Choose pool</span>
            <select value={pool?.id ?? ''} onChange={(event) => onPoolChange(Number(event.target.value))} disabled={isLoadingPool}>
              {snapshot.pools.map((option) => <option value={option.id} key={option.id}>{option.name}{option.teamCount ? ` · ${option.teamCount} teams` : ''}</option>)}
            </select>
            {isLoadingPool && <LoaderCircle className="picker-loader spin" size={15} />}
          </label>
        )}
      </section>

      {!pool && <div className="league-empty-state"><CircleHelp size={16} /> This league has no public pool data yet.</div>}

      {pool && (
        <>
          <section className="dashboard-grid league-explorer-grid">
            <div className="field-card">
              <CardHeading kicker="TABLE" title="Pool standings" description="Rankedin’s current or final ordering for this pool." icon={<Trophy size={18} className="card-heading-icon" />} />
              <LeagueStandingTable snapshot={snapshot} />
            </div>
            <div className="field-card">
              <CardHeading kicker="FIXTURES" title="Pool schedule" description="Team matches in chronological order." icon={<CalendarDays size={18} className="card-heading-icon" />} />
              <LeagueFixtureList snapshot={snapshot} />
            </div>
          </section>

          <section className="field-card league-teams-card">
            <CardHeading kicker="TEAMS AND PLAYERS" title="Who is in this pool?" description="Team membership is public context. Open a player or team for the source profile." icon={<Users size={18} className="card-heading-icon" />} />
            <LeagueTeamGrid snapshot={snapshot} />
          </section>
        </>
      )}
    </>
  )
}
