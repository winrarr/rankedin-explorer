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
  ExternalLink,
  Gauge,
  GitBranch,
  History,
  Info,
  LoaderCircle,
  LineChart,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import {
  getEventMatches,
  getClassParticipants,
  getPlayerAnalysis,
  getPlayerProfile,
  searchPlayersByName,
  searchTournamentsByName,
  getTournamentSnapshot,
  type MatchRecord,
  type PairRecord,
  type PlayerAnalysis,
  type PlayerEventAnalysis,
  type PlayerProfile,
  type PlayerRecord,
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
import './App.css'

const PLAYER_PROGRESS_HISTORY_LIMIT = 25

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

const demoParticipants: PairRecord[] = [
  {
    id: '159208-195758-0',
    first: {
      id: 488083,
      rankedInId: 'R000159208',
      name: 'Runa H. Kortsen',
      url: '/en/player/R000159208/runa-h-kortsen',
      rating: 13.93,
    },
    second: {
      id: 839604,
      rankedInId: 'R000195758',
      name: 'Kim Juul Kortsen',
      url: '/en/player/R000195758/kim-juul-kortsen',
      rating: 13.93,
    },
    ranking: null,
  },
  {
    id: '202568-349673-1',
    first: {
      id: 922073,
      rankedInId: 'R000202568',
      name: 'Jens Christian Holme Demant',
      url: '/en/player/R000202568/jens-christian-holme-demant',
      rating: 12.88,
    },
    second: {
      id: 2991674,
      rankedInId: 'R000349673',
      name: 'Eva Holme Demant',
      url: '/en/player/R000349673/eva-holme-demant',
      rating: 12.88,
    },
    ranking: null,
  },
]

const demoSnapshot: TournamentSnapshot = {
  tournamentId: 70385,
  name: 'Meny x WePadel Open',
  location: 'Harlev J',
  country: 'Denmark',
  sport: 'Padel',
  startDate: '2026-09-05T08:00:00',
  endDate: '2026-09-05T22:00:00',
  state: 1,
  isPremium: true,
  classes: [
    { id: 166328, name: 'Herre DPF25 (Først til mølle)', participantsType: 4 },
    { id: 166329, name: 'Dame DPF35 (Først til mølle)', participantsType: 4 },
    { id: 166331, name: 'Mix DPF25 (Først til mølle)', participantsType: 4 },
    { id: 166332, name: 'Herre DPF35 (Først til mølle)', participantsType: 4 },
  ],
  selectedClass: {
    id: 166331,
    name: 'Mix DPF25 (Først til mølle)',
    participantsType: 4,
  },
  participants: demoParticipants,
  source: 'preview',
}

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatRating(value: number | null) {
  return value === null ? '—' : value.toFixed(2)
}

function formatCompactDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(date)
}

