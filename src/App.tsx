import { useEffect, useMemo, useState } from 'react'
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
  getClassParticipants,
  getPlayerAnalysis,
  getTournamentSnapshot,
  type PairRecord,
  type PlayerAnalysis,
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

function playerIsSelected(pair: PairRecord, playerId: number | null) {
  return pair.first.id === playerId || pair.second.id === playerId
}

function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES
    return loadPreferences()
  })
  const [tournamentUrl, setTournamentUrl] = useState(DEFAULT_TOURNAMENT_URL)
  const [snapshot, setSnapshot] = useState<TournamentSnapshot>(demoSnapshot)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [playerAnalysis, setPlayerAnalysis] = useState<PlayerAnalysis | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoadingClass, setIsLoadingClass] = useState(false)
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    savePreferences(preferences)
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences])

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
  const selectedPair = snapshot.participants.find((pair) =>
    playerIsSelected(pair, selectedPlayerId),
  )
  const selectedPlayer = selectedPair
    ? selectedPair.first.id === selectedPlayerId
      ? selectedPair.first
      : selectedPair.second
    : null
  const analyzedMatches = playerAnalysis?.events.flatMap((event) => event.matches) ?? []
  const wins = analyzedMatches.filter((match) => match.won === true).length
  const losses = analyzedMatches.filter((match) => match.won === false).length
  const classTitle = snapshot.selectedClass.name.replace(/\s*\([^)]*\)/, '')

  async function analyzeTournament() {
    setIsAnalyzing(true)
    setError(null)
    setSelectedPlayerId(null)
    setPlayerAnalysis(null)

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
    setError(null)

    try {
      const participants = await getClassParticipants(snapshot.tournamentId, classId)
      setSnapshot((current) => ({ ...current, selectedClass: nextClass, participants, source: 'live' }))
      setSelectedPlayerId(null)
      setPlayerAnalysis(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This class could not be loaded.')
    } finally {
      setIsLoadingClass(false)
    }
  }

  async function inspectPlayer(pair: PairRecord) {
    const player = pair.first
    setSelectedPlayerId(player.id)
    setPlayerAnalysis(null)
    setPlayerError(null)
    setIsLoadingPlayer(true)

    try {
      const result = await getPlayerAnalysis(player.id, preferences.historyLimit)
      setPlayerAnalysis({ ...result, playerName: player.name })
    } catch (caught) {
      setPlayerError(caught instanceof Error ? caught.message : 'Player history could not be loaded.')
    } finally {
      setIsLoadingPlayer(false)
    }
  }

  function resetToPreview() {
    setSnapshot(demoSnapshot)
    setTournamentUrl(DEFAULT_TOURNAMENT_URL)
    setSelectedPlayerId(null)
    setPlayerAnalysis(null)
    setSearchTerm('')
    setError(null)
    setPlayerError(null)
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
              <span>Show match context</span>
              <input
                type="checkbox"
                checked={preferences.showContext}
                onChange={(event) => setPreferences((current) => ({ ...current, showContext: event.target.checked }))}
              />
            </label>
            <p className="popover-note">Tournament and player choices are never stored.</p>
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
              <div className="class-picker-wrap">
                <select value={snapshot.selectedClass.id} onChange={(event) => void chooseClass(Number(event.target.value))} disabled={isLoadingClass} aria-label="Choose tournament class">
                  {snapshot.classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
                {isLoadingClass ? <LoaderCircle className="picker-loader spin" size={15} /> : <ChevronDown className="picker-chevron" size={15} />}
              </div>
            </div>

            <div className="table-toolbar">
              <div className="table-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Filter players" aria-label="Filter players" /></div>
              <span className="table-count">{visibleParticipants.length} of {snapshot.participants.length} pairs</span>
            </div>

            <div className="table-scroll">
              <table className="roster-table">
                <thead><tr><th>PAIR</th><th>SKILL</th><th>RANK</th><th>FIELD SIGNAL</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {visibleParticipants.map((pair, index) => {
                    const rating = pairRating(pair)
                    const selected = playerIsSelected(pair, selectedPlayerId)
                    return (
                      <tr className={selected ? 'selected-row' : ''} key={pair.id}>
                        <td>
                          <div className="pair-cell">
                            <span className="pair-index">{String(index + 1).padStart(2, '0')}</span>
                            <div><strong>{pair.first.name}</strong><span>{pair.second.name}</span></div>
                          </div>
                        </td>
                        <td><span className="rating-value">{formatRating(rating)}</span><span className="rating-caption">avg. start</span></td>
                        <td>{pair.ranking === null ? <span className="empty-value">not published</span> : pair.ranking}</td>
                        <td><span className={`signal-pill ${rating !== null && rating >= (averageRating ?? 0) ? 'signal-pill-strong' : ''}`}>{rating !== null && rating >= (averageRating ?? 0) ? 'above field avg.' : 'field baseline'}</span></td>
                        <td><button className="row-action" type="button" onClick={() => void inspectPlayer(pair)} aria-label={`Inspect ${pair.first.name}`}><ArrowUpRight size={16} /></button></td>
                      </tr>
                    )
                  })}
                  {!visibleParticipants.length && <tr><td colSpan={5} className="empty-table">No pairs match that search.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footnote"><Info size={14} /> Skill is the historical value shown at tournament start, not a live rating.</div>
          </div>

          <aside className="history-card">
            <div className="card-heading card-heading-small">
              <div><div className="section-kicker">PLAYER TRACE</div><h2>{selectedPlayer ? selectedPlayer.name : 'Find the level behind a name'}</h2></div>
              {selectedPlayer && <button className="icon-button quiet" type="button" onClick={() => { setSelectedPlayerId(null); setPlayerAnalysis(null) }} aria-label="Close player trace"><X size={17} /></button>}
            </div>

            {!selectedPlayer && (
              <div className="trace-empty">
                <div className="trace-empty-icon"><History size={21} /></div>
                <h3>Trace their last {preferences.historyLimit} finished events.</h3>
                <p>Open a pair above to see the exact classes, placements, partners, opponents and scores that sit behind their record.</p>
                <div className="trace-rule"><span /><span /><span /></div>
              </div>
            )}

            {selectedPlayer && (
              <>
                <div className="player-profile-mini">
                  <div className="avatar">{initials(selectedPlayer.name)}</div>
                  <div><strong>{selectedPlayer.name}</strong><span>{selectedPair?.second.name}</span></div>
                  <a href={`https://www.rankedin.com${selectedPlayer.url}`} target="_blank" rel="noreferrer" aria-label="Open Rankedin player profile"><ArrowUpRight size={15} /></a>
                </div>
                {isLoadingPlayer && <div className="loading-state"><LoaderCircle className="spin" size={19} /> Reading event history…</div>}
                {playerError && <div className="error-banner small" role="alert"><CircleHelp size={15} /> {playerError}</div>}
                {!isLoadingPlayer && playerAnalysis && (
                  <>
                    <div className="trace-metrics"><div><strong>{playerAnalysis.events.filter((event) => event.className).length}</strong><span>events found</span></div><div><strong>{analyzedMatches.length}</strong><span>matches</span></div><div><strong>{wins}–{losses}</strong><span>match record</span></div></div>
                    <div className="history-list">
                      {playerAnalysis.events.map((event) => <div className="history-item" key={event.id}><div className="history-date">{formatDate(event.startDate)}</div><div className="history-event"><strong>{event.className ?? 'Class result not published'}</strong><span>{event.name}</span>{event.className && <small>{event.standing ? `Finished ${event.standing}${event.standingRangeTo && event.standingRangeTo !== event.standing ? `–${event.standingRangeTo}` : ''}` : 'Placement unavailable'} {event.partner ? `· with ${event.partner}` : ''}</small>}{preferences.showContext && event.matches.length > 0 && <div className="match-context">{event.matches.slice(0, 3).map((match) => <div className="match-context-row" key={match.id}><span className={match.won === true ? 'match-result win' : match.won === false ? 'match-result loss' : 'match-result'}>{match.won === true ? 'W' : match.won === false ? 'L' : '—'}</span><span className="match-opponents">{match.opponents.join(' / ')}</span><span className="match-score">{match.score}</span></div>)}{event.matches.length > 3 && <span className="match-more">+ {event.matches.length - 3} more matches</span>}</div>}</div><div className="history-score">{event.matches.length ? `${event.matches.filter((match) => match.won).length}–${event.matches.filter((match) => match.won === false).length}` : '—'}</div></div>)}
                    </div>
                  </>
                )}
              </>
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
