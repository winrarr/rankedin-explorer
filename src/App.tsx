import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  History,
  Info,
  LoaderCircle,
  LineChart,
  Printer,
  Search,
  Settings2,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  getClassParticipants,
  getPlayerAnalysis,
  getPlayerCurrentLeagueDivision,
  getPlayerLeagueAnalysis,
  getPlayerProfile,
  normalizeCompetitionClassName,
  searchPlayersByName,
  searchTournamentsByName,
  getTournamentSnapshot,
  type PairRecord,
  type PlayerAnalysis,
  type PlayerEventAnalysis,
  type PlayerLeagueAnalysis,
  type PlayerLeagueDivision,
  type LeagueSeasonAnalysis,
  type LeagueStandingSnapshot,
  type PlayerProfile,
  type PlayerSearchResult,
  type TournamentSearchResult,
  type TournamentSnapshot,
} from './lib/rankedin'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences'
import { MetricCard } from './components/MetricCard'
import { LoadingValue } from './components/LoadingValue'
import {
  FieldClassSummaryGrid,
  FieldLeagueDivisionSummary,
} from './components/FieldBreakdown'
import { InfoTip } from './components/InfoTip'
import {
  leagueDivisionIndex,
  leagueDivisionScale,
  mostCommonRecentClass,
  summarizeFieldLeagueDivisions,
  type FieldClassSummary,
} from './lib/fieldBreakdown'
import {
  compactClassName,
  dateTimestamp,
  formatCompactDate,
  formatDate,
  formatRating,
  ordinalPosition,
  placementSummaryPosition,
} from './lib/formatters'
import { PlayerHistoryColumn } from './components/PlayerHistoryColumn'
import {
  downloadTournamentCsv,
  downloadTournamentJson,
} from './lib/exports'
import './App.css'

const PLAYER_PROGRESS_HISTORY_LIMIT = 25
const FIELD_PLACEMENT_CONCURRENCY = 3
const FIELD_LEAGUE_CONCURRENCY = 6

type WorkspaceMode = 'tournament' | 'player'

type SharedLocation = {
  mode: WorkspaceMode
  tournamentReference: string
  classId: number | undefined
  playerReference: string
}

function readSharedLocation(): SharedLocation {
  if (typeof window === 'undefined') {
    return { mode: 'tournament', tournamentReference: '', classId: undefined, playerReference: '' }
  }

  const params = new URLSearchParams(window.location.search)
  const tournamentReference = params.get('tournament')?.trim() ?? ''
  const playerReference = params.get('player')?.trim() ?? ''
  const modeParam = params.get('mode')
  const mode: WorkspaceMode = modeParam === 'player' || (!tournamentReference && playerReference)
    ? 'player'
    : 'tournament'
  const classValue = Number(params.get('class'))

  return {
    mode,
    tournamentReference,
    classId: Number.isInteger(classValue) && classValue > 0 ? classValue : undefined,
    playerReference,
  }
}

function updateSharedLocation({ mode, tournament, classId, player }: {
  mode: WorkspaceMode
  tournament?: string
  classId?: number
  player?: string
}) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams()
  if (mode === 'tournament' && tournament?.trim()) {
    params.set('mode', mode)
    params.set('tournament', tournament.trim())
    if (classId) params.set('class', String(classId))
  }
  if (mode === 'player' && player?.trim()) {
    params.set('mode', mode)
    params.set('player', player.trim())
  }

  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)
}

function isDirectTournamentReference(value: string) {
  const trimmed = value.trim()
  return /^\d{3,}$/.test(trimmed) || /\/tournament\/\d+/i.test(trimmed)
}

