import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Database,
  ExternalLink,
  Gauge,
  GitBranch,
  History,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  getEventMatches,
  getClassParticipants,
  getPlayerAnalysis,
  getTournamentSnapshot,
  type MatchRecord,
  type PairRecord,
  type PlayerAnalysis,
  type PlayerEventAnalysis,
  type PlayerRecord,
  type TournamentSnapshot,
} from './lib/rankedin'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type Preferences,
} from './lib/preferences'
import './App.css'

const DEFAULT_TOURNAMENT_URL =
  'https://www.rankedin.com/en/tournament/70385/meny-x-wepadel-open/players'

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
  const dpfMatch = cleanedName.match(/\bDPF\s*(\d+)\b/i)
  if (!dpfMatch) return cleanedName

  let gender: 'Mix' | 'Kvinder' | 'Herrer' | null = null
  if (/\bmix\b/i.test(cleanedName)) gender = 'Mix'
  if (!gender && /kvinder|kvinde|dame|women|woman/i.test(cleanedName)) gender = 'Kvinder'
  if (!gender && /herrer|herre|men|male/i.test(cleanedName)) gender = 'Herrer'
  if (!gender) return `DPF${dpfMatch[1]}`
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
    fieldSize: event.fieldSize ? `of ${event.fieldSize} pairs` : null,
  }
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

