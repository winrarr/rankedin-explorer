import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowUpRight,
  CircleHelp,
  GitBranch,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import type {
  DpfPlayerRanking,
  LeagueSearchResult,
  PlayerSearchResult,
  TournamentSearchResult,
} from '../lib/rankedin'
import {
  getPlayerDpfRankings,
  getPlayerProfile,
  searchPlayersByName,
  searchTeamLeaguesByName,
  searchTournamentsByName,
} from '../lib/rankedin'
import {
  isDirectLeagueReference,
  isDirectPlayerReference,
  isDirectTournamentReference,
  type WorkspaceMode,
} from '../lib/references'
import { usePublicSearch } from '../hooks/usePublicSearch'
import { ExplorerPlayerLink } from './ExplorerPlayerLink'
import { formatDpfPoints } from '../lib/formatters'

type PlayerSearchDetails = {
  countryCode: string | null
  homeClubName: string | null
  dpfRanking: DpfPlayerRanking | null
  dpfStatus: 'loading' | 'loaded' | 'unavailable'
}

function PlayerSearchResultMeta({ details }: { details: PlayerSearchDetails }) {
  const ranking = details.dpfRanking
  const rankingContext = ranking?.ageGroup ?? ranking?.matchType

  return (
    <span className="player-search-result-meta">
      {details.homeClubName && <span className="player-search-result-club">{details.homeClubName}</span>}
      {details.countryCode && <span className="player-search-result-country">{details.countryCode.toUpperCase()}</span>}
      {details.dpfStatus === 'loading' && <span className="player-search-result-dpf-muted">DPF points…</span>}
      {details.dpfStatus === 'unavailable' && <span className="player-search-result-dpf-muted">DPF unavailable</span>}
      {details.dpfStatus === 'loaded' && ranking && (
        <span
          className="player-search-result-dpf"
          title={`${rankingContext} · rank ${ranking.position}`}
          aria-label={`${formatDpfPoints(ranking.points)} current DPF points, rank ${ranking.position}`}
        >DPF {formatDpfPoints(ranking.points)}</span>
      )}
      {details.dpfStatus === 'loaded' && !ranking && (
        <span className="player-search-result-dpf-muted" title="No current DPF points" aria-label="No current DPF points">
          No DPF rank
        </span>
      )}
    </span>
  )
}

type WorkspaceSearchProps = {
  mode: WorkspaceMode
  references: {
    tournament: string
    player: string
    league: string
  }
  loading: {
    tournament: boolean
    player: boolean
    league: boolean
  }
  hasPlayerProfile: boolean
  hasLeagueSnapshot: boolean
  errors: {
    tournament: string | null
    player: string | null
    league: string | null
  }
  onReferenceChange: (mode: WorkspaceMode, value: string) => void
  onSubmit: (mode: WorkspaceMode) => void
  onClearReference: () => void
  onSelectTournament: (tournament: TournamentSearchResult) => void
  onSelectPlayer: (player: PlayerSearchResult) => void
  onSelectLeague: (league: LeagueSearchResult) => void
  onSelectLeaguePlayer: (player: PlayerSearchResult) => void
}