function isDirectPlayerReference(value: string) {
  const trimmed = value.trim()
  return /^R\d+$/i.test(trimmed) || /\/player\/R\d+/i.test(trimmed)
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

async function settleWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: PromiseSettledResult<R>[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      try {
        results[currentIndex] = { status: 'fulfilled', value: await mapper(items[currentIndex]) }
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

function placementProgress(event: PlayerEventAnalysis) {
  if (event.standing === null || !event.fieldSize) return 0.5
  if (event.fieldSize === 1) return 0
  return Math.min(1, Math.max(0, (event.standing - 1) / (event.fieldSize - 1)))
}

function placementGradient(event: PlayerEventAnalysis) {
  const lowerFinishWeight = Math.round(placementProgress(event) * 100)
  const higherFinishWeight = 100 - lowerFinishWeight
  return {
    background: `color-mix(in srgb, var(--sage-soft) ${higherFinishWeight}%, var(--coral-soft) ${lowerFinishWeight}%)`,
    borderColor: `color-mix(in srgb, var(--sage) ${higherFinishWeight}%, var(--coral) ${lowerFinishWeight}%)`,
    color: `color-mix(in srgb, var(--sage) ${higherFinishWeight}%, var(--coral) ${lowerFinishWeight}%)`,
  }
}

function fieldPlacementSummary(event: PlayerEventAnalysis) {
  return {
    date: formatCompactDate(event.startDate),
    className: compactClassName(event.className),
    position: placementSummaryPosition(event),
    fieldSize: event.fieldSize,
  }
}

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
      const percentage = averagePlacement(event)
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

function averagePlacement(event: PlayerEventAnalysis) {
  if (event.standing === null || !event.fieldSize) return null
  const rangeEnd = event.standingRangeTo ?? event.standing
  const placement = (event.standing + rangeEnd) / 2
  return Math.min(1, Math.max(0, placement / event.fieldSize))
}

function summarizeFieldPlacements(analyses: Record<number, PlayerAnalysis | null>) {
  const groups = new Map<string, {
    className: string
    kind: ReturnType<typeof normalizeCompetitionClassName>['kind']
    percentages: number[]
    players: Set<number>
  }>()

  Object.values(analyses).forEach((analysis) => {
    if (!analysis) return

    fieldPlacementEvents(analysis).forEach((event) => {
      const percentage = averagePlacement(event)
      if (percentage === null) return

      const normalizedClass = normalizeCompetitionClassName(event.className)
      const groupKey = `${normalizedClass.kind}:${normalizedClass.name}`
      const group = groups.get(groupKey) ?? {
        className: normalizedClass.name,
        kind: normalizedClass.kind,
        percentages: [],
        players: new Set<number>(),
      }
      group.percentages.push(percentage)
      group.players.add(analysis.playerId)
      groups.set(groupKey, group)
    })
  })

  return Array.from(groups.values(), (group): FieldClassSummary => ({
    className: group.className,
    kind: group.kind,
    averageTopPercent: group.percentages.reduce((sum, value) => sum + value, 0) / group.percentages.length,
    resultCount: group.percentages.length,
    playerCount: group.players.size,
  })).sort((first, second) => (
    Number(first.kind === 'other') - Number(second.kind === 'other')
      || first.averageTopPercent - second.averageTopPercent
  ))
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
  const yPosition = (value: number) => chartTop + value * plotHeight
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
    setHiddenSeries((current) => ({ ...current, [className]: !current[className] }))
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
        <svg className="progress-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Tournament placement timeline">
          <title>Finished tournament placement timeline</title>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="progress-grid-line" x1={chartLeft} x2={chartWidth - chartRight} y1={yPosition(tick)} y2={yPosition(tick)} />
              <text className="progress-axis-label" x={chartLeft - 11} y={yPosition(tick) + 3} textAnchor="end">Top {Math.round(tick * 100)}%</text>
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
                    <title>{`${formatDate(point.event.startDate)} · ${point.className} · ${placementSummaryPosition(point.event)} of ${point.event.fieldSize ?? '—'} pairs · ${point.event.name}`}</title>
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
          <div className="section-kicker">LUNAR LEAGUE PROGRESS</div>
          <h2>Division history <InfoTip label="About Lunar League progress" message="Divisions are categorical, not numeric. The chart follows the player's division and team standing across each season." /></h2>
        </div>
      </div>
      {isLoading && !seasons.length && <div className="league-loading"><LoaderCircle className="spin" size={15} /> Reading finished league seasons…</div>}
      {error && <p className="league-error"><CircleHelp size={14} /> {error}</p>}
      {!!seasons.length && (
        <>
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
  leagueAnalysis: PlayerLeagueAnalysis | null
  leagueError: string | null
  isLoadingLeague: boolean
  error: string | null
  isLoading: boolean
  loadingStage: 'profile' | 'history' | null
  onCopyShareLink: () => void
  shareCopied: boolean
  canShare: boolean
}

function PlayerProgressWorkspace({ profile, analysis, leagueAnalysis, leagueError, isLoadingLeague, error, isLoading, loadingStage, onCopyShareLink, shareCopied, canShare }: PlayerProgressWorkspaceProps) {
  const series = useMemo(() => progressSeries(analysis?.events ?? []), [analysis])
  const points = useMemo(() => series.flatMap((item) => item.points), [series])
  const latestPoint = [...points].sort((first, second) => (
    new Date(second.event.startDate).getTime() - new Date(first.event.startDate).getTime()
  ))[0]
  const average = points.length ? points.reduce((sum, point) => sum + point.percentage, 0) / points.length : null
  const unavailableCount = analysis ? analysis.events.length - points.length : 0

  return (
    <>
      {profile && (
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">PLAYER PROGRESS <span className="live-dot" /> LIVE DATA</div>
            <h2>{profile.name}</h2>
            <p>{`${profile.homeClubName ?? 'Home club unavailable'} / ${profile.countryCode?.toUpperCase() ?? 'Country unavailable'} / ${points.length || 'No'} comparable results`}</p>
          </div>
          <div className="workspace-actions">
            <button className="text-button share-button" type="button" onClick={onCopyShareLink} disabled={!canShare}>
              {shareCopied ? <Check size={15} /> : <Copy size={15} />} {shareCopied ? 'Link copied' : 'Copy share link'}
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
            <MetricCard dark icon={<Trophy size={15} />} label="RESULTS CHARTED" value={points.length} detail="finished placements" />
            <MetricCard icon={<Users size={15} />} label="LEVELS IN HISTORY" value={series.length} detail="normalized classes" />
            <MetricCard icon={<Gauge size={15} />} label="AVERAGE FINISH" value={formatPercent(average)} detail="all comparable results" />
            <MetricCard icon={<CalendarDays size={15} />} label="LATEST RESULT" value={latestPoint ? formatPercent(latestPoint.percentage) : '—'} detail={latestPoint ? formatCompactDate(latestPoint.event.startDate) : 'no comparable result'} />
          </section>

          <section className="field-card progress-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">PLACEMENT TIMELINE</div>
                <h2>Placement timeline</h2>
                <p>{formatProgressDateRange(points)} <span className="muted-divider">/</span> each point is one finished tournament <span className="inline-guidance">· lower is better <InfoTip label="About placement percentages" message="Placement percentage is standing divided by the finished field size. Solid lines connect results within the same normalized class; dotted lines show direction only and are not forecasts." /></span></p>
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
                <div className="section-kicker">RECENT RESULTS</div>
                <h2>Recent results</h2>
                <p>{points.length} comparable placements <span className="muted-divider">/</span> {formatProgressDateRange(points)}</p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="progress-results-table">
                <thead><tr><th>DATE</th><th>LEVEL / CLASS</th><th>PLACEMENT</th><th>PARTNER</th><th>EVENT</th></tr></thead>
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

function App() {
  const [initialLocation] = useState<SharedLocation>(() => readSharedLocation())
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES
    return loadPreferences()
  })
  const [activeMode, setActiveMode] = useState<WorkspaceMode>(initialLocation.mode)
  const [tournamentUrl, setTournamentUrl] = useState(initialLocation.tournamentReference)
  const [playerReference, setPlayerReference] = useState(initialLocation.playerReference)
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [playerAnalysis, setPlayerAnalysis] = useState<PlayerAnalysis | null>(null)
  const [playerLeagueAnalysis, setPlayerLeagueAnalysis] = useState<PlayerLeagueAnalysis | null>(null)
  const [isAnalyzingPlayer, setIsAnalyzingPlayer] = useState(false)
  const [isLoadingLeague, setIsLoadingLeague] = useState(false)
  const [playerLoadingStage, setPlayerLoadingStage] = useState<'profile' | 'history' | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [playerLeagueError, setPlayerLeagueError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null)
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null)
  const [pairHistory, setPairHistory] = useState<{
    first: { analysis: PlayerAnalysis | null; error: string | null }
    second: { analysis: PlayerAnalysis | null; error: string | null }
  } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingClass, setIsLoadingClass] = useState(false)
  const [isLoadingPair, setIsLoadingPair] = useState(false)
  const [fieldPlacementSummaries, setFieldPlacementSummaries] = useState<Record<number, PlayerAnalysis | null>>({})
  const [fieldPlacementsLoaded, setFieldPlacementsLoaded] = useState(false)
  const [isLoadingFieldPlacements, setIsLoadingFieldPlacements] = useState(false)
  const [fieldPlacementError, setFieldPlacementError] = useState<string | null>(null)
  const [fieldLeagueDivisions, setFieldLeagueDivisions] = useState<Record<number, PlayerLeagueDivision | null>>({})
  const [fieldLeagueDivisionsLoaded, setFieldLeagueDivisionsLoaded] = useState(false)
  const [isLoadingFieldLeagueDivisions, setIsLoadingFieldLeagueDivisions] = useState(false)
  const [fieldLeagueDivisionError, setFieldLeagueDivisionError] = useState<string | null>(null)
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([])
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false)
  const [playerSearchError, setPlayerSearchError] = useState<string | null>(null)
  const [tournamentSearchResults, setTournamentSearchResults] = useState<TournamentSearchResult[]>([])
  const [isSearchingTournaments, setIsSearchingTournaments] = useState(false)
  const [tournamentSearchError, setTournamentSearchError] = useState<string | null>(null)
  const [showTournamentSearch, setShowTournamentSearch] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const fieldPlacementRequestRef = useRef(0)
  const fieldLeagueRequestRef = useRef(0)
  const playerRequestRef = useRef(0)
  const playerSearchRequestRef = useRef(0)
  const tournamentSearchRequestRef = useRef(0)
  const lastAnalyzedTournamentReferenceRef = useRef('')
  const lastAnalyzedPlayerReferenceRef = useRef('')
  const searchAnchorRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    savePreferences(preferences)
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences])

  useEffect(() => {
    if (initialLocation.mode === 'tournament' && initialLocation.tournamentReference) {
      void analyzeTournament(initialLocation.tournamentReference, initialLocation.classId)
    }
    if (initialLocation.mode === 'player' && initialLocation.playerReference) {
      void analyzePlayer(initialLocation.playerReference)
    }
  }, [initialLocation])

  useEffect(() => {
    function closeSearchMenus(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (!searchAnchorRef.current?.contains(event.target)) {
        setShowPlayerSearch(false)
        setShowTournamentSearch(false)
      }
    }

    document.addEventListener('click', closeSearchMenus)
    return () => document.removeEventListener('click', closeSearchMenus)
  }, [])

  useEffect(() => {
    const normalizedTerm = playerReference.trim()
    const requestId = playerSearchRequestRef.current + 1
    playerSearchRequestRef.current = requestId
    setPlayerSearchResults([])
    setPlayerSearchError(null)
    setIsSearchingPlayers(false)

    if (activeMode !== 'player' || !showPlayerSearch || isDirectPlayerReference(normalizedTerm) || normalizedTerm.length < 2) return

    const controller = new AbortController()
    let disposed = false
    let didTimeout = false
    let searchTimeout = 0
    const debounceTimeout = window.setTimeout(() => {
      setIsSearchingPlayers(true)
      searchTimeout = window.setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, 8000)
      void searchPlayersByName(normalizedTerm, 8, controller.signal)
        .then((results) => {
          if (disposed || requestId !== playerSearchRequestRef.current) return
          setPlayerSearchResults(results)
        })
        .catch((caught) => {
          if (disposed || requestId !== playerSearchRequestRef.current) return
          if (caught instanceof Error && caught.name === 'AbortError') {
            if (didTimeout) setPlayerSearchError('Player search timed out. Try again.')
            return
          }
          setPlayerSearchError(caught instanceof Error ? caught.message : 'Player search could not be completed.')
        })
        .finally(() => {
          window.clearTimeout(searchTimeout)
          if (!disposed && requestId === playerSearchRequestRef.current) setIsSearchingPlayers(false)
        })
    }, 280)

    return () => {
      disposed = true
      window.clearTimeout(debounceTimeout)
      window.clearTimeout(searchTimeout)
      controller.abort()
    }
  }, [activeMode, playerReference, showPlayerSearch])

  useEffect(() => {
    const normalizedTerm = tournamentUrl.trim()
    const requestId = tournamentSearchRequestRef.current + 1
    tournamentSearchRequestRef.current = requestId
    setTournamentSearchResults([])
    setTournamentSearchError(null)
    setIsSearchingTournaments(false)

    if (activeMode !== 'tournament' || isDirectTournamentReference(normalizedTerm) || normalizedTerm.length < 2) return

    const controller = new AbortController()
    let disposed = false
    let didTimeout = false
    let searchTimeout = 0
    const debounceTimeout = window.setTimeout(() => {
      setIsSearchingTournaments(true)
      searchTimeout = window.setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, 8000)
      void searchTournamentsByName(normalizedTerm, 8, controller.signal)
        .then((results) => {
          if (disposed || requestId !== tournamentSearchRequestRef.current) return
          setTournamentSearchResults(results)
        })
        .catch((caught) => {
          if (disposed || requestId !== tournamentSearchRequestRef.current) return
          if (caught instanceof Error && caught.name === 'AbortError') {
            if (didTimeout) setTournamentSearchError('Tournament search timed out. Try again.')
            return
          }
          setTournamentSearchError(caught instanceof Error ? caught.message : 'Tournament search could not be completed.')
        })
        .finally(() => {
          window.clearTimeout(searchTimeout)
          if (!disposed && requestId === tournamentSearchRequestRef.current) setIsSearchingTournaments(false)
        })
    }, 280)

    return () => {
      disposed = true
      window.clearTimeout(debounceTimeout)
      window.clearTimeout(searchTimeout)
      controller.abort()
    }
  }, [activeMode, tournamentUrl])

  useEffect(() => {
    const normalizedReference = playerReference.trim()
    if (activeMode !== 'player' || !isDirectPlayerReference(normalizedReference)) {
      lastAnalyzedPlayerReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedPlayerReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedPlayerReferenceRef.current) return
      void analyzePlayer(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [activeMode, playerReference])

  useEffect(() => {
    const normalizedReference = tournamentUrl.trim()
    if (activeMode !== 'tournament' || !isDirectTournamentReference(normalizedReference)) {
      lastAnalyzedTournamentReferenceRef.current = ''
      return
    }
    if (normalizedReference === lastAnalyzedTournamentReferenceRef.current) return

    const timeout = window.setTimeout(() => {
      if (normalizedReference === lastAnalyzedTournamentReferenceRef.current) return
      void analyzeTournament(normalizedReference)
    }, 550)

    return () => window.clearTimeout(timeout)
  }, [activeMode, tournamentUrl])

  useEffect(() => {
    if (activeMode !== 'tournament' || !snapshot) return
    void loadFieldPlacements(snapshot.participants)
    void loadFieldLeagueDivisions(snapshot.participants)
  }, [activeMode, snapshot])

  const visibleParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return snapshot?.participants ?? []

    return (snapshot?.participants ?? []).filter((pair) =>
      `${pair.first.name} ${pair.second.name}`.toLowerCase().includes(normalizedSearch),
    )
  }, [searchTerm, snapshot])

  const ratings = (snapshot?.participants ?? [])
    .map(pairRating)
    .filter((rating): rating is number => rating !== null)
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null
  const selectedPair = snapshot?.participants.find((pair) => pair.id === selectedPairId)
  const classTitle = snapshot?.selectedClass.name.replace(/\s*\([^)]*\)/, '') ?? ''
  const fieldClassSummaries = useMemo(
    () => summarizeFieldPlacements(fieldPlacementSummaries),
    [fieldPlacementSummaries],
  )
  const normalizedFieldClassSummaries = fieldClassSummaries.filter((summary) => summary.kind === 'dpf')
  const otherFieldClassSummaries = fieldClassSummaries.filter((summary) => summary.kind !== 'dpf')
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
  const canExportTournament = Boolean(snapshot && !isAnalyzing)

  function tournamentExportInput() {
    if (!snapshot) return null
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

  async function analyzeTournament(reference = tournamentUrl, selectedClassId?: number) {
    const normalizedReference = reference.trim()
    if (!normalizedReference) return

    lastAnalyzedTournamentReferenceRef.current = normalizedReference
    setShowTournamentSearch(false)
    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setIsAnalyzing(true)
    setError(null)
    setShareCopied(false)
    setSelectedPairId(null)
    setPairHistory(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)
    setFieldLeagueDivisionError(null)
    setIsLoadingFieldLeagueDivisions(false)
    setTournamentUrl(normalizedReference)
    updateSharedLocation({ mode: 'tournament', tournament: normalizedReference, classId: selectedClassId })

    try {
      const result = await getTournamentSnapshot(normalizedReference, selectedClassId)
      setSnapshot(result)
      updateSharedLocation({ mode: 'tournament', tournament: normalizedReference, classId: result.selectedClass.id })
      setSearchTerm('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The tournament could not be loaded.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function analyzePlayer(reference = playerReference) {
    const normalizedReference = reference.trim()
    if (!normalizedReference) return

    lastAnalyzedPlayerReferenceRef.current = normalizedReference
    const requestId = playerRequestRef.current + 1
    playerRequestRef.current = requestId
    setIsAnalyzingPlayer(true)
    setPlayerLoadingStage('profile')
    setPlayerError(null)
    setPlayerLeagueError(null)
    setShowPlayerSearch(false)
    setShareCopied(false)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerLeagueAnalysis(null)
    setIsLoadingLeague(false)
    setPlayerReference(normalizedReference)
    updateSharedLocation({ mode: 'player', player: normalizedReference })

    try {
      const profile = await getPlayerProfile(normalizedReference)
      if (requestId !== playerRequestRef.current) return
      updateSharedLocation({ mode: 'player', player: profile.rankedInId })
      setPlayerProfile(profile)
      setPlayerAnalysis({ playerId: profile.id, playerName: profile.name, events: [] })
      setPlayerLeagueAnalysis({ playerId: profile.id, playerName: profile.name, seasons: [] })
      setIsLoadingLeague(true)
      setPlayerLoadingStage('history')
      const [tournamentResult, leagueResult] = await Promise.allSettled([
        getPlayerAnalysis(profile.id, PLAYER_PROGRESS_HISTORY_LIMIT, (event) => {
          if (requestId !== playerRequestRef.current) return
          setPlayerAnalysis((current) => {
            if (!current || current.playerId !== profile.id) return current
            return {
              ...current,
              events: [...current.events, event].sort((first, second) => (
                new Date(second.startDate).getTime() - new Date(first.startDate).getTime()
              )),
            }
          })
        }),
        getPlayerLeagueAnalysis(profile.id, 10, (season) => {
          if (requestId !== playerRequestRef.current) return
          setPlayerLeagueAnalysis((current) => {
            if (!current || current.playerId !== profile.id) return current
            const seasons = [...current.seasons.filter((item) => `${item.id}-${item.teamId}` !== `${season.id}-${season.teamId}`), season]
              .sort((first, second) => new Date(second.startDate).getTime() - new Date(first.startDate).getTime())
            return { ...current, seasons }
          })
        }),
      ])
      if (requestId !== playerRequestRef.current) return
      if (tournamentResult.status === 'fulfilled') {
        setPlayerAnalysis({ ...tournamentResult.value, playerName: profile.name })
      } else {
        setPlayerError(tournamentResult.reason instanceof Error ? tournamentResult.reason.message : 'Tournament history could not be loaded.')
      }
      if (leagueResult.status === 'fulfilled') {
        setPlayerLeagueAnalysis({ ...leagueResult.value, playerName: profile.name })
      } else {
        setPlayerLeagueError('Lunar League history could not be loaded.')
      }
    } catch (caught) {
      if (requestId !== playerRequestRef.current) return
      setPlayerError(caught instanceof Error ? caught.message : 'The player could not be loaded.')
    } finally {
      if (requestId === playerRequestRef.current) {
        setIsLoadingLeague(false)
        setIsAnalyzingPlayer(false)
        setPlayerLoadingStage(null)
      }
    }
  }

  function selectPlayerSearchResult(player: PlayerSearchResult) {
    setPlayerSearchResults([])
    setPlayerSearchError(null)
    setShowPlayerSearch(false)
    setPlayerReference(player.rankedInId)
    void analyzePlayer(player.rankedInId)
  }

  function selectTournamentSearchResult(tournament: TournamentSearchResult) {
    setTournamentSearchResults([])
    setTournamentSearchError(null)
    setTournamentUrl(String(tournament.id))
    void analyzeTournament(String(tournament.id))
  }

  function clearReference() {
    if (activeMode === 'tournament') {
      setTournamentUrl('')
      setShowTournamentSearch(false)
      updateSharedLocation({ mode: 'tournament' })
      return
    }

    setPlayerReference('')
    setShowPlayerSearch(false)
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
      else setPlayerError(message)
    }
  }

  function printTournamentReport() {
    if (!canExportTournament) return
    window.print()
  }

  function exportTournamentCsv() {
    const input = tournamentExportInput()
    if (!input || !canExportTournament) return
    downloadTournamentCsv(input)
  }

  function exportTournamentJson() {
    const input = tournamentExportInput()
    if (!input || !canExportTournament) return
    downloadTournamentJson(input)
  }

  async function chooseClass(classId: number) {
    if (!snapshot) return
    const nextClass = snapshot.classes.find((item) => item.id === classId)
    if (!nextClass || nextClass.id === snapshot.selectedClass.id) return

    setIsLoadingClass(true)
    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setError(null)

    try {
      const participants = await getClassParticipants(snapshot.tournamentId, classId)
      setSnapshot((current) => current ? ({ ...current, selectedClass: nextClass, participants }) : current)
      setSelectedPairId(null)
      setPairHistory(null)
      setFieldPlacementSummaries({})
      setFieldPlacementsLoaded(false)
      setFieldPlacementError(null)
      setIsLoadingFieldPlacements(false)
      setFieldLeagueDivisions({})
      setFieldLeagueDivisionsLoaded(false)
      setFieldLeagueDivisionError(null)
      setIsLoadingFieldLeagueDivisions(false)
      updateSharedLocation({ mode: 'tournament', tournament: tournamentUrl, classId: nextClass.id })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This class could not be loaded.')
    } finally {
      setIsLoadingClass(false)
    }
  }

  async function inspectPair(pair: PairRecord) {
    setSelectedPairId(pair.id)
    setPairHistory(null)
    setIsLoadingPair(true)

    const results = await Promise.allSettled([
      getPlayerAnalysis(pair.first.id, preferences.historyLimit),
      getPlayerAnalysis(pair.second.id, preferences.historyLimit),
    ])

    const [firstResult, secondResult] = results
    setPairHistory({
      first: firstResult.status === 'fulfilled'
        ? { analysis: { ...firstResult.value, playerName: pair.first.name }, error: null }
        : { analysis: null, error: firstResult.reason instanceof Error ? firstResult.reason.message : 'Player history could not be loaded.' },
      second: secondResult.status === 'fulfilled'
        ? { analysis: { ...secondResult.value, playerName: pair.second.name }, error: null }
        : { analysis: null, error: secondResult.reason instanceof Error ? secondResult.reason.message : 'Player history could not be loaded.' },
    })
    setIsLoadingPair(false)
  }

  async function loadFieldPlacements(participants: PairRecord[]) {
    const requestId = fieldPlacementRequestRef.current + 1
    fieldPlacementRequestRef.current = requestId
    const players = participants.flatMap((pair) => [pair.first, pair.second])
    setIsLoadingFieldPlacements(true)
    setFieldPlacementError(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)

    const results = await settleWithConcurrency(
      players,
      FIELD_PLACEMENT_CONCURRENCY,
      async (player) => {
        const analysis = await getPlayerAnalysis(player.id, 5, (event) => {
          if (requestId !== fieldPlacementRequestRef.current) return
          setFieldPlacementSummaries((current) => {
            const previous = current[player.id]
            const events = [...(previous?.events ?? []), event].sort((first, second) => (
              new Date(second.startDate).getTime() - new Date(first.startDate).getTime()
            ))
            return {
              ...current,
              [player.id]: {
                playerId: player.id,
                playerName: player.name,
                events,
              },
            }
          })
        })
        if (requestId === fieldPlacementRequestRef.current) {
          setFieldPlacementSummaries((current) => ({
            ...current,
            [player.id]: { ...analysis, playerName: player.name },
          }))
        }
        return { player, analysis }
      },
    )
    let failedCount = 0

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') return
      const player = players[index]
      if (requestId === fieldPlacementRequestRef.current) {
        setFieldPlacementSummaries((current) => ({ ...current, [player.id]: null }))
      }
      failedCount += 1
    })

    if (requestId !== fieldPlacementRequestRef.current) return

    setFieldPlacementsLoaded(true)
    if (failedCount) {
      setFieldPlacementError(`${failedCount} player ${failedCount === 1 ? 'summary was' : 'summaries were'} unavailable.`)
    }
    setIsLoadingFieldPlacements(false)
  }

  async function loadFieldLeagueDivisions(participants: PairRecord[]) {
    const requestId = fieldLeagueRequestRef.current + 1
    fieldLeagueRequestRef.current = requestId
    const players = participants.flatMap((pair) => [pair.first, pair.second])
    setIsLoadingFieldLeagueDivisions(true)
    setFieldLeagueDivisionError(null)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)

    const results = await settleWithConcurrency(
      players,
      FIELD_LEAGUE_CONCURRENCY,
      (player) => getPlayerCurrentLeagueDivision(player.id),
    )
    const divisions: Record<number, PlayerLeagueDivision | null> = {}
    let failedCount = 0

    results.forEach((result, index) => {
      const player = players[index]
      if (result.status === 'fulfilled') {
        divisions[player.id] = result.value
        return
      }
      divisions[player.id] = null
      failedCount += 1
    })

    if (requestId !== fieldLeagueRequestRef.current) return

    setFieldLeagueDivisions(divisions)
    setFieldLeagueDivisionsLoaded(true)
    if (failedCount) {
      setFieldLeagueDivisionError(`${failedCount} player ${failedCount === 1 ? 'division was' : 'divisions were'} unavailable.`)
    }
    setIsLoadingFieldLeagueDivisions(false)
  }

  function resetToHome() {
    playerRequestRef.current += 1
    setActiveMode('tournament')
    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setSnapshot(null)
    setTournamentUrl('')
    setPlayerReference('')
    setSelectedPairId(null)
    setPairHistory(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
    setFieldLeagueDivisions({})
    setFieldLeagueDivisionsLoaded(false)
    setFieldLeagueDivisionError(null)
    setIsLoadingFieldLeagueDivisions(false)
    setSearchTerm('')
    setError(null)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerLeagueAnalysis(null)
    setIsLoadingLeague(false)
    setPlayerError(null)
    setPlayerLeagueError(null)
    setIsAnalyzingPlayer(false)
    setPlayerLoadingStage(null)
    setShowPlayerSearch(false)
    setShowTournamentSearch(false)
    setPlayerSearchResults([])
    setPlayerSearchError(null)
    setShareCopied(false)
    updateSharedLocation({ mode: 'tournament' })
  }

  function switchMode(nextMode: WorkspaceMode) {
    if (nextMode === activeMode) return

    fieldPlacementRequestRef.current += 1
    fieldLeagueRequestRef.current += 1
    setIsLoadingFieldPlacements(false)
    setIsLoadingFieldLeagueDivisions(false)
    if (nextMode === 'tournament') {
      playerRequestRef.current += 1
      setIsAnalyzingPlayer(false)
      setPlayerLoadingStage(null)
    }
    setActiveMode(nextMode)
    setShowPlayerSearch(false)
    setShowTournamentSearch(false)
    setError(null)
    setPlayerError(null)
    setPlayerLeagueError(null)
    setShareCopied(false)
    updateSharedLocation({
      mode: nextMode,
      tournament: tournamentUrl,
      classId: snapshot?.selectedClass.id,
      player: playerReference,
    })
  }

  return (
    <div className={`app-shell ${preferences.density === 'compact' ? 'density-compact' : ''}`}>
      <header className="topbar">
        <a className="brand" href="." aria-label="Rankedin Explorer home" onClick={(event) => { event.preventDefault(); resetToHome() }}>
          <span className="brand-mark"><Activity size={16} strokeWidth={2.5} /></span>
          <span>rankedin <strong>explorer</strong></span>
        </a>

        <div className="topbar-actions">
          <span className="topbar-label">READ-ONLY TOOL</span>
          <a className="source-link" href="https://www.rankedin.com" target="_blank" rel="noreferrer">
            Rankedin source <ExternalLink size={14} />
          </a>
          <button
            className="icon-button quiet"
            type="button"
            aria-label="Open preferences"
            aria-expanded={showPreferences}
            onClick={() => setShowPreferences((open) => !open)}
          >
            <Settings2 size={18} />
          </button>
        </div>

        {showPreferences && (
          <div className="preferences-popover">
            <div className="popover-heading">
              <div>
                <span className="eyebrow">LOCAL ONLY</span>
                <h3>Small preferences</h3>
              </div>
              <button className="icon-button quiet" type="button" aria-label="Close preferences" onClick={() => setShowPreferences(false)}>
                <X size={16} />
              </button>
            </div>
            <label className="preference-row">
              <span>Theme</span>
              <select
                value={preferences.theme}
                onChange={(event) => setPreferences((current) => ({ ...current, theme: event.target.value as Preferences['theme'] }))}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="preference-row">
              <span>Pair history depth</span>
              <select
                value={preferences.historyLimit}
                onChange={(event) => setPreferences((current) => ({ ...current, historyLimit: Number(event.target.value) as Preferences['historyLimit'] }))}
              >
                <option value={5}>5 events</option>
                <option value={10}>10 events</option>
                <option value={25}>25 events</option>
              </select>
            </label>
            <label className="preference-row">
              <span>Table density</span>
              <select
                value={preferences.density}
                onChange={(event) => setPreferences((current) => ({ ...current, density: event.target.value as Preferences['density'] }))}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label className="preference-row preference-checkbox">
              <span>Open match details by default</span>
              <input
                type="checkbox"
                checked={preferences.showContext}
                onChange={(event) => setPreferences((current) => ({ ...current, showContext: event.target.checked }))}
              />
            </label>
            <p className="popover-note">Tournament and pair choices are never stored. Player Progress reads up to 25 finished events for a more useful timeline.</p>
          </div>
        )}
      </header>

      <nav className="workspace-nav" aria-label="Choose workspace">
        <div className="workspace-nav-inner">
          <span className="workspace-nav-label">WORKSPACE</span>
          <div className="workspace-nav-tabs" role="tablist">
            <button
              className={activeMode === 'tournament' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'tournament'}
              onClick={() => switchMode('tournament')}
            >
              <Trophy size={15} /> Tournament Explorer
            </button>
            <button
              className={activeMode === 'player' ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeMode === 'player'}
              onClick={() => switchMode('player')}
            >
              <LineChart size={15} /> Player Progress
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> Rankedin intelligence, without the digging</div>
            <h1>See the level <em>behind</em> the result.</h1>
            <p className="hero-lede">
              A clearer way to read tournament fields, player history and match context across Rankedin.
            </p>

            <div className="input-card">
              <label htmlFor={activeMode === 'tournament' ? 'tournament-url' : 'player-reference'}>
                {activeMode === 'tournament' ? 'Start with a public tournament' : 'Find a public Rankedin player'}
              </label>
              <div className="reference-search-anchor" ref={searchAnchorRef}>
                <div className="url-input-row">
                  <div className="url-input-wrap">
                    {activeMode === 'tournament' ? <GitBranch size={17} /> : <Search size={17} />}
                    <input
                      id={activeMode === 'tournament' ? 'tournament-url' : 'player-reference'}
                      value={activeMode === 'tournament' ? tournamentUrl : playerReference}
                      onChange={(event) => {
                        if (activeMode === 'tournament') {
                          setTournamentUrl(event.target.value)
                          setShowTournamentSearch(true)
                        } else {
                          setPlayerReference(event.target.value)
                          setShowPlayerSearch(true)
                        }
                      }}
                      onFocus={() => {
                        if (activeMode === 'tournament' && !isDirectTournamentReference(tournamentUrl)) setShowTournamentSearch(true)
                        if (activeMode === 'player') setShowPlayerSearch(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (activeMode === 'tournament' || isDirectPlayerReference(playerReference))) {
                          void (activeMode === 'tournament' ? analyzeTournament() : analyzePlayer())
                        }
                      }}
                      placeholder={activeMode === 'tournament' ? 'Search tournament name, URL or ID' : 'Search player name, profile URL or R-number'}
                    />
                    {(activeMode === 'tournament' ? tournamentUrl : playerReference) && <button className="clear-input" type="button" aria-label={`Clear ${activeMode} reference`} onClick={clearReference}><X size={14} /></button>}
                  </div>
                  <button className="primary-button" type="button" onClick={() => void (activeMode === 'tournament' ? analyzeTournament() : analyzePlayer())} disabled={activeMode === 'tournament' ? isAnalyzing || !tournamentUrl.trim() : isAnalyzingPlayer || !isDirectPlayerReference(playerReference)}>
                    {(activeMode === 'tournament' ? isAnalyzing : isAnalyzingPlayer) ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                    {(activeMode === 'tournament' ? isAnalyzing : isAnalyzingPlayer) ? 'Reading…' : activeMode === 'tournament' ? 'Analyze field' : 'Read progress'}
                  </button>
                </div>
                {activeMode === 'tournament' && showTournamentSearch && !isDirectTournamentReference(tournamentUrl) && (
                  <div className="tournament-search-panel" role="status">
                    {isSearchingTournaments && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin tournaments…</p>}
                    {tournamentSearchError && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {tournamentSearchError}</p>}
                    {!isSearchingTournaments && !tournamentSearchError && tournamentUrl.trim().length >= 2 && !tournamentSearchResults.length && <p className="player-search-status">No public tournaments matched that name.</p>}
                    {!!tournamentSearchResults.length && (
                      <div className="tournament-search-results" role="listbox" aria-label="Tournament search results">
                        {tournamentSearchResults.map((tournament) => (
                          <button className="tournament-search-result" type="button" role="option" key={`${tournament.id}-${tournament.startDate}`} onClick={() => selectTournamentSearchResult(tournament)}>
                            <span className="tournament-search-result-name">{tournament.name}</span>
                            <span className="tournament-search-result-meta">{tournament.startDate || 'Date unavailable'} · {tournament.sport ?? 'Sport unavailable'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeMode === 'player' && showPlayerSearch && !isDirectPlayerReference(playerReference) && (
                  <div className="player-search-panel">
                    {isSearchingPlayers && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin profiles…</p>}
                    {playerSearchError && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {playerSearchError}</p>}
                    {!isSearchingPlayers && !playerSearchError && playerReference.trim().length >= 2 && !isDirectPlayerReference(playerReference) && !playerSearchResults.length && <p className="player-search-status">No public players matched that name.</p>}
                    {!!playerSearchResults.length && (
                      <div className="player-search-results" role="listbox" aria-label="Player search results">
                        {playerSearchResults.map((player) => (
                          <button className="player-search-result" type="button" role="option" key={player.rankedInId} onClick={() => selectPlayerSearchResult(player)}>
                            <span className="player-search-result-name">{player.name}</span>
                            <span className="player-search-result-id">{player.rankedInId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="input-hint"><Info size={14} /> No login. No database. {activeMode === 'tournament' ? 'Paste a public tournament URL or ID to begin.' : 'Type a name or paste a public profile URL/R-number.'}</p>
              {((activeMode === 'tournament' && isAnalyzing) || (activeMode === 'player' && isAnalyzingPlayer && !playerProfile)) && (
                <div className="lookup-loading-state" role="status" aria-live="polite">
                  <LoaderCircle className="spin" size={16} />
                  <div className="lookup-loading-copy">
                    <strong>{activeMode === 'tournament' ? 'Loading tournament field' : 'Finding public profile'}</strong>
                    <span>{activeMode === 'tournament'
                      ? 'Finding event details and reading its class roster. This can take a moment.'
                      : 'Resolving the profile before reading tournament and Lunar League history.'}</span>
                  </div>
                </div>
              )}
            </div>
            {(activeMode === 'tournament' ? error : playerError) && <div className="error-banner" role="alert"><CircleHelp size={16} /> {activeMode === 'tournament' ? error : playerError}</div>}
          </div>

        </section>

        {activeMode === 'tournament' ? (
          snapshot ? (
          <>
            <section className="workspace-heading">
          <div>
            <div className="eyebrow">CURRENT FIELD <span className="live-dot" /> LIVE DATA</div>
            <h2>{snapshot.name}</h2>
            <p>{snapshot.location}, {snapshot.country} <span className="muted-divider">/</span> {snapshot.sport} <span className="muted-divider">/</span> {formatDate(snapshot.startDate)}</p>
            <p className="print-report-meta">Tournament overview · {classTitle} · Generated {formatDate(new Date().toISOString())} · rankedin.com/en/tournament/{snapshot.tournamentId}</p>
          </div>
          <div className="workspace-actions">
            <button className="text-button share-button" type="button" onClick={() => void copyShareLink()} disabled={!tournamentUrl.trim()}>
              {shareCopied ? <Check size={15} /> : <Copy size={15} />} {shareCopied ? 'Link copied' : 'Copy share link'}
            </button>
            <details className="export-menu">
              <summary className="outline-button export-menu-summary"><Download size={14} /> Export overview</summary>
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
              ? `Top ${Math.round(commonRecentClass.averageTopPercent * 100)}% average · ${commonRecentClass.playerCount} players`
              : 'latest five form results'}
          />
        </section>

        <section className="dashboard-grid">
          <div className="field-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">FIELD BREAKDOWN</div>
                <h2>{classTitle}</h2>
                <p>{snapshot.selectedClass.name.includes('(') ? snapshot.selectedClass.name.match(/\(([^)]+)\)/)?.[1] : 'Selected class'} <span className="muted-divider">/</span> {snapshot.participants.length} pairs visible</p>
              </div>
              <div className="field-card-tools">
                <div className={`placement-load-status ${isLoadingFieldData ? 'is-loading' : ''}`} aria-live="polite">
                  {isLoadingFieldData ? <LoaderCircle className="spin" size={14} /> : <History size={14} />}
                  {isLoadingFieldPlacements
                    ? `Reading latest 5 · ${Object.keys(fieldPlacementSummaries).length}/${snapshot.participants.length * 2} players…`
                    : isLoadingFieldLeagueDivisions
                      ? 'Reading current divisions…'
                      : fieldPlacementsLoaded ? 'Latest 5 per player' : 'Placement summary unavailable'}
                </div>
                <div className="class-picker-wrap">
                  <select value={snapshot.selectedClass.id} onChange={(event) => void chooseClass(Number(event.target.value))} disabled={isLoadingClass || isLoadingFieldData} aria-label="Choose tournament class">
                    {snapshot.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  {isLoadingClass ? <LoaderCircle className="picker-loader spin" size={15} /> : <ChevronDown className="picker-chevron" size={15} />}
                </div>
                {fieldPlacementError && <span className="placement-load-note">{fieldPlacementError}</span>}
                {fieldLeagueDivisionError && <span className="placement-load-note">{fieldLeagueDivisionError}</span>}
              </div>
            </div>

            {(fieldPlacementsLoaded || Object.keys(fieldPlacementSummaries).length > 0) && (
              <section className="field-aggregate" aria-label="Average recent placement by class">
                <div className="field-aggregate-heading">
                  <div>
                    <div className="section-kicker">RECENT FORM BY CLASS</div>
                    <p>Average of the latest five finished tournaments for each player <span className="inline-guidance">· lower is better <InfoTip label="About placement percentages" message="Each result is shown as placement divided by the finished field size, so lower percentages mean stronger finishes." /></span></p>
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
              <div className="table-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Filter players" aria-label="Filter players" /></div>
              <span className="table-count">{visibleParticipants.length} of {snapshot.participants.length} pairs</span>
            </div>

            <div className="table-scroll roster-table-scroll">
              <table className="roster-table">
                <thead><tr><th>PAIR</th><th>LAST 5 / PLAYER</th><th><span className="table-header-with-info">SKILL <InfoTip label="About skill" message="Historical rating shown at tournament start, not a live rating." /></span></th></tr></thead>
                <tbody>
                  {visibleParticipants.map((pair, index) => {
                    const rating = pairRating(pair)
                    const selected = pair.id === selectedPairId
                    return (
                      <tr
                        className={selected ? 'selected-row' : ''}
                        key={pair.id}
                        tabIndex={0}
                        aria-label={`View history for ${pair.first.name} and ${pair.second.name}`}
                        onClick={() => void inspectPair(pair)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            void inspectPair(pair)
                          }
                        }}
                      >
                        <td>
                          <div className="pair-cell">
                            <span className="pair-index">{String(index + 1).padStart(2, '0')}</span>
                            <div><strong>{pair.first.name}</strong><span>{pair.second.name}</span></div>
                          </div>
                        </td>
                        <td>
                          <div className="field-placement-cell">
                            {[pair.first, pair.second].map((player) => {
                              const summary = fieldPlacementSummaries[player.id]
                              const hasSummary = Object.prototype.hasOwnProperty.call(fieldPlacementSummaries, player.id)
                              const events = fieldPlacementEvents(summary ?? null)
                              return (
                                <div className="field-placement-player" key={player.id}>
                                  <span className="field-placement-player-name">{player.name}</span>
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
                  {!visibleParticipants.length && <tr><td colSpan={3} className="empty-table">No pairs match that search.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </section>

        {selectedPair && (
          <section className="history-card pair-history-panel" aria-label={`Pair history for ${selectedPair.first.name} and ${selectedPair.second.name}`}>
            <div className="card-heading card-heading-small">
              <div>
                <div className="section-kicker">PAIR HISTORY</div>
                <h2>{selectedPair.first.name} + {selectedPair.second.name}</h2>
                <p>Placements come first. Open a tournament when you want the match-by-match context.</p>
              </div>
              <button className="icon-button quiet" type="button" onClick={() => { setSelectedPairId(null); setPairHistory(null) }} aria-label="Close pair history"><X size={17} /></button>
            </div>

            <div className="pair-history-grid">
              <PlayerHistoryColumn
                player={selectedPair.first}
                analysis={pairHistory?.first.analysis ?? null}
                error={pairHistory?.first.error ?? null}
                isLoading={isLoadingPair}
                showContext={preferences.showContext}
              />
              <PlayerHistoryColumn
                player={selectedPair.second}
                analysis={pairHistory?.second.analysis ?? null}
                error={pairHistory?.second.error ?? null}
                isLoading={isLoadingPair}
                showContext={preferences.showContext}
              />
            </div>
          </section>
        )}

            <section className="privacy-strip">
              <div className="privacy-icon"><Database size={17} /></div>
              <div><strong>Nothing follows you home.</strong><span>Only small display preferences live in this browser. Tournament and player selections stay in temporary page state.</span></div>
              <button className="privacy-link" type="button" onClick={() => setShowPreferences(true)}>Review preferences <ArrowUpRight size={14} /></button>
            </section>
          </>
          ) : null
        ) : (
          <PlayerProgressWorkspace
            profile={playerProfile}
            analysis={playerAnalysis}
            leagueAnalysis={playerLeagueAnalysis}
            leagueError={playerLeagueError}
            isLoadingLeague={isLoadingLeague}
            error={playerError}
            isLoading={isAnalyzingPlayer}
            loadingStage={playerLoadingStage}
            onCopyShareLink={() => void copyShareLink()}
            shareCopied={shareCopied}
            canShare={Boolean(playerProfile && playerReference.trim())}
          />
        )}
      </main>

      <footer className="footer"><span>Rankedin Explorer</span><span>Read-only personal utility <span className="muted-divider">/</span> source data remains with Rankedin</span><a href="https://api.rankedin.com/swagger/v1/swagger.json" target="_blank" rel="noreferrer">API map <ArrowUpRight size={13} /></a></footer>
    </div>
  )
}

export default App
