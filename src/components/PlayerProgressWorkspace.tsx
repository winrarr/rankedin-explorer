import { useMemo } from 'react'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleHelp,
  Copy,
  Gauge,
  LoaderCircle,
  Printer,
  Trophy,
  Users,
} from 'lucide-react'
import { MetricCard } from './MetricCard'
import { RankedinLink } from './RankedinLink'
import { LoadingValue } from './LoadingValue'
import { InfoTip } from './InfoTip'
import { LeagueProgressSection, PlayerRecentForm } from './LeagueProgressSection'
import { ExplorerPlayerLink } from './ExplorerPlayerLink'
import { ProgressTimelineChart } from './ProgressTimelineChart'
import { progressSeriesColors } from './playerProgressColors'
import type {
  DpfPlayerRanking,
  PlayerAnalysis,
  PlayerLeagueAnalysis,
  PlayerProfile,
} from '../lib/rankedin'
import {
  formatCompactDate,
  formatDpfPoints,
  placementSummaryPosition,
} from '../lib/formatters'
import {
  formatPercent,
  formatProgressDateRange,
  median,
  progressSeries,
} from '../lib/playerProgress'

type PlayerProgressWorkspaceProps = {
  profile: PlayerProfile | null
  analysis: PlayerAnalysis | null
  dpfRankings: DpfPlayerRanking[] | null
  dpfRankingError: string | null
  isLoadingDpfRankings: boolean
  leagueAnalysis: PlayerLeagueAnalysis | null
  leagueError: string | null
  isLoadingLeague: boolean
  error: string | null
  isLoading: boolean
  loadingStage: 'profile' | 'history' | null
  onCopyShareLink: () => void
  onPrintReport: () => void
  shareCopied: boolean
  canShare: boolean
  canPrintReport: boolean
}

