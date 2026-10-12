import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleHelp,
  Copy,
  Gauge,
  History,
  LoaderCircle,
  Printer,
  Trophy,
  Users,
} from 'lucide-react'
import { MetricCard } from './MetricCard'
import { RankedinLink } from './RankedinLink'
import { LoadingValue } from './LoadingValue'
import { InfoTip } from './InfoTip'
import type {
  DpfPlayerRanking,
  LeagueSeasonAnalysis,
  LeagueStandingSnapshot,
  PlayerAnalysis,
  PlayerEventAnalysis,
  PlayerLeagueAnalysis,
  PlayerProfile,
} from '../lib/rankedin'
import {
  compactClassName,
  dateTimestamp,
  formatCompactDate,
  formatDate,
  formatDpfPoints,
  ordinalPosition,
  placementSummaryPosition,
} from '../lib/formatters'
import { placementGradient, relativeFinishPercent } from '../lib/placement'
import { leagueDivisionIndex, leagueDivisionScale } from '../lib/fieldBreakdown'

type ProgressPoint = {
  event: PlayerEventAnalysis
  className: string
  percentage: number
}

type ProgressSeries = {
  className: string
  points: ProgressPoint[]
}

type ProgressRegression = {
  startTimestamp: number
  endTimestamp: number
  startPercentage: number
  endPercentage: number
}

const progressSeriesColors = ['var(--sage)', 'var(--blue)', 'var(--coral)', 'var(--chart-4)', 'var(--chart-5)']

function progressPoints(events: PlayerEventAnalysis[]) {
  return events
    .map((event): ProgressPoint | null => {
      const percentage = relativeFinishPercent(event)
      if (percentage === null || !event.className) return null
      return { event, className: compactClassName(event.className), percentage }
    })
    .filter((point): point is ProgressPoint => point !== null)
}

function progressSeries(events: PlayerEventAnalysis[]) {
  const groups = new Map<string, ProgressPoint[]>()

  progressPoints(events).forEach((point) => {
    const points = groups.get(point.className) ?? []
    points.push(point)
    groups.set(point.className, points)
  })

  return Array.from(groups, ([className, points]): ProgressSeries => ({
    className,
    points: points.sort((first, second) => (
      new Date(first.event.startDate).getTime() - new Date(second.event.startDate).getTime()
    )),
  })).sort((first, second) => first.className.localeCompare(second.className))
}

function progressRegression(points: ProgressPoint[]): ProgressRegression | null {
  const datedPoints = points
    .map((point) => ({
      timestamp: new Date(point.event.startDate).getTime(),
      percentage: point.percentage,
    }))
    .filter((point) => !Number.isNaN(point.timestamp))
  if (datedPoints.length < 2) return null

  const startTimestamp = Math.min(...datedPoints.map((point) => point.timestamp))
  const endTimestamp = Math.max(...datedPoints.map((point) => point.timestamp))
  const timeSpan = Math.max(endTimestamp - startTimestamp, 1)
  const normalizedPoints = datedPoints.map((point) => ({
    x: (point.timestamp - startTimestamp) / timeSpan,
    y: point.percentage,
  }))
  const meanX = normalizedPoints.reduce((sum, point) => sum + point.x, 0) / normalizedPoints.length
  const meanY = normalizedPoints.reduce((sum, point) => sum + point.y, 0) / normalizedPoints.length
  const denominator = normalizedPoints.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0)
  const slope = denominator
    ? normalizedPoints.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator
    : 0
  const predict = (x: number) => Math.min(1, Math.max(0, meanY + slope * (x - meanX)))

  return {
    startTimestamp,
    endTimestamp,
    startPercentage: predict(0),
    endPercentage: predict(1),
  }
}

function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function formatChartDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(date)
}

function formatProgressDateRange(points: ProgressPoint[]) {
  if (!points.length) return 'No completed results'
  const dates = points
    .map((point) => new Date(point.event.startDate).getTime())
    .filter((value) => !Number.isNaN(value))
  if (!dates.length) return 'Date range unavailable'
  return `${formatChartDate(new Date(Math.min(...dates)).toISOString())} – ${formatChartDate(new Date(Math.max(...dates)).toISOString())}`
}