function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES
    return loadPreferences()
  })
  const [tournamentUrl, setTournamentUrl] = useState(DEFAULT_TOURNAMENT_URL)
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
  const fieldPlacementRequestRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    savePreferences(preferences)
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences])

  useEffect(() => {
    void loadFieldPlacements(snapshot.participants)
  }, [snapshot.participants, snapshot.selectedClass.id])

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

  async function analyzeTournament() {
    fieldPlacementRequestRef.current += 1
    setIsAnalyzing(true)
    setError(null)
    setSelectedPairId(null)
    setPairHistory(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)

    try {
      const result = await getTournamentSnapshot(tournamentUrl)
      setSnapshot(result)
      setSearchTerm('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The tournament could not be loaded.')
    } finally {
      setIsAnalyzing(false)
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

    const results = await Promise.allSettled(
      players.map((player) => getPlayerAnalysis(player.id, 5)),
    )
    const summaries: Record<number, PlayerAnalysis | null> = {}
    let failedCount = 0

    results.forEach((result, index) => {
      const player = players[index]
      if (result.status === 'fulfilled') {
        summaries[player.id] = { ...result.value, playerName: player.name }
        return
      }

      summaries[player.id] = null
      failedCount += 1
    })

    if (requestId !== fieldPlacementRequestRef.current) return

    setFieldPlacementSummaries(summaries)
    setFieldPlacementsLoaded(true)
    if (failedCount) {
      setFieldPlacementError(`${failedCount} player ${failedCount === 1 ? 'summary was' : 'summaries were'} unavailable.`)
    }
    setIsLoadingFieldPlacements(false)
  }

  function resetToPreview() {
    fieldPlacementRequestRef.current += 1
    setSnapshot(demoSnapshot)
    setTournamentUrl(DEFAULT_TOURNAMENT_URL)
    setSelectedPairId(null)
    setPairHistory(null)
    setFieldPlacementSummaries({})
    setFieldPlacementsLoaded(false)
    setFieldPlacementError(null)
    setIsLoadingFieldPlacements(false)
    setSearchTerm('')
    setError(null)
  }

  return (
    <div className={`app-shell ${preferences.density === 'compact' ? 'density-compact' : ''}`}>
      <header className="topbar">
        <a className="brand" href="." aria-label="Rankedin Explorer home" onClick={resetToPreview}>
          <span className="brand-mark"><Activity size={16} strokeWidth={2.5} /></span>
          <span>rankedin <strong>explorer</strong></span>
        </a>

        <div className="topbar-actions">
          <span className="topbar-label">FIELD GUIDE <span>01</span></span>
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
              <span>History depth</span>
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
            <p className="popover-note">Tournament and pair choices are never stored.</p>
          </div>
        )}
      </header>

      <main>
        <section className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> Rankedin intelligence, without the digging</div>
            <h1>See the level <em>behind</em> the result.</h1>
            <p className="hero-lede">
              A clearer way to read tournament fields, player history and match context across Rankedin.
            </p>

            <div className="input-card">
              <label htmlFor="tournament-url">Start with a public tournament</label>
              <div className="url-input-row">
                <div className="url-input-wrap">
                  <GitBranch size={17} />
                  <input
                    id="tournament-url"
                    value={tournamentUrl}
                    onChange={(event) => setTournamentUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void analyzeTournament()
                    }}
                    placeholder="Paste a Rankedin tournament URL or ID"
                  />
                  {tournamentUrl && <button className="clear-input" type="button" aria-label="Clear tournament URL" onClick={() => setTournamentUrl('')}><X size={14} /></button>}
                </div>
                <button className="primary-button" type="button" onClick={() => void analyzeTournament()} disabled={isAnalyzing || !tournamentUrl.trim()}>
                  {isAnalyzing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                  {isAnalyzing ? 'Reading…' : 'Analyze field'}
                </button>
              </div>
              <p className="input-hint"><Info size={14} /> No login. No database. The example field is ready to explore.</p>
            </div>
            {error && <div className="error-banner" role="alert"><CircleHelp size={16} /> {error}</div>}
          </div>

          <aside className="signal-card">
            <div className="signal-topline"><span>HOW TO READ THIS</span><span className="signal-number">01 / 03</span></div>
            <div className="signal-icon"><Gauge size={21} /></div>
            <h2>Three signals beat one win rate.</h2>
            <p>Class level tells you where they played. Rating tells you the baseline. Results tell you what happened there.</p>
            <div className="signal-list">
              <div><span className="signal-dot signal-dot-sage" /><span>Actual class entered</span><strong>level</strong></div>
              <div><span className="signal-dot signal-dot-blue" /><span>Skill at event start</span><strong>rating</strong></div>
              <div><span className="signal-dot signal-dot-coral" /><span>Placement + matches</span><strong>form</strong></div>
            </div>
          </aside>
        </section>

        <section className="workspace-heading">
          <div>
            <div className="eyebrow">CURRENT FIELD <span className="live-dot" /> {snapshot.source === 'live' ? 'LIVE DATA' : 'PREVIEW DATA'}</div>
            <h2>{snapshot.name}</h2>
            <p>{snapshot.location}, {snapshot.country} <span className="muted-divider">/</span> {snapshot.sport} <span className="muted-divider">/</span> {formatDate(snapshot.startDate)}</p>
          </div>
          <div className="workspace-actions">
            {snapshot.source === 'preview' && <button className="text-button" type="button" onClick={() => void analyzeTournament()}><RefreshCw size={15} /> Refresh live data</button>}
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
                  {isLoadingFieldPlacements ? 'Reading latest 5 per player…' : fieldPlacementsLoaded ? 'Latest 5 per player' : 'Placement summary unavailable'}
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
                              const events = fieldPlacementEvents(summary ?? null)
                              return (
                                <div className="field-placement-player" key={player.id}>
                                  <span className="field-placement-player-name">{player.name}</span>
                                  <span className="field-placement-tags">
                                    {!fieldPlacementsLoaded && <span className="field-placement-muted">Not loaded</span>}
                                    {fieldPlacementsLoaded && summary === null && <span className="field-placement-muted">Unavailable</span>}
                                    {fieldPlacementsLoaded && summary && !events.length && <span className="field-placement-muted">No finished events</span>}
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
                                          {placement.fieldSize && <span className="field-placement-field">{placement.fieldSize}</span>}
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
      </main>

      <footer className="footer"><span>Rankedin Explorer</span><span>Read-only personal utility <span className="muted-divider">/</span> source data remains with Rankedin</span><a href="https://api.rankedin.com/swagger/v1/swagger.json" target="_blank" rel="noreferrer">API map <ArrowUpRight size={13} /></a></footer>
    </div>
  )
}

export default App
