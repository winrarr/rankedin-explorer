import type { PlayerEventAnalysis } from './rankedin'
import { compactClassName } from './formatters'
import { relativeFinishPercent } from './placement'

export type ProgressPoint = {
  event: PlayerEventAnalysis
  className: string
  percentage: number
}

export type ProgressSeries = {
  className: string
  points: ProgressPoint[]
}

export function progressPoints(events: PlayerEventAnalysis[]) {
  return events
    .map((event): ProgressPoint | null => {
      const percentage = relativeFinishPercent(event)
      if (percentage === null || !event.className) return null
      return { event, className: compactClassName(event.className), percentage }
    })
    .filter((point): point is ProgressPoint => point !== null)
}

export function progressSeries(events: PlayerEventAnalysis[]) {
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

export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

export function formatChartDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }).format(date)
}

export function formatProgressDateRange(points: ProgressPoint[]) {
  if (!points.length) return 'No completed results'
  const dates = points
    .map((point) => new Date(point.event.startDate).getTime())
    .filter((value) => !Number.isNaN(value))
  if (!dates.length) return 'Date range unavailable'
  return `${formatChartDate(new Date(Math.min(...dates)).toISOString())} – ${formatChartDate(new Date(Math.max(...dates)).toISOString())}`
}