type ProgressChartProps = {
  series: ProgressSeries[]
}

function ProgressChart({ series }: ProgressChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({})
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 620)
  const visibleSeries = series.filter((item) => !hiddenSeries[item.className])
  const points = visibleSeries.flatMap((item) => item.points)
  const chartWidth = isCompact ? 520 : 900
  const chartHeight = 360
  const chartTop = 22
  const chartRight = 28
  const chartBottom = 48
  const chartLeft = 58
  const plotWidth = chartWidth - chartLeft - chartRight
  const plotHeight = chartHeight - chartTop - chartBottom
  const timestamps = points
    .map((point) => new Date(point.event.startDate).getTime())
    .filter((value) => !Number.isNaN(value))
  const rawStart = timestamps.length ? Math.min(...timestamps) : Date.now()
  const rawEnd = timestamps.length ? Math.max(...timestamps) : Date.now()
  const padding = rawStart === rawEnd ? 1000 * 60 * 60 * 24 * 30 : 0
  const start = rawStart - padding
  const end = rawEnd + padding
  const range = Math.max(end - start, 1)
  const xPosition = (value: string) => chartLeft + ((new Date(value).getTime() - start) / range) * plotWidth
  const yPosition = (value: number) => chartTop + (1 - value) * plotHeight
  const yTicks = [0, .25, .5, .75, 1]
  const xTicks = [0, .5, 1]

  useEffect(() => {
    function updateChartWidth() {
      setIsCompact(window.innerWidth <= 620)
    }

    window.addEventListener('resize', updateChartWidth)
    return () => window.removeEventListener('resize', updateChartWidth)
  }, [])

  function toggleSeries(className: string) {
    setHiddenSeries((current) => {
      const visibleCount = series.filter((item) => !current[item.className]).length
      if (visibleCount === series.length) {
        return Object.fromEntries(series.map((item) => [item.className, item.className !== className]))
      }
      if (visibleCount === 1 && !current[className]) return {}
      return { ...current, [className]: !current[className] }
    })
  }

  return (
    <div className="progress-chart">
      <div className="progress-legend" aria-label="Chart series">
        {series.map((item, index) => (
          <button
            className={`progress-legend-item ${hiddenSeries[item.className] ? 'is-hidden' : ''}`}
            type="button"
            key={item.className}
            onClick={() => toggleSeries(item.className)}
            aria-pressed={!hiddenSeries[item.className]}
          >
            <span className="progress-legend-dot" style={{ background: progressSeriesColors[index % progressSeriesColors.length] }} />
            {item.className}
            <small>{item.points.length}</small>
          </button>
        ))}
      </div>
      {!points.length ? (
        <div className="progress-chart-empty">Select a class above to show its results.</div>
      ) : (
        <svg className="progress-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Relative finish timeline, higher percentages are better">
          <title>Relative finish across finished tournaments</title>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="progress-grid-line" x1={chartLeft} x2={chartWidth - chartRight} y1={yPosition(tick)} y2={yPosition(tick)} />
              <text className="progress-axis-label" x={chartLeft - 11} y={yPosition(tick) + 3} textAnchor="end">{Math.round(tick * 100)}%</text>
            </g>
          ))}
          {xTicks.map((tick) => {
            const timestamp = start + (end - start) * tick
            return <text className="progress-axis-label" key={tick} x={chartLeft + plotWidth * tick} y={chartHeight - 15} textAnchor={tick === 0 ? 'start' : tick === 1 ? 'end' : 'middle'}>{formatChartDate(new Date(timestamp).toISOString())}</text>
          })}
          <line className="progress-axis-line" x1={chartLeft} x2={chartLeft} y1={chartTop} y2={chartHeight - chartBottom} />
          <line className="progress-axis-line" x1={chartLeft} x2={chartWidth - chartRight} y1={chartHeight - chartBottom} y2={chartHeight - chartBottom} />
          {visibleSeries.map((item) => {
            const color = progressSeriesColors[series.indexOf(item) % progressSeriesColors.length]
            const linePoints = item.points.map((point) => `${xPosition(point.event.startDate)},${yPosition(point.percentage)}`).join(' ')
            const regression = progressRegression(item.points)
            return (
              <g key={item.className}>
                {regression && (
                  <line
                    className="progress-regression-line"
                    x1={chartLeft + ((regression.startTimestamp - start) / range) * plotWidth}
                    x2={chartLeft + ((regression.endTimestamp - start) / range) * plotWidth}
                    y1={yPosition(regression.startPercentage)}
                    y2={yPosition(regression.endPercentage)}
                    stroke={color}
                  />
                )}
                {item.points.length > 1 && <polyline className="progress-series-line" points={linePoints} stroke={color} />}
                {item.points.map((point) => (
                  <circle
                    className="progress-series-point"
                    cx={xPosition(point.event.startDate)}
                    cy={yPosition(point.percentage)}
                    fill={color}
                    key={point.event.id}
                    r="5"
                  >
                    <title>{`${formatDate(point.event.startDate)} · ${point.className} · ${placementSummaryPosition(point.event)} of ${point.event.fieldSize ?? '—'} pairs · ${formatPercent(point.percentage)} relative finish · ${point.event.name}`}</title>
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

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

type LeagueProgressChartProps = {
  seasons: LeagueSeasonAnalysis[]
}

type LeagueTimeScale = {
  chartWidth: number
  chartLeft: number
  chartRight: number
  plotWidth: number
}

function leagueTimeScale(chartWidth: number): LeagueTimeScale {
  const chartLeft = 90
  const chartRight = 18
  return {
    chartWidth,
    chartLeft,
    chartRight,
    plotWidth: chartWidth - chartLeft - chartRight,
  }
}

function leagueResultLabel(result: LeagueStandingSnapshot['result']) {
  if (result === 'win') return 'W'
  if (result === 'loss') return 'L'
  if (result === 'draw') return 'D'
  return '—'
}

function leagueResultColor(result: LeagueStandingSnapshot['result']) {
  if (result === 'win') return '#587866'
  if (result === 'loss') return '#d56e59'
  if (result === 'draw') return '#b28745'
  return '#8d9994'
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

function PlayerRecentForm({ analysis, seasons }: { analysis: PlayerAnalysis; seasons: LeagueSeasonAnalysis[] }) {
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

function leagueSeasonAxisLabel(season: LeagueSeasonAnalysis) {
  const seasonLabel = season.name.match(/(?:Forår|Efterår|Spring|Autumn)\s+\d{4}/i)
  return seasonLabel?.[0] ?? formatCompactDate(season.startDate)
}

function LeagueCombinedChart({ seasons, scale }: LeagueProgressChartProps & { scale: LeagueTimeScale }) {
  const chartTop = 28
  const chartBottom = 48
  const rankInset = 14
  const activeDivisionIndices = seasons.map((season) => leagueDivisionIndex(season.divisionName))
  const firstVisibleDivision = Math.min(...activeDivisionIndices)
  const lastVisibleDivision = Math.max(...activeDivisionIndices)
  const visibleDivisions = leagueDivisionScale.slice(firstVisibleDivision, lastVisibleDivision + 1)
  const maxTeamCount = Math.max(
    ...seasons.map((season) => season.teamCount ?? Math.max(...season.standingHistory.map((point) => point.teamCount), 1)),
    1,
  )
  const divisionHeight = Math.max(160, maxTeamCount * 28)
  const chartHeight = chartTop + visibleDivisions.length * divisionHeight + chartBottom
  const divisionTop = (divisionName: string) => chartTop + (leagueDivisionIndex(divisionName) - firstVisibleDivision) * divisionHeight
  const standingPosition = (divisionName: string, standing: number, teamCount: number) => {
    const firstPlace = divisionTop(divisionName) + rankInset
    const lastPlace = divisionTop(divisionName) + divisionHeight - rankInset
    const progress = teamCount > 1 ? (standing - 1) / (teamCount - 1) : .5
    return firstPlace + (lastPlace - firstPlace) * progress
  }
  const orderedSeasons = [...seasons].sort((first, second) => dateTimestamp(first.startDate) - dateTimestamp(second.startDate))
  const seasonGap = Math.min(28, Math.max(16, scale.plotWidth * .04))
  const seasonWidth = (scale.plotWidth - seasonGap * Math.max(orderedSeasons.length - 1, 0)) / Math.max(orderedSeasons.length, 1)
  const seasonSlots = orderedSeasons.map((season, seasonIndex) => {
    const points = [...season.standingHistory].sort((first, second) => dateTimestamp(first.date) - dateTimestamp(second.date))
    return {
      season,
      startDate: points[0]?.date ?? season.startDate,
      endDate: points.at(-1)?.date ?? season.endDate,
      x: scale.chartLeft + seasonIndex * (seasonWidth + seasonGap),
      width: seasonWidth,
    }
  })
  const seasonXPosition = (slot: typeof seasonSlots[number], value: string) => {
    const start = dateTimestamp(slot.startDate)
    const end = dateTimestamp(slot.endDate)
    const duration = Math.max(end - start, 1)
    const progress = Math.min(1, Math.max(0, (dateTimestamp(value) - start) / duration))
    return slot.x + progress * slot.width
  }
  const colors = ['#587866', '#1f6b82', '#d56e59', '#8b6f47']
  const seasonPaths = seasonSlots.map((slot, seasonIndex) => {
    const { season } = slot
    const points = [...season.standingHistory]
      .sort((first, second) => dateTimestamp(first.date) - dateTimestamp(second.date))
      .map((point) => ({
        ...point,
        x: seasonXPosition(slot, point.date),
        y: standingPosition(season.divisionName, point.standing, point.teamCount),
      }))
    const finalSnapshot = points.at(-1)
    const finalStanding = season.teamStanding ?? finalSnapshot?.standing ?? null
    const finalTeamCount = season.teamCount ?? finalSnapshot?.teamCount ?? 1
    const finalPoint = finalStanding === null ? null : {
      x: seasonXPosition(slot, season.endDate),
      y: standingPosition(season.divisionName, finalStanding, finalTeamCount),
    }
    const finalPositionChanged = finalStanding !== null && finalSnapshot?.standing !== finalStanding
    return {
      season,
      points,
      color: colors[seasonIndex % colors.length],
      finalPoint,
      finalStanding,
      finalTeamCount,
      finalPositionChanged,
    }
  })
  const divisionTeamCounts = new Map<number, number>()
  seasonPaths.forEach(({ season, finalTeamCount }) => {
    const divisionIndex = leagueDivisionIndex(season.divisionName)
    divisionTeamCounts.set(divisionIndex, Math.max(divisionTeamCounts.get(divisionIndex) ?? 0, finalTeamCount))
  })

  return (
    <svg className="league-chart-svg" viewBox={`0 0 ${scale.chartWidth} ${chartHeight}`} role="img" aria-label="Lunar League division and team standing progression">
      <title>Lunar League division and team standing progression</title>
      {visibleDivisions.map((division, index) => {
        const top = chartTop + index * divisionHeight
        const center = top + divisionHeight / 2
        return (
          <g key={division}>
            <rect className={`league-division-band${index % 2 ? ' is-alt' : ''}`} x={scale.chartLeft} y={top} width={scale.plotWidth} height={divisionHeight} />
            <line className="league-division-boundary" x1={scale.chartLeft} x2={scale.chartWidth - scale.chartRight} y1={top} y2={top} />
            <text className="league-axis-label" x={scale.chartLeft - 12} y={center + 3} textAnchor="end">{division}</text>
          </g>
        )
      })}
      {seasonSlots.map((slot) => (
        <text className="league-season-axis-label" key={slot.season.id} x={slot.x + slot.width / 2} y={chartHeight - 15} textAnchor="middle">{leagueSeasonAxisLabel(slot.season)}</text>
      ))}
      <text className="league-axis-caption" x={scale.chartLeft} y={chartTop - 9}>HIGHER DIVISION · BETTER RANK</text>
      <line className="league-axis-line" x1={scale.chartLeft} x2={scale.chartLeft} y1={chartTop} y2={chartHeight - chartBottom} />
      <line className="league-axis-line" x1={scale.chartLeft} x2={scale.chartWidth - scale.chartRight} y1={chartHeight - chartBottom} y2={chartHeight - chartBottom} />
      {[...divisionTeamCounts.entries()].map(([divisionIndex, teamCount]) => {
        const division = leagueDivisionScale[divisionIndex]
        return (
          <g className="league-rank-guide" key={divisionIndex}>
            {Array.from({ length: teamCount }, (_, index) => {
              const standing = index + 1
              const y = standingPosition(division, standing, teamCount)
              return (
                <g key={standing}>
                  <line className="league-rank-grid" x1={scale.chartLeft} x2={scale.chartWidth - scale.chartRight} y1={y} y2={y} />
                  <text x={scale.chartLeft + 8} y={y + 3}>{ordinalPosition(standing)}</text>
                </g>
              )
            })}
          </g>
        )
      })}
      {seasonPaths.map(({ season, points, color, finalPoint, finalStanding, finalTeamCount, finalPositionChanged }) => {
        const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ')
        return (
          <g key={season.id}>
            {points.length > 1 && <polyline className="league-standing-line" points={linePoints} stroke={color} />}
            {finalPoint && finalPositionChanged && <>
              <circle className="league-season-end-point" cx={finalPoint.x} cy={finalPoint.y} r="5" fill={color} />
              <text className="league-season-label" x={finalPoint.x} y={finalPoint.y - 11} textAnchor="middle">{ordinalPosition(finalStanding)} / {finalTeamCount}</text>
            </>}
            {points.map((point, pointIndex) => {
              const x = point.x
              const y = point.y
              const previousPoint = points[pointIndex - 1]
              const positionChanged = pointIndex === 0 || point.standing !== previousPoint?.standing
              const resultColor = leagueResultColor(point.result)
              const marker = point.result === 'loss'
                ? <rect className="league-standing-marker" x={x - 6} y={y - 6} width="12" height="12" rx="3" fill={resultColor} />
                : point.result === 'draw'
                  ? <polygon className="league-standing-marker" points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`} fill={resultColor} />
                  : <circle className="league-standing-marker" cx={x} cy={y} r="7" fill={resultColor} />
              return (
                <g key={`${season.id}-${point.fixtureId}`}>
                  {marker}
                  <text className="league-standing-marker-label" x={x} y={y + 3} textAnchor="middle">{leagueResultLabel(point.result)}</text>
                  {positionChanged && <text className="league-standing-rank-label" x={x} y={y - 11} textAnchor="middle">{point.standing} / {point.teamCount}</text>}
                  <title>{`${formatCompactDate(point.date)} · ${leagueResultLabel(point.result)} · ${point.teamScore ?? '—'}–${point.opponentScore ?? '—'} vs ${point.opponentTeam} · ${ordinalPosition(point.standing)} of ${point.teamCount}`}</title>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

function LeagueProgressChart({ seasons }: LeagueProgressChartProps) {
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 620)
  const chartWidth = isCompact ? 390 : 930
  const scale = leagueTimeScale(chartWidth)

  useEffect(() => {
    function updateChartWidth() {
      setIsCompact(window.innerWidth <= 620)
    }

    window.addEventListener('resize', updateChartWidth)
    return () => window.removeEventListener('resize', updateChartWidth)
  }, [])

  return (
    <div className="league-chart-wrap">
      <LeagueCombinedChart seasons={seasons} scale={scale} />
      <div className="league-chart-legend">
        <span><i className="league-result-marker league-result-marker-win">W</i> Win</span>
        <span><i className="league-result-marker league-result-marker-loss">L</i> Loss</span>
        <span><i className="league-result-marker league-result-marker-draw">D</i> Draw</span>
      </div>
    </div>
  )
}

type LeagueProgressSectionProps = {
  seasons: LeagueSeasonAnalysis[]
  isLoading: boolean
  error: string | null
}

function LeagueProgressSection({ seasons, isLoading, error }: LeagueProgressSectionProps) {
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
                          <span className="league-fixture-info"><strong>{formatCompactDate(fixture.date)} · round {fixture.round ?? '—'}</strong><span>vs {fixture.opponentTeam} · {fixture.teamScore ?? '—'}–{fixture.opponentScore ?? '—'} · {fixture.matches.length} personal {fixture.matches.length === 1 ? 'match' : 'matches'}</span></span>
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
            <ProgressChart series={series} />
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
                      <td>{point.event.partner ?? 'Unavailable'}</td>
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
