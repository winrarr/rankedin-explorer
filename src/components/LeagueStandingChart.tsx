import { useEffect, useState } from 'react'
import type { LeagueSeasonAnalysis, LeagueStandingSnapshot } from '../lib/rankedin'
import { dateTimestamp, formatCompactDate, ordinalPosition } from '../lib/formatters'
import { leagueDivisionIndex, leagueDivisionScale } from '../lib/fieldBreakdown'

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

export function LeagueProgressChart({ seasons }: LeagueProgressChartProps) {
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
