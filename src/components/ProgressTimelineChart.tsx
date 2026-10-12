import { useEffect, useState } from 'react'
import { formatDate, placementSummaryPosition } from '../lib/formatters'
import {
  formatChartDate,
  formatPercent,
  type ProgressPoint,
  type ProgressSeries,
} from '../lib/playerProgress'
import { progressSeriesColors } from './playerProgressColors'

type ProgressRegression = {
  startTimestamp: number
  endTimestamp: number
  startPercentage: number
  endPercentage: number
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

type ProgressTimelineChartProps = {
  series: ProgressSeries[]
}

export function ProgressTimelineChart({ series }: ProgressTimelineChartProps) {
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