export function PlayerProgressWorkspace({ profile, analysis, dpfRankings, dpfRankingError, isLoadingDpfRankings, leagueAnalysis, leagueError, isLoadingLeague, error, isLoading, loadingStage, onCopyShareLink, onPrintReport, shareCopied, canShare, canPrintReport }: PlayerProgressWorkspaceProps) {
  const series = useMemo(() => progressSeries(analysis?.events ?? []), [analysis])
  const points = useMemo(() => series.flatMap((item) => item.points), [series])
  const latestPoint = [...points].sort((first, second) => (
    new Date(second.event.startDate).getTime() - new Date(first.event.startDate).getTime()
  ))[0]
  const average = points.length ? points.reduce((sum, point) => sum + point.percentage, 0) / points.length : null
  const unavailableCount = analysis ? analysis.events.length - points.length : 0
  const currentDpfRanking = dpfRankings?.[0] ?? null
  const profileContext = profile
    ? [profile.homeClubName, profile.countryCode?.toUpperCase()]
      .filter((value): value is string => Boolean(value))
      .join(' / ')
    : ''

  return (
    <>
      {profile && (
        <section className="workspace-heading">
          <div>
            <h2>{profile.name}</h2>
            {profileContext && <p>{profileContext}</p>}
          </div>
          <div className="workspace-actions">
            <button className="text-button share-button" type="button" onClick={onCopyShareLink} disabled={!canShare}>
              {shareCopied ? <Check size={15} /> : <Copy size={15} />} {shareCopied ? 'Link copied' : 'Copy share link'}
            </button>
            <button className="outline-button report-print-button" type="button" onClick={onPrintReport} disabled={!canPrintReport}>
              <Printer size={14} /> Save PDF
            </button>
            <a className="outline-button" href={`https://www.rankedin.com${profile.url}`} target="_blank" rel="noreferrer">Open profile <ArrowUpRight size={15} /></a>
          </div>
        </section>
      )}

      {error && <div className="error-banner" role="alert"><CircleHelp size={16} /> {error}</div>}

      {isLoading && analysis && (
        <div className="progress-loading-strip" aria-live="polite">
          <LoaderCircle className="spin" size={15} />
          <span>{loadingStage === 'history' ? `Reading history · ${analysis.events.length} tournament results · ${leagueAnalysis?.seasons.length ?? 0} league seasons found so far` : 'Resolving public profile'}</span>
        </div>
      )}

      {analysis && (
        <>
          <section className="metric-grid progress-metric-grid" aria-label="Player progress summary">
            <MetricCard
              dark
              icon={<Activity size={15} />}
              label="CURRENT DPF POINTS"
              value={isLoadingDpfRankings
                ? <LoadingValue />
                : currentDpfRanking
                  ? <RankedinLink
                      className="dpf-points-value-link"
                      path={currentDpfRanking.rankingUrl}
                      showIcon={false}
                      ariaLabel="Open the current official DPF ranking on Rankedin"
                    >{formatDpfPoints(currentDpfRanking.points)}</RankedinLink>
                  : '—'}
              detail={currentDpfRanking
                ? `#${currentDpfRanking.position} · ${currentDpfRanking.ageGroup ?? currentDpfRanking.matchType}${currentDpfRanking.rankingDate ? ` · updated ${formatCompactDate(currentDpfRanking.rankingDate)}` : ''}`
                : isLoadingDpfRankings
                  ? 'official DPF ranking'
                  : dpfRankingError
                    ? 'ranking unavailable'
                    : 'no current DPF rank'}
            />
            <MetricCard icon={<Trophy size={15} />} label="RESULTS CHARTED" value={points.length} detail="finished placements" />
            <MetricCard icon={<Users size={15} />} label="LEVELS IN HISTORY" value={series.length} detail="normalized classes" />
            <MetricCard icon={<Gauge size={15} />} label="AVERAGE RELATIVE FINISH" value={formatPercent(average)} detail="all comparable results" />
            <MetricCard icon={<CalendarDays size={15} />} label="LATEST RELATIVE FINISH" value={latestPoint ? formatPercent(latestPoint.percentage) : '—'} detail={latestPoint ? formatCompactDate(latestPoint.event.startDate) : 'no comparable result'} />
          </section>

          <PlayerRecentForm analysis={analysis} seasons={leagueAnalysis?.seasons ?? []} />

          <section className="field-card progress-card">
            <div className="card-heading">
              <div>
                <h2>Relative finish timeline</h2>
                <p>{formatProgressDateRange(points)} <span className="muted-divider">/</span> each point is one finished tournament <span className="inline-guidance">· higher is better <InfoTip label="About relative finish" message="First place is 100% and last place is 0%, normalized to the field size. Tied placement ranges use their midpoint. Solid lines connect results within the same normalized class; dotted lines show direction only and are not forecasts." /></span></p>
              </div>
            </div>
            <ProgressTimelineChart series={series} />
          </section>

          <LeagueProgressSection
            seasons={leagueAnalysis?.seasons ?? []}
            isLoading={isLoadingLeague}
            error={leagueError}
          />

          <section className="progress-series-grid" aria-label="Progress by level and class">
            {series.map((item, index) => {
              const values = item.points.map((point) => point.percentage)
              const itemAverage = values.reduce((sum, value) => sum + value, 0) / values.length
              const itemMedian = median(values)
              const latest = item.points[item.points.length - 1]
              return (
                <article className="progress-series-card" key={item.className}>
                  <div className="progress-series-title"><span className="progress-legend-dot" style={{ background: progressSeriesColors[index % progressSeriesColors.length] }} /><strong>{item.className}</strong></div>
                  <div className="progress-series-values"><span><strong>{formatPercent(itemAverage)}</strong><small>average</small></span><span><strong>{formatPercent(itemMedian)}</strong><small>median</small></span><span><strong>{formatPercent(latest.percentage)}</strong><small>latest</small></span></div>
                  <span className="progress-series-count">{item.points.length} {item.points.length === 1 ? 'result' : 'results'}</span>
                </article>
              )
            })}
          </section>

          <section className="field-card progress-results-card">
            <div className="card-heading">
              <div>
                <h2>Recent results</h2>
                <p>{points.length} comparable placements <span className="muted-divider">/</span> {formatProgressDateRange(points)}</p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="progress-results-table">
                <thead><tr><th>DATE</th><th>LEVEL / CLASS</th><th>RELATIVE FINISH / PLACEMENT</th><th>PARTNER</th><th>EVENT</th></tr></thead>
                <tbody>
                  {[...points].sort((first, second) => new Date(second.event.startDate).getTime() - new Date(first.event.startDate).getTime()).map((point) => (
                    <tr key={point.event.id}>
                      <td>{formatCompactDate(point.event.startDate)}</td>
                      <td><strong className="progress-result-class">{point.className}</strong><span className="progress-result-raw">{point.event.className}</span></td>
                      <td><strong className="progress-result-placement">{formatPercent(point.percentage)}</strong><span>{placementSummaryPosition(point.event)} of {point.event.fieldSize ?? '—'} pairs</span></td>
                      <td>{point.event.partner ? <ExplorerPlayerLink rankedInId={point.event.partnerRankedInId} name={point.event.partner}>{point.event.partner}</ExplorerPlayerLink> : 'Unavailable'}</td>
                      <td><a className="progress-event-link" href={`https://www.rankedin.com/en/tournament/${point.event.id}`} target="_blank" rel="noreferrer">{point.event.name}<ArrowUpRight size={13} /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unavailableCount > 0 && (
              <p className="progress-chart-note">
                <span>{unavailableCount} event {unavailableCount === 1 ? 'record is' : 'records are'} unavailable <InfoTip label="About unavailable results" message="These events are omitted because Rankedin did not provide a comparable finished placement." /></span>
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}