function pairRating(pair: PairRecord) {
  const ratings = [pair.first.rating, pair.second.rating].filter(
    (rating): rating is number => rating !== null,
  )
  return ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function placementPosition(event: PlayerEventAnalysis) {
  if (event.standing === null) return '—'
  if (event.standingRangeTo && event.standingRangeTo !== event.standing) {
    return `${event.standing}–${event.standingRangeTo}`
  }
  return String(event.standing)
}

function ordinalPosition(value: number | null) {
  if (value === null) return '—'
  const remainder = value % 100
  const suffix = remainder >= 11 && remainder <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'
  return `${value}${suffix}`
}

function placementSummaryPosition(event: PlayerEventAnalysis) {
  if (event.standing === null) return '—'
  if (event.standingRangeTo && event.standingRangeTo !== event.standing) {
    return `${ordinalPosition(event.standing)}–${ordinalPosition(event.standingRangeTo)}`
  }
  return ordinalPosition(event.standing)
}

function placementField(event: PlayerEventAnalysis) {
  return event.fieldSize ? `of ${event.fieldSize} pairs` : 'field size unavailable'
}

function compactClassName(className: string | null) {
  if (!className) return 'Class unavailable'
  const cleanedName = className
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*-\s*(?:formiddag|eftermiddag|ftm|først til mølle).*$/i, '')
    .replace(/\s*-\s*maks.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const dpfMatch = className.match(/\bDPF\s*(\d+)\b/i)
  if (!dpfMatch) return cleanedName

  const hasMix = /\bmix\b/i.test(className)
  const hasWomen = /\b(?:kvinder?|damer?|women?|female)\b/i.test(className)
  const hasMen = /\b(?:herrer?|men|male)\b/i.test(className)
  let gender: 'Mix' | 'Kvinder' | 'Herrer' | null = null
  if (hasMix) gender = 'Mix'
  if (!gender && hasWomen) gender = 'Kvinder'
  if (!gender && hasMen) gender = 'Herrer'
  if (!gender) return `DPF${dpfMatch[1]} (gender not listed)`
  if (gender === 'Mix') return `DPF${dpfMatch[1]} Mix`
  return `DPF${dpfMatch[1]} ${gender}`
}

function fieldPlacementEvents(analysis: PlayerAnalysis | null) {
  return analysis?.events.filter((event) => event.className).slice(0, 5) ?? []
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

type FieldClassSummary = {
  className: string
  averageTopPercent: number
  resultCount: number
  playerCount: number
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

const progressSeriesColors = ['#587866', '#1f6b82', '#d56e59', '#8b6f47', '#6b638c']

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
  const groups = new Map<string, { percentages: number[]; players: Set<number> }>()

  Object.values(analyses).forEach((analysis) => {
    if (!analysis) return

    fieldPlacementEvents(analysis).forEach((event) => {
      const percentage = averagePlacement(event)
      if (percentage === null) return

      const className = compactClassName(event.className)
      const group = groups.get(className) ?? { percentages: [], players: new Set<number>() }
      group.percentages.push(percentage)
      group.players.add(analysis.playerId)
      groups.set(className, group)
    })
  })

  return Array.from(groups, ([className, group]): FieldClassSummary => ({
    className,
    averageTopPercent: group.percentages.reduce((sum, value) => sum + value, 0) / group.percentages.length,
    resultCount: group.percentages.length,
    playerCount: group.players.size,
  })).sort((first, second) => first.averageTopPercent - second.averageTopPercent)
}

function matchRecord(matches: PlayerEventAnalysis['matches']) {
  const wins = matches.filter((match) => match.won === true).length
  const losses = matches.filter((match) => match.won === false).length
  return { wins, losses }
}

type PlayerHistoryColumnProps = {
  player: PlayerRecord
  analysis: PlayerAnalysis | null
  error: string | null
  isLoading: boolean
  showContext: boolean
}

function PlayerHistoryColumn({
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
  const events = analysis?.events ?? []
  const matches = events.flatMap((event) => matchStates[event.id]?.matches ?? event.matches)
  const record = matchRecord(matches)

  useEffect(() => {
    setMatchStates({})
  }, [analysis?.playerId])

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
          href={`https://www.rankedin.com${player.url}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${player.name} on Rankedin`}
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
          <div className="trace-metrics">
            <div><strong>{events.filter((event) => event.className).length}</strong><span>events found</span></div>
            <div><strong>{matches.length || '—'}</strong><span>matches loaded</span></div>
            <div><strong>{matches.length ? `${record.wins}–${record.losses}` : '—'}</strong><span>loaded record</span></div>
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
                <article className="placement-item" key={`${player.id}-${event.id}`}>
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
                      {event.partner ? `With ${event.partner}` : 'Partner unavailable'}
                      {eventMatches.length ? ` · ${eventRecord.wins}–${eventRecord.losses} in matches` : ''}
                    </span>
                    {event.matchQuery ? (
                      <details className="match-details" open={showContext}>
                        <summary>
                          <span>Explore match details</span>
                          <span>{eventMatches.length ? `${eventMatches.length} ${eventMatches.length === 1 ? 'match' : 'matches'}` : 'load matches'}</span>
                        </summary>
                        {eventMatches.length > 0 ? (
                          <div className="match-details-list">
                            {eventMatches.map((match) => (
                              <div className="match-detail-row" key={match.id}>
                                <span className={`match-result ${match.won === true ? 'win' : match.won === false ? 'loss' : ''}`}>
                                  {match.won === true ? 'W' : match.won === false ? 'L' : '—'}
                                </span>
                                <div className="match-detail-opponent">
                                  <strong>{match.opponents.length ? `vs ${match.opponents.join(' + ')}` : 'Opponent unavailable'}</strong>
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
            return (
              <g key={item.className}>
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

type PlayerProgressWorkspaceProps = {
  profile: PlayerProfile | null
  analysis: PlayerAnalysis | null
  error: string | null
  isLoading: boolean
  loadingStage: 'profile' | 'history' | null
  historyLimit: number
  onCopyShareLink: () => void
  shareCopied: boolean
  canShare: boolean
}

function PlayerProgressWorkspace({ profile, analysis, error, isLoading, loadingStage, historyLimit, onCopyShareLink, shareCopied, canShare }: PlayerProgressWorkspaceProps) {
  const series = useMemo(() => progressSeries(analysis?.events ?? []), [analysis])
  const points = useMemo(() => series.flatMap((item) => item.points), [series])
  const latestPoint = [...points].sort((first, second) => (
    new Date(second.event.startDate).getTime() - new Date(first.event.startDate).getTime()
  ))[0]
  const average = points.length ? points.reduce((sum, point) => sum + point.percentage, 0) / points.length : null
  const unavailableCount = analysis ? analysis.events.length - points.length : 0

  return (
    <>
      <section className="workspace-heading">
        <div>
          <div className="eyebrow">PLAYER PROGRESS <span className="live-dot" /> {profile ? 'LIVE DATA' : 'READY'}</div>
          <h2>{profile?.name ?? 'Look up your progress'}</h2>
          <p>{profile ? `${profile.homeClubName ?? 'Home club unavailable'} / ${profile.countryCode?.toUpperCase() ?? 'Country unavailable'} / ${points.length || 'No'} comparable results` : 'Use a public Rankedin profile to see placement over time.'}</p>
        </div>
        {profile && (
          <div className="workspace-actions">
            <button className="text-button share-button" type="button" onClick={onCopyShareLink} disabled={!canShare}>
              {shareCopied ? <Check size={15} /> : <Copy size={15} />} {shareCopied ? 'Link copied' : 'Copy share link'}
            </button>
            <a className="outline-button" href={`https://www.rankedin.com${profile.url}`} target="_blank" rel="noreferrer">Open profile <ArrowUpRight size={15} /></a>
          </div>
        )}
      </section>

      {error && <div className="error-banner" role="alert"><CircleHelp size={16} /> {error}</div>}

      {isLoading && !analysis && (
        <section className="progress-empty-card">
          <div className="trace-empty-icon"><LoaderCircle className="spin" size={21} /></div>
          <h3>{loadingStage === 'profile' ? 'Finding the public profile' : 'Reading finished tournament history'}</h3>
          <p>{loadingStage === 'profile'
            ? 'The profile is being resolved before its tournament history is checked.'
            : 'Rankedin is checking the latest finished events for their class, placement and field size.'}</p>
        </section>
      )}

      {isLoading && analysis && (
        <div className="progress-loading-strip" aria-live="polite">
          <LoaderCircle className="spin" size={15} />
          <span>{loadingStage === 'history' ? `Reading history · ${analysis.events.length} of the latest ${historyLimit} events found so far` : 'Resolving public profile'}</span>
        </div>
      )}

      {!isLoading && !analysis && !error && (
        <section className="progress-empty-card">
          <div className="trace-empty-icon"><LineChart size={21} /></div>
          <h3>Your placement story starts here.</h3>
          <p>Paste a public Rankedin profile above to compare your finishes across levels and classes.</p>
          <div className="trace-rule"><span /><span /><span /></div>
        </section>
      )}

      {analysis && (
        <>
          <section className="metric-grid progress-metric-grid" aria-label="Player progress summary">
            <div className="metric-card metric-card-dark">
              <div className="metric-label"><Trophy size={15} /> RESULTS CHARTED</div>
              <strong>{points.length}</strong>
              <span>finished tournament placements</span>
            </div>
            <div className="metric-card">
              <div className="metric-label"><Users size={15} /> LEVELS IN HISTORY</div>
              <strong>{series.length}</strong>
              <span>level / class series</span>
            </div>
            <div className="metric-card">
              <div className="metric-label"><Gauge size={15} /> AVERAGE FINISH</div>
              <strong>{formatPercent(average)}</strong>
              <span>lower is better</span>
            </div>
            <div className="metric-card">
              <div className="metric-label"><CalendarDays size={15} /> LATEST RESULT</div>
              <strong>{latestPoint ? formatPercent(latestPoint.percentage) : '—'}</strong>
              <span>{latestPoint ? formatCompactDate(latestPoint.event.startDate) : 'no comparable result'}</span>
            </div>
          </section>

          <section className="field-card progress-card">
            <div className="card-heading">
              <div>
                <div className="section-kicker">PLACEMENT TIMELINE</div>
                <h2>See the level behind the result.</h2>
                <p>{formatProgressDateRange(points)} <span className="muted-divider">/</span> each point is one finished tournament</p>
              </div>
              <span className="progress-card-direction">lower is better</span>
            </div>
            <ProgressChart series={series} />
            <p className="progress-chart-note"><Info size={14} /> Placement percentage is standing divided by the finished field size. Lines only connect results within the same normalized class.</p>
          </section>

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
                <h2>Check the points behind the pattern.</h2>
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
            {unavailableCount > 0 && <p className="progress-chart-note"><Info size={14} /> {unavailableCount} event {unavailableCount === 1 ? 'record is' : 'records are'} not shown because Rankedin did not provide a comparable finished placement.</p>}
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
  const [isAnalyzingPlayer, setIsAnalyzingPlayer] = useState(false)
  const [playerLoadingStage, setPlayerLoadingStage] = useState<'profile' | 'history' | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<TournamentSnapshot>(demoSnapshot)
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
  const [showPlayerSearch, setShowPlayerSearch] = useState(false)
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchResult[]>([])
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false)
  const [playerSearchError, setPlayerSearchError] = useState<string | null>(null)
  const [tournamentSearchResults, setTournamentSearchResults] = useState<TournamentSearchResult[]>([])
  const [isSearchingTournaments, setIsSearchingTournaments] = useState(false)
  const [tournamentSearchError, setTournamentSearchError] = useState<string | null>(null)
  const [showTournamentSearch, setShowTournamentSearch] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const fieldPlacementRequestRef = useRef(0)
  const playerRequestRef = useRef(0)
  const playerSearchRequestRef = useRef(0)
  const tournamentSearchRequestRef = useRef(0)
  const lastAnalyzedTournamentReferenceRef = useRef('')
  const playerSearchRef = useRef<HTMLDivElement>(null)
  const tournamentSearchRef = useRef<HTMLDivElement>(null)
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
    function closeSearchMenus(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (!playerSearchRef.current?.contains(event.target)) setShowPlayerSearch(false)
      if (!tournamentSearchRef.current?.contains(event.target)) setShowTournamentSearch(false)
    }

    document.addEventListener('pointerdown', closeSearchMenus)
    return () => document.removeEventListener('pointerdown', closeSearchMenus)
  }, [])

  useEffect(() => {
    const normalizedTerm = playerSearchTerm.trim()
    const requestId = playerSearchRequestRef.current + 1
    playerSearchRequestRef.current = requestId
    setPlayerSearchResults([])
    setPlayerSearchError(null)
    setIsSearchingPlayers(false)

    if (activeMode !== 'player' || !showPlayerSearch || normalizedTerm.length < 2) return

    const timeout = window.setTimeout(() => {
      setIsSearchingPlayers(true)
      void searchPlayersByName(normalizedTerm)
        .then((results) => {
          if (requestId !== playerSearchRequestRef.current) return
          setPlayerSearchResults(results)
        })
        .catch((caught) => {
          if (requestId !== playerSearchRequestRef.current) return
          setPlayerSearchError(caught instanceof Error ? caught.message : 'Player search could not be completed.')
        })
        .finally(() => {
          if (requestId === playerSearchRequestRef.current) setIsSearchingPlayers(false)
        })
    }, 280)

    return () => window.clearTimeout(timeout)
  }, [activeMode, playerSearchTerm, showPlayerSearch])

  useEffect(() => {
    const normalizedTerm = tournamentUrl.trim()
    const requestId = tournamentSearchRequestRef.current + 1
    tournamentSearchRequestRef.current = requestId
    setTournamentSearchResults([])
    setTournamentSearchError(null)
    setIsSearchingTournaments(false)

    if (activeMode !== 'tournament' || isDirectTournamentReference(normalizedTerm) || normalizedTerm.length < 2) return

    const timeout = window.setTimeout(() => {
      setIsSearchingTournaments(true)
      void searchTournamentsByName(normalizedTerm)
        .then((results) => {
          if (requestId !== tournamentSearchRequestRef.current) return
          setTournamentSearchResults(results)
        })
        .catch((caught) => {
          if (requestId !== tournamentSearchRequestRef.current) return
          setTournamentSearchError(caught instanceof Error ? caught.message : 'Tournament search could not be completed.')
        })
        .finally(() => {
          if (requestId === tournamentSearchRequestRef.current) setIsSearchingTournaments(false)
        })
    }, 280)

    return () => window.clearTimeout(timeout)
  }, [activeMode, tournamentUrl])

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
    if (activeMode !== 'tournament' || snapshot.source !== 'live') return
    void loadFieldPlacements(snapshot.participants)
  }, [activeMode, snapshot.participants, snapshot.selectedClass.id, snapshot.source])

  const visibleParticipants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return snapshot.participants

    return snapshot.participants.filter((pair) =>
      `${pair.first.name} ${pair.second.name}`.toLowerCase().includes(normalizedSearch),
    )
  }, [searchTerm, snapshot.participants])

  const ratings = snapshot.participants
    .map(pairRating)
    .filter((rating): rating is number => rating !== null)
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null
  const ratingSpread = ratings.length > 1 ? Math.max(...ratings) - Math.min(...ratings) : null
  const selectedPair = snapshot.participants.find((pair) => pair.id === selectedPairId)
  const classTitle = snapshot.selectedClass.name.replace(/\s*\([^)]*\)/, '')
  const fieldClassSummaries = useMemo(
    () => summarizeFieldPlacements(fieldPlacementSummaries),
    [fieldPlacementSummaries],
  )

  async function analyzeTournament(reference = tournamentUrl, selectedClassId?: number) {
    const normalizedReference = reference.trim()
    if (!normalizedReference) return

    lastAnalyzedTournamentReferenceRef.current = normalizedReference
    setShowTournamentSearch(false)
    fieldPlacementRequestRef.current += 1
    setIsAnalyzing(true)
    setError(null)
    setShareCopied(false)
    setSelectedPairId(null)
    setPairHistory(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
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

    const requestId = playerRequestRef.current + 1
    playerRequestRef.current = requestId
    setIsAnalyzingPlayer(true)
    setPlayerLoadingStage('profile')
    setPlayerError(null)
    setShareCopied(false)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerReference(normalizedReference)
    updateSharedLocation({ mode: 'player', player: normalizedReference })

    try {
      const profile = await getPlayerProfile(normalizedReference)
      if (requestId !== playerRequestRef.current) return
      updateSharedLocation({ mode: 'player', player: profile.rankedInId })
      setPlayerProfile(profile)
      setPlayerAnalysis({ playerId: profile.id, playerName: profile.name, events: [] })
      setPlayerLoadingStage('history')
      const analysis = await getPlayerAnalysis(profile.id, PLAYER_PROGRESS_HISTORY_LIMIT, (event) => {
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
      })
      if (requestId !== playerRequestRef.current) return
      setPlayerAnalysis({ ...analysis, playerName: profile.name })
    } catch (caught) {
      if (requestId !== playerRequestRef.current) return
      setPlayerError(caught instanceof Error ? caught.message : 'The player could not be loaded.')
    } finally {
      if (requestId === playerRequestRef.current) {
        setIsAnalyzingPlayer(false)
        setPlayerLoadingStage(null)
      }
    }
  }

  function selectPlayerSearchResult(player: PlayerSearchResult) {
    setPlayerSearchTerm('')
    setPlayerSearchResults([])
    setPlayerSearchError(null)
    setShowPlayerSearch(false)
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

  async function chooseClass(classId: number) {
    const nextClass = snapshot.classes.find((item) => item.id === classId)
    if (!nextClass || nextClass.id === snapshot.selectedClass.id) return

    setIsLoadingClass(true)
    fieldPlacementRequestRef.current += 1
    setError(null)

    try {
      const participants = await getClassParticipants(snapshot.tournamentId, classId)
      setSnapshot((current) => ({ ...current, selectedClass: nextClass, participants, source: 'live' }))
      setSelectedPairId(null)
      setPairHistory(null)
      setFieldPlacementSummaries({})
      setFieldPlacementsLoaded(false)
      setFieldPlacementError(null)
      setIsLoadingFieldPlacements(false)
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

    const results = await Promise.allSettled(
      players.map(async (player) => {
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
      }),
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

  function resetToPreview() {
    playerRequestRef.current += 1
    setActiveMode('tournament')
    fieldPlacementRequestRef.current += 1
    setSnapshot(demoSnapshot)
    setTournamentUrl('')
    setPlayerReference('')
    setSelectedPairId(null)
    setPairHistory(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
    setSearchTerm('')
    setError(null)
    setPlayerProfile(null)
    setPlayerAnalysis(null)
    setPlayerError(null)
    setIsAnalyzingPlayer(false)
    setPlayerLoadingStage(null)
    setShowPlayerSearch(false)
    setShowTournamentSearch(false)
    setPlayerSearchTerm('')
    setPlayerSearchResults([])
    setPlayerSearchError(null)
    setShareCopied(false)
    updateSharedLocation({ mode: 'tournament' })
  }

  function switchMode(nextMode: WorkspaceMode) {
    if (nextMode === activeMode) return

    fieldPlacementRequestRef.current += 1
    setIsLoadingFieldPlacements(false)
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
    setShareCopied(false)
    updateSharedLocation({
      mode: nextMode,
      tournament: tournamentUrl,
      classId: snapshot.source === 'live' ? snapshot.selectedClass.id : undefined,
      player: playerReference,
    })
  }

  return (
    <div className={`app-shell ${preferences.density === 'compact' ? 'density-compact' : ''}`}>
      <header className="topbar">
        <a className="brand" href="." aria-label="Rankedin Explorer home" onClick={(event) => { event.preventDefault(); resetToPreview() }}>
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
                {activeMode === 'tournament' ? 'Start with a public tournament' : 'Start with a public Rankedin profile'}
              </label>
              <div className="reference-search-anchor" ref={tournamentSearchRef}>
                <div className="url-input-row">
                  <div className="url-input-wrap">
                    {activeMode === 'tournament' ? <GitBranch size={17} /> : <UserRound size={17} />}
                    <input
                      id={activeMode === 'tournament' ? 'tournament-url' : 'player-reference'}
                      value={activeMode === 'tournament' ? tournamentUrl : playerReference}
                      onChange={(event) => {
                        if (activeMode === 'tournament') {
                          setTournamentUrl(event.target.value)
                          setShowTournamentSearch(true)
                        } else {
                          setPlayerReference(event.target.value)
                        }
                      }}
                      onFocus={() => {
                        if (activeMode === 'tournament' && !isDirectTournamentReference(tournamentUrl)) setShowTournamentSearch(true)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void (activeMode === 'tournament' ? analyzeTournament() : analyzePlayer())
                      }}
                      placeholder={activeMode === 'tournament' ? 'Search tournament name, URL or ID' : 'Paste a Rankedin profile URL or R-number'}
                    />
                    {(activeMode === 'tournament' ? tournamentUrl : playerReference) && <button className="clear-input" type="button" aria-label={`Clear ${activeMode} reference`} onClick={clearReference}><X size={14} /></button>}
                  </div>
                  <button className="primary-button" type="button" onClick={() => void (activeMode === 'tournament' ? analyzeTournament() : analyzePlayer())} disabled={activeMode === 'tournament' ? isAnalyzing || !tournamentUrl.trim() : isAnalyzingPlayer || !playerReference.trim()}>
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
              </div>
              {activeMode === 'player' && (
                <div className="player-search" ref={playerSearchRef}>
                  <div className="player-search-row">
                    <div className="url-input-wrap">
                      <Search size={16} />
                      <input
                        value={playerSearchTerm}
                        onChange={(event) => {
                          setPlayerSearchTerm(event.target.value)
                          setShowPlayerSearch(true)
                        }}
                        onFocus={() => setShowPlayerSearch(true)}
                        placeholder="Search Rankedin players by name"
                        aria-label="Search Rankedin players by name"
                      />
                    </div>
                  </div>
                  {showPlayerSearch && (
                    <div className="player-search-panel">
                      {isSearchingPlayers && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin profiles…</p>}
                      {playerSearchError && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {playerSearchError}</p>}
                      {!isSearchingPlayers && !playerSearchError && playerSearchTerm.trim().length >= 2 && !playerSearchResults.length && <p className="player-search-status">No public players matched that name.</p>}
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
              )}
              <p className="input-hint"><Info size={14} /> No login. No database. {activeMode === 'tournament' ? 'Paste a public tournament URL or ID to begin.' : 'Only finished public tournament results are charted.'}</p>
            </div>
            {(activeMode === 'tournament' ? error : playerError) && <div className="error-banner" role="alert"><CircleHelp size={16} /> {activeMode === 'tournament' ? error : playerError}</div>}
          </div>

          <aside className="signal-card">
            <div className="signal-topline"><span>HOW TO READ THIS</span></div>
            <div className="signal-icon"><Gauge size={21} /></div>
            <h2>Three questions beat one win rate.</h2>
            <p>Use the field level, the finish and the match context together to understand what a Rankedin result really says.</p>
            <div className="signal-list">
              <div><span className="signal-dot signal-dot-sage" /><span>Where did they play?</span><strong>level</strong></div>
              <div><span className="signal-dot signal-dot-blue" /><span>How did they finish?</span><strong>placement</strong></div>
              <div><span className="signal-dot signal-dot-coral" /><span>Who did they face?</span><strong>matches</strong></div>
            </div>
          </aside>
        </section>

        {activeMode === 'tournament' ? (
          <>
            <section className="workspace-heading">
          <div>
            <div className="eyebrow">CURRENT FIELD <span className="live-dot" /> {snapshot.source === 'live' ? 'LIVE DATA' : 'PREVIEW DATA'}</div>
            <h2>{snapshot.name}</h2>
            <p>{snapshot.location}, {snapshot.country} <span className="muted-divider">/</span> {snapshot.sport} <span className="muted-divider">/</span> {formatDate(snapshot.startDate)}</p>
          </div>
          <div className="workspace-actions">
            {snapshot.source === 'preview' && <button className="text-button" type="button" onClick={() => void analyzeTournament()}><RefreshCw size={15} /> Refresh live data</button>}
            <button className="text-button share-button" type="button" onClick={() => void copyShareLink()} disabled={snapshot.source !== 'live' || !tournamentUrl.trim()}>
              {shareCopied ? <Check size={15} /> : <Copy size={15} />} {shareCopied ? 'Link copied' : 'Copy share link'}
            </button>
            <a className="outline-button" href={`https://www.rankedin.com/en/tournament/${snapshot.tournamentId}`} target="_blank" rel="noreferrer">Open event <ArrowUpRight size={15} /></a>
          </div>
        </section>

        <section className="metric-grid" aria-label="Field summary">
          <div className="metric-card metric-card-dark">
            <div className="metric-label"><Users size={15} /> REGISTERED IN CLASS</div>
            <strong>{snapshot.participants.length * 2}</strong>
            <span>players / {snapshot.participants.length} pairs</span>
          </div>
          <div className="metric-card">
            <div className="metric-label"><Trophy size={15} /> CLASSES IN EVENT</div>
            <strong>{snapshot.classes.length}</strong>
            <span>competition levels visible</span>
          </div>
          <div className="metric-card">
            <div className="metric-label"><Gauge size={15} /> AVERAGE SKILL</div>
            <strong>{formatRating(averageRating)}</strong>
            <span>historical rating at entry</span>
          </div>
          <div className="metric-card">
            <div className="metric-label"><Activity size={15} /> FIELD SPREAD</div>
            <strong>{ratingSpread === null ? '—' : ratingSpread.toFixed(2)}</strong>
            <span>highest vs lowest average</span>
          </div>
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
                <div className="placement-load-status" aria-live="polite">
                  {isLoadingFieldPlacements ? <LoaderCircle className="spin" size={14} /> : <History size={14} />}
                  {isLoadingFieldPlacements
                    ? `Reading latest 5 · ${Object.keys(fieldPlacementSummaries).length}/${snapshot.participants.length * 2} players…`
                    : fieldPlacementsLoaded ? 'Latest 5 per player' : 'Placement summary unavailable'}
                </div>
                <div className="class-picker-wrap">
                  <select value={snapshot.selectedClass.id} onChange={(event) => void chooseClass(Number(event.target.value))} disabled={isLoadingClass || isLoadingFieldPlacements} aria-label="Choose tournament class">
                    {snapshot.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                  {isLoadingClass ? <LoaderCircle className="picker-loader spin" size={15} /> : <ChevronDown className="picker-chevron" size={15} />}
                </div>
                {fieldPlacementError && <span className="placement-load-note">{fieldPlacementError}</span>}
              </div>
            </div>

            {(fieldPlacementsLoaded || Object.keys(fieldPlacementSummaries).length > 0) && (
              <section className="field-aggregate" aria-label="Average recent placement by class">
                <div className="field-aggregate-heading">
                  <div>
                    <div className="section-kicker">RECENT FORM BY CLASS</div>
                    <p>Average of the latest five finished tournaments for each player.</p>
                  </div>
                  <span>lower is better</span>
                </div>
                {fieldClassSummaries.length ? (
                  <div className="field-aggregate-grid">
                    {fieldClassSummaries.map((summary) => {
                      const percentage = Math.round(summary.averageTopPercent * 100)
                      return (
                        <article className="field-aggregate-card" key={summary.className}>
                          <span className="field-aggregate-class">{summary.className}</span>
                          <strong>Top {percentage}%</strong>
                          <span>{summary.resultCount} results · {summary.playerCount} players</span>
                          <div className="field-aggregate-scale" aria-hidden="true">
                            <span className="field-aggregate-marker" style={{ left: `${percentage}%` }} />
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="field-aggregate-empty">No comparable finished placements were found yet.</p>
                )}
                <p className="field-aggregate-note"><Info size={13} /> Top percentage is placement divided by the finished field size; a lower percentage means a stronger average finish.</p>
              </section>
            )}

            <div className="table-toolbar">
              <div className="table-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Filter players" aria-label="Filter players" /></div>
              <span className="table-count">{visibleParticipants.length} of {snapshot.participants.length} pairs</span>
            </div>

            <div className="table-scroll">
              <table className="roster-table">
                <thead><tr><th>PAIR</th><th>LAST 5 / PLAYER</th><th>SKILL</th><th>RANK</th><th>FIELD SIGNAL</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {visibleParticipants.map((pair, index) => {
                    const rating = pairRating(pair)
                    const selected = pair.id === selectedPairId
                    return (
                      <tr className={selected ? 'selected-row' : ''} key={pair.id}>
                        <td>
                          <button className="pair-cell pair-select-button" type="button" onClick={() => void inspectPair(pair)}>
                            <span className="pair-index">{String(index + 1).padStart(2, '0')}</span>
                            <div><strong>{pair.first.name}</strong><span>{pair.second.name}</span></div>
                          </button>
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
                                    {!hasSummary && isLoadingFieldPlacements && <span className="field-placement-muted">Reading…</span>}
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
                        <td>{pair.ranking === null ? <span className="empty-value">not published</span> : pair.ranking}</td>
                        <td><span className={`signal-pill ${rating !== null && rating >= (averageRating ?? 0) ? 'signal-pill-strong' : ''}`}>{rating !== null && rating >= (averageRating ?? 0) ? 'above field avg.' : 'field baseline'}</span></td>
                        <td><button className="row-action" type="button" onClick={() => void inspectPair(pair)} aria-label={`View history for ${pair.first.name} and ${pair.second.name}`}><ArrowUpRight size={16} /></button></td>
                      </tr>
                    )
                  })}
                  {!visibleParticipants.length && <tr><td colSpan={6} className="empty-table">No pairs match that search.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footnote"><Info size={14} /> Skill is the historical value shown at tournament start, not a live rating.</div>
          </div>

          <aside className="history-card">
            <div className="card-heading card-heading-small">
              <div>
                <div className="section-kicker">PAIR HISTORY</div>
                <h2>{selectedPair ? `${selectedPair.first.name} + ${selectedPair.second.name}` : 'Compare a pair over time'}</h2>
                {selectedPair && <p>Placements come first. Open a tournament when you want the match-by-match context.</p>}
              </div>
              {selectedPair && <button className="icon-button quiet" type="button" onClick={() => { setSelectedPairId(null); setPairHistory(null) }} aria-label="Close pair history"><X size={17} /></button>}
            </div>

            {!selectedPair && (
              <div className="trace-empty">
                <div className="trace-empty-icon"><History size={21} /></div>
                <h3>See the last {preferences.historyLimit} finished events for both players.</h3>
                <p>Choose a pair above to compare their classes, placements and field sizes. Match details stay one click away.</p>
                <div className="trace-rule"><span /><span /><span /></div>
              </div>
            )}

            {selectedPair && (
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
            )}
          </aside>
        </section>

            <section className="privacy-strip">
              <div className="privacy-icon"><Database size={17} /></div>
              <div><strong>Nothing follows you home.</strong><span>Only small display preferences live in this browser. Tournament and player selections stay in temporary page state.</span></div>
              <button className="privacy-link" type="button" onClick={() => setShowPreferences(true)}>Review preferences <ArrowUpRight size={14} /></button>
            </section>
          </>
        ) : (
          <PlayerProgressWorkspace
            profile={playerProfile}
            analysis={playerAnalysis}
            error={playerError}
            isLoading={isAnalyzingPlayer}
            loadingStage={playerLoadingStage}
            historyLimit={PLAYER_PROGRESS_HISTORY_LIMIT}
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
