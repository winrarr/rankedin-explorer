import {
  normalizeCompetitionClassName,
  type MatchRecord,
  type PlayerEventAnalysis,
} from './rankedin'

export function dateTimestamp(value: string) {
  const rankedInDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/)
  if (!rankedInDate) return new Date(value).getTime()
  return new Date(`${rankedInDate[3]}-${rankedInDate[2]}-${rankedInDate[1]}T${rankedInDate[4] ?? '00'}:${rankedInDate[5] ?? '00'}:00`).getTime()
}

export function formatDate(value: string) {
  const timestamp = dateTimestamp(value)
  if (Number.isNaN(timestamp)) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp))
}

export function formatCompactDate(value: string) {
  const timestamp = dateTimestamp(value)
  if (Number.isNaN(timestamp)) return 'Unknown date'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp))
}

export function formatRating(value: number | null) {
  return value === null ? '—' : value.toFixed(2)
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function compactClassName(className: string | null) {
  return normalizeCompetitionClassName(className).name
}

export function ordinalPosition(value: number | null) {
  if (value === null) return '—'
  const remainder = value % 100
  const suffix = remainder >= 11 && remainder <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'
  return `${value}${suffix}`
}

export function placementPosition(event: PlayerEventAnalysis) {
  if (event.standing === null) return '—'
  if (event.standingRangeTo && event.standingRangeTo !== event.standing) {
    return `${event.standing}–${event.standingRangeTo}`
  }
  return String(event.standing)
}

export function placementSummaryPosition(event: PlayerEventAnalysis) {
  if (event.standing === null) return '—'
  if (event.standingRangeTo && event.standingRangeTo !== event.standing) {
    return `${ordinalPosition(event.standing)}–${ordinalPosition(event.standingRangeTo)}`
  }
  return ordinalPosition(event.standing)
}

export function placementField(event: PlayerEventAnalysis) {
  return event.fieldSize ? `of ${event.fieldSize} pairs` : 'field size unavailable'
}

export function matchRecord(matches: MatchRecord[]) {
  const wins = matches.filter((match) => match.won === true).length
  const losses = matches.filter((match) => match.won === false).length
  return { wins, losses }
}

export function formatWinLossRecord(record: { wins: number; losses: number } | null | undefined) {
  return record ? `${record.wins}–${record.losses}` : '—'
}