export function WorkspaceSearch({
  mode,
  references,
  loading,
  hasPlayerProfile,
  hasLeagueSnapshot,
  errors,
  onReferenceChange,
  onSubmit,
  onClearReference,
  onSelectTournament,
  onSelectPlayer,
  onSelectLeague,
  onSelectLeaguePlayer,
}: WorkspaceSearchProps) {
  const [showSearch, setShowSearch] = useState(false)
  const searchAnchorRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suppressSearchOnFocusRef = useRef(false)
  const [playerSearchDetails, setPlayerSearchDetails] = useState<Record<string, PlayerSearchDetails>>({})
  const activeMode = mode
  const tournamentUrl = references.tournament
  const playerReference = references.player
  const leagueReference = references.league
  const { tournament: isAnalyzing, player: isAnalyzingPlayer, league: isAnalyzingLeague } = loading
  const playerProfile = hasPlayerProfile
  const leagueSnapshot = hasLeagueSnapshot
  const { tournament: error, player: playerError, league: leagueError } = errors
  const setTournamentUrl = (value: string) => onReferenceChange('tournament', value)
  const setPlayerReference = (value: string) => onReferenceChange('player', value)
  const setLeagueReference = (value: string) => onReferenceChange('league', value)

  const playerSearch = usePublicSearch({
    enabled: activeMode === 'player' && showSearch && !isDirectPlayerReference(playerReference),
    term: playerReference,
    label: 'Player',
    search: searchPlayersByName,
  })
  const tournamentSearch = usePublicSearch({
    enabled: activeMode === 'tournament' && showSearch && !isDirectTournamentReference(tournamentUrl),
    term: tournamentUrl,
    label: 'Tournament',
    search: searchTournamentsByName,
  })
  const leagueSearch = usePublicSearch({
    enabled: activeMode === 'league' && showSearch && !isDirectLeagueReference(leagueReference),
    term: leagueReference,
    label: 'League',
    search: searchTeamLeaguesByName,
  })
  const leaguePlayerSearch = usePublicSearch({
    enabled: activeMode === 'league' && showSearch && !isDirectLeagueReference(leagueReference),
    term: leagueReference,
    label: 'Player',
    search: searchPlayersByName,
  })
  const playerSearchResults = activeMode === 'player' ? playerSearch.results : activeMode === 'league' ? leaguePlayerSearch.results : []
  const playerSearchResultIds = playerSearchResults.map((player) => player.rankedInId).join('|')

  useEffect(() => {
    const reference = activeMode === 'player' ? playerReference : leagueReference
    const hasNameSearch = activeMode === 'player'
      ? !isDirectPlayerReference(reference)
      : activeMode === 'league' && !isDirectLeagueReference(reference)
    if (!showSearch || !hasNameSearch || !playerSearchResultIds) {
      setPlayerSearchDetails({})
      return
    }

    const controller = new AbortController()
    const rankedInIds = playerSearchResultIds.split('|')
    let nextIndex = 0
    const initialDetails: Record<string, PlayerSearchDetails> = {}
    rankedInIds.forEach((rankedInId) => {
      initialDetails[rankedInId] = {
        countryCode: null,
        homeClubName: null,
        dpfRanking: null,
        dpfStatus: 'loading',
      }
    })
    setPlayerSearchDetails(initialDetails)

    async function loadDetails() {
      const workers = Array.from({ length: Math.min(3, rankedInIds.length) }, async () => {
        while (!controller.signal.aborted) {
          const rankedInId = rankedInIds[nextIndex]
          nextIndex += 1
          if (!rankedInId) return

          try {
            const profile = await getPlayerProfile(rankedInId, controller.signal)
            if (controller.signal.aborted) return
            setPlayerSearchDetails((current) => ({
              ...current,
              [rankedInId]: {
                ...current[rankedInId],
                countryCode: profile.countryCode,
                homeClubName: profile.homeClubName,
              },
            }))

            try {
              const rankings = await getPlayerDpfRankings(profile, controller.signal)
              if (controller.signal.aborted) return
              setPlayerSearchDetails((current) => ({
                ...current,
                [rankedInId]: {
                  ...current[rankedInId],
                  dpfRanking: rankings[0] ?? null,
                  dpfStatus: 'loaded',
                },
              }))
            } catch {
              if (controller.signal.aborted) return
              setPlayerSearchDetails((current) => ({
                ...current,
                [rankedInId]: { ...current[rankedInId], dpfStatus: 'unavailable' },
              }))
            }
          } catch {
            if (controller.signal.aborted) return
            setPlayerSearchDetails((current) => ({
              ...current,
              [rankedInId]: { ...current[rankedInId], dpfStatus: 'unavailable' },
            }))
          }
        }
      })
      await Promise.all(workers)
    }

    void loadDetails()
    return () => controller.abort()
  }, [activeMode, leagueReference, playerReference, playerSearchResultIds, showSearch])

  useEffect(() => setShowSearch(false), [activeMode])

  useEffect(() => {
    function closeSearchMenus(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (!searchAnchorRef.current?.contains(event.target)) setShowSearch(false)
    }

    document.addEventListener('click', closeSearchMenus)
    return () => document.removeEventListener('click', closeSearchMenus)
  }, [])

  function selectTournamentSearchResult(tournament: TournamentSearchResult) {
    setShowSearch(false)
    onSelectTournament(tournament)
  }

  function selectPlayerSearchResult(player: PlayerSearchResult) {
    setShowSearch(false)
    onSelectPlayer(player)
  }

  function selectLeagueSearchResult(league: LeagueSearchResult) {
    setShowSearch(false)
    onSelectLeague(league)
  }

  function selectLeaguePlayerSearchResult(player: PlayerSearchResult) {
    setShowSearch(false)
    onSelectLeaguePlayer(player)
  }

  function clearReference() {
    setShowSearch(false)
    onClearReference()
  }

  function submit() {
    setShowSearch(false)
    onSubmit(activeMode)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (!showSearch) return
      event.preventDefault()
      setShowSearch(false)
      suppressSearchOnFocusRef.current = event.target !== searchInputRef.current
      searchInputRef.current?.focus()
      return
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const target = event.target
    const isInput = target === searchInputRef.current
    const isResult = target instanceof HTMLElement && target.matches('.player-search-result, .tournament-search-result')
    if (!isInput && !isResult) return

    const results = searchAnchorRef.current?.querySelectorAll<HTMLButtonElement>(
      '.player-search-result, .tournament-search-result',
    )
    if (!results?.length) return

    event.preventDefault()
    const currentIndex = Array.from(results).indexOf(target as HTMLButtonElement)
    if (isInput) {
      results[event.key === 'ArrowDown' ? 0 : results.length - 1].focus()
      return
    }

    if (event.key === 'ArrowUp' && currentIndex === 0) {
      searchInputRef.current?.focus()
      return
    }
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = Math.max(0, Math.min(results.length - 1, currentIndex + direction))
    results[nextIndex].focus()
  }

  function handleSearchInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    const firstResult = searchAnchorRef.current?.querySelector<HTMLButtonElement>(
      '.tournament-search-result, .player-search-result',
    )
    const hasDirectReference = activeMode === 'tournament'
      ? isDirectTournamentReference(tournamentUrl)
      : activeMode === 'player'
        ? isDirectPlayerReference(playerReference)
        : isDirectLeagueReference(leagueReference)

    if (showSearch && !hasDirectReference && firstResult) {
      event.preventDefault()
      firstResult.click()
      return
    }

    if (activeMode === 'tournament' || hasDirectReference) submit()
  }

  return (
        <section className="hero-grid">
          <div className="hero-copy">
            <h1>{activeMode === 'tournament' ? 'Explore a tournament' : activeMode === 'player' ? 'Track player progress' : 'Explore a Lunar League'}</h1>

            <div className="input-card">
              <label htmlFor={activeMode === 'tournament' ? 'tournament-url' : activeMode === 'player' ? 'player-reference' : 'league-reference'}>
                {activeMode === 'tournament' ? 'Find a public tournament' : activeMode === 'player' ? 'Find a public player' : 'Find a public Lunar League'}
              </label>
              <div className="reference-search-anchor" ref={searchAnchorRef} onKeyDownCapture={handleSearchKeyDown}>
                <div className="url-input-row">
                  <div className="url-input-wrap">
                    {activeMode === 'tournament' || activeMode === 'league' ? <GitBranch size={17} /> : <Search size={17} />}
                    <input
                      ref={searchInputRef}
                      id={activeMode === 'tournament' ? 'tournament-url' : activeMode === 'player' ? 'player-reference' : 'league-reference'}
                      value={activeMode === 'tournament' ? tournamentUrl : activeMode === 'player' ? playerReference : leagueReference}
                      onChange={(event) => {
                        if (activeMode === 'tournament') {
                          setTournamentUrl(event.target.value)
                          setShowSearch(true)
                        } else if (activeMode === 'player') {
                          setPlayerReference(event.target.value)
                          setShowSearch(true)
                        } else {
                          setLeagueReference(event.target.value)
                          setShowSearch(true)
                        }
                      }}
                      onFocus={() => {
                        if (suppressSearchOnFocusRef.current) {
                          suppressSearchOnFocusRef.current = false
                          return
                        }
                        if (activeMode === 'tournament' && !isDirectTournamentReference(tournamentUrl)) setShowSearch(true)
                        if (activeMode === 'player') setShowSearch(true)
                        if (activeMode === 'league' && !isDirectLeagueReference(leagueReference)) setShowSearch(true)
                      }}
                      onKeyDown={handleSearchInputKeyDown}
                      placeholder={activeMode === 'tournament' ? 'Name, URL or ID' : activeMode === 'player' ? 'Name, URL or R-number' : 'League or player name'}
                    />
                    {(activeMode === 'tournament' ? tournamentUrl : activeMode === 'player' ? playerReference : leagueReference) && <button className="clear-input" type="button" aria-label={`Clear ${activeMode} reference`} onClick={clearReference}><X size={14} /></button>}
                  </div>
                  <button className="primary-button" type="button" onClick={submit} disabled={activeMode === 'tournament' ? isAnalyzing || !tournamentUrl.trim() : activeMode === 'player' ? isAnalyzingPlayer || !isDirectPlayerReference(playerReference) : isAnalyzingLeague || !isDirectLeagueReference(leagueReference)}>
                    {(activeMode === 'tournament' ? isAnalyzing : activeMode === 'player' ? isAnalyzingPlayer : isAnalyzingLeague) ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
                    {(activeMode === 'tournament' ? isAnalyzing : activeMode === 'player' ? isAnalyzingPlayer : isAnalyzingLeague) ? 'Reading…' : activeMode === 'tournament' ? 'Analyze field' : activeMode === 'player' ? 'Read progress' : 'Read league'}
                  </button>
                </div>
                {activeMode === 'tournament' && showSearch && !isDirectTournamentReference(tournamentUrl) && (
                  <div className="tournament-search-panel" role="status">
                    {tournamentSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin tournaments…</p>}
                    {tournamentSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {tournamentSearch.error}</p>}
                    {!tournamentSearch.isSearching && !tournamentSearch.error && tournamentUrl.trim().length >= 2 && !tournamentSearch.results.length && <p className="player-search-status">No public tournaments matched that name.</p>}
                    {!!tournamentSearch.results.length && (
                      <div className="tournament-search-results" role="listbox" aria-label="Tournament search results">
                        {tournamentSearch.results.map((tournament) => (
                          <button className="tournament-search-result" type="button" role="option" key={`${tournament.id}-${tournament.startDate}`} onClick={() => selectTournamentSearchResult(tournament)}>
                            <span className="tournament-search-result-name">{tournament.name}</span>
                            <span className="tournament-search-result-meta">{tournament.startDate || 'Date unavailable'} · {tournament.sport ?? 'Sport unavailable'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeMode === 'player' && showSearch && !isDirectPlayerReference(playerReference) && (
                  <div className="player-search-panel">
                    {playerSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching public Rankedin profiles…</p>}
                    {playerSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {playerSearch.error}</p>}
                    {!playerSearch.isSearching && !playerSearch.error && playerReference.trim().length >= 2 && !isDirectPlayerReference(playerReference) && !playerSearch.results.length && <p className="player-search-status">No public players matched that name.</p>}
                    {!!playerSearch.results.length && (
                      <div className="player-search-results" role="group" aria-label="Player search results">
                        {playerSearch.results.map((player) => (
                          <div className="player-search-result-row" key={player.rankedInId}>
                            <button className="player-search-result" type="button" onClick={() => selectPlayerSearchResult(player)}>
                              <span className="player-search-result-name">{player.name}</span>
                              {playerSearchDetails[player.rankedInId] && <PlayerSearchResultMeta details={playerSearchDetails[player.rankedInId]} />}
                              <span className="player-search-result-id">{player.rankedInId}</span>
                            </button>
                            <ExplorerPlayerLink className="player-search-open-link" rankedInId={player.rankedInId} name={player.name}>
                              <ArrowUpRight size={14} aria-hidden="true" />
                            </ExplorerPlayerLink>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeMode === 'league' && showSearch && !isDirectLeagueReference(leagueReference) && (
                  <div className="tournament-search-panel" role="status">
                    {leagueSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching Lunar Leagues…</p>}
                    {leagueSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {leagueSearch.error}</p>}
                    {leaguePlayerSearch.isSearching && <p className="player-search-status"><LoaderCircle className="spin" size={13} /> Searching player names…</p>}
                    {leaguePlayerSearch.error && <p className="player-search-status player-search-status-error"><CircleHelp size={13} /> {leaguePlayerSearch.error}</p>}
                    {!leagueSearch.isSearching && !leagueSearch.error && !leaguePlayerSearch.isSearching && !leaguePlayerSearch.results.length && leagueReference.trim().length >= 2 && !leagueSearch.results.length && <p className="player-search-status">No public Lunar Leagues matched that name.</p>}
                    {!!leagueSearch.results.length && (
                      <div className="tournament-search-results" role="listbox" aria-label="Lunar League search results">
                        {leagueSearch.results.map((league) => (
                          <button className="tournament-search-result" type="button" role="option" key={`${league.id}-${league.startDate}`} onClick={() => selectLeagueSearchResult(league)}>
                            <span className="tournament-search-result-name">{league.name}</span>
                            <span className="tournament-search-result-meta">{league.startDate || 'Date unavailable'} · {league.sport ?? 'Sport unavailable'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!!leaguePlayerSearch.results.length && (
                      <>
                        <div className="search-section-label">FIND A LUNAR LEAGUE BY PLAYER</div>
                        <div className="player-search-results" role="group" aria-label="Players with Lunar League history">
                          {leaguePlayerSearch.results.map((player) => (
                            <div className="player-search-result-row" key={player.rankedInId}>
                              <button className="player-search-result" type="button" onClick={() => void selectLeaguePlayerSearchResult(player)}>
                                <span className="player-search-result-name">{player.name}</span>
                                {playerSearchDetails[player.rankedInId] && <PlayerSearchResultMeta details={playerSearchDetails[player.rankedInId]} />}
                                <span className="player-search-result-id">Find current Lunar League</span>
                              </button>
                              <ExplorerPlayerLink className="player-search-open-link" rankedInId={player.rankedInId} name={player.name}>
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </ExplorerPlayerLink>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              {((activeMode === 'tournament' && isAnalyzing) || (activeMode === 'player' && isAnalyzingPlayer && !playerProfile) || (activeMode === 'league' && isAnalyzingLeague && !leagueSnapshot)) && (
                <div className="lookup-loading-state" role="status" aria-live="polite">
                  <LoaderCircle className="spin" size={16} />
                  <div className="lookup-loading-copy">
                    <strong>{activeMode === 'tournament' ? 'Loading tournament field' : activeMode === 'player' ? 'Finding public profile' : 'Loading Lunar League'}</strong>
                  </div>
                </div>
              )}
            </div>
            {(activeMode === 'tournament' ? error : activeMode === 'player' ? playerError : leagueError) && <div className="error-banner" role="alert"><CircleHelp size={16} /> {activeMode === 'tournament' ? error : activeMode === 'player' ? playerError : leagueError}</div>}
          </div>

        </section>
  )
}
