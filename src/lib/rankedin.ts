const API_BASE = 'https://api.rankedin.com/v1'
const FINISHED_EVENT_STATE = 4

export type PlayerRecord = {
  id: number
  rankedInId: string
  name: string
  url: string
  rating: number | null
}

export type PlayerSearchResult = {
  id: number
  rankedInId: string
  name: string
}

export type WinLossRecord = {
  wins: number
  losses: number
}

export type PlayerDoublesStats = {
  currentYear: WinLossRecord | null
  career: WinLossRecord | null
}

export type TournamentSearchResult = {
  id: number
  name: string
  url: string
  startDate: string
  sport: string | null
  countryFlag: string | null
  isPremium: boolean | null
}

export type LeagueSearchResult = {
  id: number
  name: string
  url: string
  startDate: string
  sport: string | null
  countryFlag: string | null
  isPremium: boolean | null
}

export type PlayerProfile = PlayerRecord & {
  countryCode: string | null
  homeClubName: string | null
  homeClubUrl: string | null
  doublesStats: PlayerDoublesStats
}

export type PairRecord = {
  id: string
  first: PlayerRecord
  second: PlayerRecord
  ranking: number | null
}

export type ClassOption = {
  id: number
  name: string
  participantsType?: number
}

export type CompetitionClassKind = 'dpf' | 'junior' | 'category' | 'league' | 'other'

export type NormalizedCompetitionClass = {
  name: string
  kind: CompetitionClassKind
}

export type TournamentSnapshot = {
  tournamentId: number
  name: string
  location: string
  country: string
  sport: string
  startDate: string
  endDate: string
  state: number
  isPremium: boolean
  classes: ClassOption[]
  selectedClass: ClassOption
  participants: PairRecord[]
}

export type MatchRecord = {
  id: number
  date: string
  className: string
  draw: string
  won: boolean | null
  partner: string
  opponents: string[]
  opponentIds: number[]
  score: string
}

export type MatchQuery = {
  tournamentId: number
  classId: number
}

export type PlayerEventAnalysis = {
  id: number
  name: string
  startDate: string
  className: string | null
  standing: number | null
  standingRangeTo: number | null
  fieldSize: number | null
  ratingBegin: number | null
  ratingEnd: number | null
  rankingPoints: number | null
  partner: string | null
  matchQuery: MatchQuery | null
  matches: MatchRecord[]
}

export type PlayerAnalysis = {
  playerId: number
  playerName: string
  events: PlayerEventAnalysis[]
}

export type LeagueMatchAnalysis = {
  id: number
  date: string
  round: number | null
  partner: string
  opponents: string[]
  won: boolean | null
  played: boolean
  score: string
}

export type LeagueFixtureAnalysis = {
  id: number
  date: string
  round: number | null
  teamName: string
  opponentTeam: string
  teamScore: number | null
  opponentScore: number | null
  won: boolean | null
  matches: LeagueMatchAnalysis[]
}

export type LeagueStandingSnapshot = {
  fixtureId: number
  date: string
  standing: number
  teamCount: number
  result: 'win' | 'loss' | 'draw' | null
  teamScore: number | null
  opponentScore: number | null
  opponentTeam: string
  teamWins: number
  matchPoints: number
  matchDifference: number
  setDifference: number
  gameDifference: number
}

export type LeagueSeasonAnalysis = {
  id: number
  name: string
  startDate: string
  endDate: string
  divisionName: string
  regionName: string
  teamId: number
  teamName: string
  teamUrl: string
  poolId: number
  teamStanding: number | null
  teamCount: number | null
  teamPoints: number | null
  teamPlayed: number | null
  teamWins: number | null
  teamLosses: number | null
  eventUrl: string
  fixtures: LeagueFixtureAnalysis[]
  standingHistory: LeagueStandingSnapshot[]
}

export type PlayerLeagueAnalysis = {
  playerId: number
  playerName: string
  seasons: LeagueSeasonAnalysis[]
}

export type PlayerLeagueDivision = {
  divisionName: string
}

export type LeaguePool = {
  id: number
  name: string
  divisionName: string
  regionName: string
  teamCount: number
  playerCount: number
}

export type LeagueTeamPlayer = {
  name: string
  url: string
  countryCode: string | null
  isCaptain: boolean
  rating: number | null
}

export type LeagueTeam = {
  id: number
  name: string
  homeClubName: string | null
  homeClubUrl: string | null
  teamUrl: string
  players: LeagueTeamPlayer[]
  teamPower: number | null
}

export type LeagueStanding = {
  teamId: number
  teamName: string
  teamUrl: string
  standing: number
  matchPoints: number
  played: number
  draws: number
  wins: number
  losses: number
  gamesWon: number
  gamesLost: number
  gamesDifference: number
  teamGamesWon: number
  teamGamesLost: number
  teamGamesDifference: number
  scoredPoints: number
  concededPoints: number
  pointsDifference: number
}

export type LeagueFixtureSide = {
  id: number
  name: string
  url: string
  score: number | null
  isWinner: boolean | null
}

export type LeagueFixture = {
  id: number
  date: string
  round: number | null
  location: string | null
  showResults: boolean
  url: string
  team1: LeagueFixtureSide
  team2: LeagueFixtureSide
}

export type LeagueSnapshot = {
  leagueId: number
  name: string
  startDate: string
  endDate: string
  state: number
  statusText: string | null
  location: string
  country: string
  countryCode: string | null
  sport: string
  eventUrl: string
  clubName: string | null
  clubUrl: string | null
  uniquePlayersCount: number
  totalTeamCount: number
  totalPlayerCount: number
  totalClubCount: number
  pools: LeaguePool[]
  selectedPool: LeaguePool | null
  teams: LeagueTeam[]
  standings: LeagueStanding[]
  fixtures: LeagueFixture[]
}

type RawPlayer = {
  Id: number
  RankedinId: string
  Name: string
  PlayerUrl: string
  RatingBegin: number | null
}

type RawPlayerSearchResult = {
  Id: number
  Name: string
  RankedinId: string
}

type RawTournamentSearchResult = {
  Url: string
  Name: string
  StartDate: string | null
  Sport: string | null
  CountryFlag: string | null
  IsPremium: boolean | null
}

type RawLeagueSearchResult = {
  Url?: string
  Name?: string
  StartDate?: string | null
  Sport?: string | null
  CountryFlag?: string | null
  IsPremium?: boolean | null
}

type RawParticipant = {
  Participant: {
    FirstPlayer: RawPlayer
    SecondPlayer: RawPlayer
  }
  Ranking?: string
}

type RawPlayersResponse = {
  Participants: RawParticipant[]
}

type RawHeader = {
  Id: number
  Name: string
  City: string
  Country: string
  Sport: number
  StartDate: string
  EndDate: string
  EventState: number
  IsPremium: boolean
}

type RawPlayerProfileResponse = {
  Header: {
    PlayerId: number
    FirstName: string
    LastName: string
    CountryShort: string | null
    RankedinId: string
    HomeClubName: string | null
    HomeClubUrl: string | null
  }
  FullName: string
  NameForRouting: string
  Statistics?: {
    WinLossDoublesCurrentYear?: string | null
    CareerWinLossDoubles?: string | null
  }
}

type RawStandingResponse = {
  TournamentId: number
  Classes: RawClassOption[]
  Rankings: Array<{ Id: number; Name: string }>
}

type RawClassOption = {
  Id: number
  Name: string
  ParticipantsType: number
}

type RawClassDraw = {
  Id: number
  Name: string
  TournamentDraws: Array<{ Strength: number; Stage: number }>
}

type RawEvent = {
  Id: number
  Name: string
  State: number
  Type?: number
  StartDate: string
}

type RawEventsResponse = {
  Payload: RawEvent[]
  TotalCount: number
}

type RawTeamLeagueHeader = {
  Id: number
  Name: string
  StartDate: string
  EndDate: string
  Sport: number
  EventState?: number
  EventStatusText?: string | null
  City?: string | null
  Country?: string | null
  CountryShort?: string | null
  UniquePlayersCount?: number
  EventUrl?: string
}

type RawLeaguePoolStatistic = {
  DivisionName?: string | null
  RegionName?: string | null
  TeamsCount?: number
  PlayersCount?: number
  PoolId?: number
}

type RawTeamLeagueInfo = {
  PoolsStatistics?: {
    TeamsCount?: number
    PlayersCount?: number
    ClubsCount?: number
  }
  Club?: {
    Name?: string | null
    Url?: string | null
  }
  MatchesDetailsModel?: {
    PoolsWithStatistics?: RawLeaguePoolStatistic[]
  }
}

type RawLeaguePoolsResponse = {
  pools?: Array<{
    id: number
    name: string
    isPrimary: boolean
  }>
}

type RawLeaguePoolTeam = {
  Id: number
  Name: string
  HomeClubName?: string | null
  HomeClubUrl?: string | null
  Players?: Array<{
    Name: string
    Url: string
    CountryShort?: string | null
    IsCaptain: boolean
    Rating: number | null
  }>
  TeamUrl?: string | null
  TeamPower?: number | null
}

type RawLeaguePoolMatchSide = {
  url: string
  isWinner: boolean | null
  name: string
  result: number | null
  id: number
}

type RawLeaguePoolMatch = {
  team1: RawLeaguePoolMatchSide
  team2: RawLeaguePoolMatchSide
  showResults: boolean
  url?: string | null
  location?: string | null
  date?: string | null
  details?: {
    date?: string | null
    time?: string | null
    round?: number | null
  }
  matchId: number
}

type RawLeaguePoolMatchesResponse = {
  matches?: RawLeaguePoolMatch[]
}

type RawLeagueTeamDetail = {
  teamId: number
  teamName: string
  teamUrl: string
  divisionName: string
  regionName: string
}

type RawLeagueTeamHomepage = {
  teamLeagueId: number
  teamLeagueName: string
  poolId: number
  team: {
    id: number
    name: string
  }
}

type RawTeamStanding = {
  participantId: number
  standing: number
  participantUrl: string
  participantName: string
  matchPoints: number
  played: number
  draws: number
  wins: number
  losses: number
  gamesWon: number
  gamesLost: number
  gamesDifference: number
  teamGamesWon: number
  teamGamesLost: number
  teamGamesDifference: number
  scoredPoints: number
  concededPoints: number
  pointsDifference: number
}

type RawTeamStandingsResponse = {
  scoresViewModels: RawTeamStanding[]
}

type RawStandingsRulesResponse = {
  TeamMatchesRules?: string[]
}

type RawLeagueFixtureSide = {
  id: number
  name: string
  result: number | null
  isWinner: boolean | null
}

type RawLeagueFixture = {
  team1: RawLeagueFixtureSide
  team2: RawLeagueFixtureSide
  showResults: boolean
  matchId: number
  details?: {
    time?: string
    date?: string
    round?: number
  }
}

type RawTeamMatchesResponse = {
  matches: RawLeagueFixture[]
}

type RawLeagueSide = {
  name: string
  player2Name: string
  player1Id: number
  player2Id: number
}

type RawLeagueDouble = {
  id: number
  date: string
  challenger: RawLeagueSide
  challenged: RawLeagueSide
  matchResult?: {
    score?: {
      firstParticipantScore: number
      secondParticipantScore: number
      detailedScoring?: Array<{
        firstParticipantScore: number
        secondParticipantScore: number
        loserTiebreak: number | null
      }>
      isFirstParticipantWinner: boolean
    }
    hasScore: boolean
    isFirstParticipantWinner: boolean | null
    isPlayed: boolean
  }
}

type RawLeagueDoublesResponse = Array<{
  matches?: {
    matches?: RawLeagueDouble[]
  }
}>

type RawResult = {
  Player1ParticipantId: number
  Player2ParticipantId: number
  Player1Name: string
  Player2Name: string
  Standing: number
  StandingRangeTo: number
  Player1RatingBegin: number | null
  Player1RatingEnd: number | null
  Player2RatingBegin: number | null
  Player2RatingEnd: number | null
  RankingPoint?: { Points: number }
}

type RawResultsResponse = {
  Data: RawResult[]
}

type PlayerClassResult = {
  classOption: RawClassOption
  result: RawResultsResponse
  playerResult: RawResult
}

type RawSide = {
  Name: string
  Player2Name: string
  Player1Id: number
  Player2Id: number
}

type RawMatch = {
  Id: number
  Date: string
  Challenger: RawSide
  Challenged: RawSide
  TournamentClassName: string
  Draw: string
  MatchResult?: {
    Score?: {
      FirstParticipantScore: number
      SecondParticipantScore: number
      DetailedScoring?: Array<{
        FirstParticipantScore: number
        SecondParticipantScore: number
        LoserTiebreak: number | null
      }>
      IsFirstParticipantWinner: boolean
    }
    IsFirstParticipantWinner: boolean | null
    IsPlayed: boolean
  }
}

type RawMatchesResponse = {
  Matches: RawMatch[]
}

const responseCache = new Map<string, Promise<unknown>>()
const eventAnalysisCache = new Map<string, Promise<PlayerEventAnalysis>>()
const participatedEventsCache = new Map<number, Promise<RawEvent[]>>()
type QueuedRequest = {
  cancelled: boolean
  run: () => void
}

const requestQueue: QueuedRequest[] = []
const MAX_ACTIVE_REQUESTS = 25
const MAX_EVENT_ANALYSIS_CONCURRENCY = 4
const MAX_CLASS_PROBE_CONCURRENCY = 2
const MAX_LEAGUE_STANDING_CONCURRENCY = 4
const MAX_RETRY_ATTEMPTS = 4
const PARTICIPATED_EVENTS_TAKE = 50
let activeRequestCount = 0
let requestNotBefore = 0
let requestDrainTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRequestDrain() {
  if (requestDrainTimer !== null) return
  const delay = Math.max(0, requestNotBefore - Date.now())
  requestDrainTimer = setTimeout(() => {
    requestDrainTimer = null
    drainRequestQueue()
  }, delay)
}

function drainRequestQueue() {
  if (Date.now() < requestNotBefore) {
    scheduleRequestDrain()
    return
  }

  while (activeRequestCount < MAX_ACTIVE_REQUESTS && requestQueue.length) {
    const nextRequest = requestQueue.shift()
    if (!nextRequest) return
    if (nextRequest.cancelled) continue
    activeRequestCount += 1
    nextRequest.run()
  }
}

function abortError() {
  const error = new Error('Request aborted.')
  error.name = 'AbortError'
  return error
}

function waitForRetry(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, delay)
    function cancel() {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', cancel)
      reject(abortError())
    }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(30000, Math.max(250, seconds * 1000))
    const timestamp = Date.parse(retryAfter)
    if (!Number.isNaN(timestamp)) return Math.min(30000, Math.max(250, timestamp - Date.now()))
  }
  return Math.min(12000, 500 * (2 ** attempt) + Math.round(Math.random() * 250))
}

function pauseRequestQueue(delay: number) {
  requestNotBefore = Math.max(requestNotBefore, Date.now() + delay)
  scheduleRequestDrain()
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function isRetryableError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return false
  return error instanceof TypeError || (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError'))
}

async function fetchJson(path: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw abortError()

    const timeoutSignal = AbortSignal.timeout(12000)
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
    try {
      const response = await fetch(`${API_BASE}${path}`, { signal: requestSignal })
      if (response.ok) return response.json()

      if (!isRetryableStatus(response.status) || attempt === MAX_RETRY_ATTEMPTS - 1) {
        throw new Error(`Rankedin returned ${response.status} for ${path}`)
      }
      const delay = retryDelay(response, attempt)
      if (response.status === 429) pauseRequestQueue(delay)
      await waitForRetry(delay, signal)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Rankedin returned')) throw error
      if (!isRetryableError(error, signal) || attempt === MAX_RETRY_ATTEMPTS - 1) throw error
      await waitForRetry(Math.min(12000, 500 * (2 ** attempt) + Math.round(Math.random() * 250)), signal)
    }
  }

  throw new Error(`Rankedin request failed for ${path}`)
}

function enqueueRequest<T>(task: () => Promise<T>, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    let started = false
    const queuedRequest: QueuedRequest = {
      cancelled: false,
      run: async () => {
        started = true
        signal?.removeEventListener('abort', cancel)
        try {
          if (signal?.aborted) throw abortError()
          resolve(await task())
        } catch (error) {
          reject(error)
        } finally {
          activeRequestCount -= 1
          drainRequestQueue()
        }
      },
    }
    function cancel() {
      if (started) return
      queuedRequest.cancelled = true
      reject(abortError())
      drainRequestQueue()
    }

    if (signal?.aborted) {
      reject(abortError())
      return
    }
    signal?.addEventListener('abort', cancel, { once: true })
    requestQueue.push(queuedRequest)
    drainRequestQueue()
  })
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const cacheable = !signal
  const cached = cacheable ? responseCache.get(path) : undefined
  if (cached) return cached as Promise<T>

  const pending = enqueueRequest(() => fetchJson(path, signal), signal)
  if (cacheable) responseCache.set(path, pending)

  try {
    return await pending as T
  } catch (error) {
    if (cacheable) responseCache.delete(path)
    throw error
  }
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value))
  })

  return `?${search.toString()}`
}

function parseRankedinDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/)
  if (!match) return new Date(value).getTime()
  const [, day, month, year, hours = '00', minutes = '00'] = match
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`).getTime()
}

function getPlayerParticipatedEvents(playerId: number) {
  const cached = participatedEventsCache.get(playerId)
  if (cached) return cached

  const pending = request<RawEventsResponse>(
    `/player/ParticipatedEventsAsync${query({
      PlayerId: playerId,
      Language: 'en',
      Skip: 0,
      Take: PARTICIPATED_EVENTS_TAKE,
    })}`,
  ).then((response) => response.Payload)
  participatedEventsCache.set(playerId, pending)

  pending.catch(() => {
    if (participatedEventsCache.get(playerId) === pending) participatedEventsCache.delete(playerId)
  })
  return pending
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = []
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

async function findPlayerClassResult(
  eventId: number,
  classes: RawClassOption[],
  rankingId: number | undefined,
  playerId: number,
): Promise<PlayerClassResult | null> {
  let nextIndex = 0
  let match: PlayerClassResult | null = null
  const controller = new AbortController()

  async function worker() {
    while (!match) {
      const currentIndex = nextIndex
      if (currentIndex >= classes.length) return
      nextIndex += 1

      const classOption = classes[currentIndex]
      try {
        // Share each class payload across players while keeping this player's early-stop state local.
        const result = await request<RawResultsResponse>(
          `/tournament/GetResultsAsync${query({
            tournamentId: eventId,
            classId: classOption.Id,
            rankingId,
            language: 'en',
          })}`,
        )
        if (controller.signal.aborted) return
        const playerResult = result.Data.find(
          (item) => item.Player1ParticipantId === playerId || item.Player2ParticipantId === playerId,
        )
        if (playerResult) {
          match = { classOption, result, playerResult }
          controller.abort()
          return
        }
      } catch {
        // A private or unavailable class should not prevent the other classes from being checked.
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CLASS_PROBE_CONCURRENCY, classes.length) }, () => worker()),
  )
  return match
}

function normalizePlayer(player: RawPlayer): PlayerRecord {
  return {
    id: player.Id,
    rankedInId: player.RankedinId,
    name: player.Name,
    url: player.PlayerUrl,
    rating: player.RatingBegin,
  }
}

function normalizePair(participant: RawParticipant, index: number): PairRecord {
  return {
    id: `${participant.Participant.FirstPlayer.Id}-${participant.Participant.SecondPlayer.Id}-${index}`,
    first: normalizePlayer(participant.Participant.FirstPlayer),
    second: normalizePlayer(participant.Participant.SecondPlayer),
    ranking: participant.Ranking ? Number(participant.Ranking) : null,
  }
}

function sportName(sport: number) {
  const sports: Record<number, string> = {
    1: 'Squash',
    2: 'Badminton',
    3: 'Table tennis',
    4: 'Tennis',
    5: 'Padel',
    6: 'Racquetball',
    7: 'Soccer squash',
    8: 'Fronton',
    9: 'Teqball',
    10: 'Crossminton',
    11: 'Pickleball',
    12: 'Roundnet',
  }

  return sports[sport] ?? 'Racket sport'
}

function cleanedCompetitionClassName(value: string) {
  return value
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*-\s*(?:formiddag|eftermiddag|ftm|først til mølle).*$/i, '')
    .replace(/\s*-\s*maks.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function competitionClassGender(value: string) {
  if (/\b(?:mix|mixed)\b/i.test(value)) return 'Mix'
  if (/\b(?:girls?|piger?|flickor?)\b/i.test(value)) return 'Piger'
  if (/\b(?:boys?|drenge?|pojkar?)\b/i.test(value)) return 'Drenge'
  if (/\b(?:kvinder?|damer?|women?|female)\b/i.test(value)) return 'Kvinder'
  if (/\b(?:herrer?|herre|men|male)\b/i.test(value)) return 'Herrer'
  return null
}

function competitionClassAge(value: string) {
  const underAge = value.match(/\bU\s*(\d{1,2})\b/i)
  if (underAge) return Number(underAge[1])

  const namedAge = value.match(/\b(?:boys?|girls?|drenge?|piger?|pojkar?|flickor?)\s*(\d{1,2})\b/i)
  return namedAge ? Number(namedAge[1]) : null
}

export function normalizeCompetitionClassName(className: string | null): NormalizedCompetitionClass {
  if (!className?.trim()) return { name: 'Class unavailable', kind: 'other' }

  const cleanedName = cleanedCompetitionClassName(className)
  if (/\blunar\s+(?:ligaen|league)\b/i.test(className)) {
    return { name: 'Lunar League', kind: 'league' }
  }

  const levelMatch = className.match(/\b(?:DPF|DFP)\s*(\d{1,4})/i)
  const level = levelMatch ? `DPF${Number(levelMatch[1])}` : null
  const age = competitionClassAge(className)
  const gender = competitionClassGender(className)

  if (level) {
    return {
      name: [level, age ? `U${age}` : null, gender].filter(Boolean).join(' '),
      kind: 'dpf',
    }
  }

  if (age) {
    return {
      name: [`U${age}`, gender].filter(Boolean).join(' '),
      kind: 'junior',
    }
  }

  if (gender) return { name: gender, kind: 'category' }

  return { name: cleanedName || 'Class unavailable', kind: 'other' }
}

export function parseTournamentReference(value: string) {
  const trimmed = value.trim()
  const directId = /^\d+$/.test(trimmed) ? Number(trimmed) : null
  if (directId) return { tournamentId: directId }

  const match = trimmed.match(/\/tournament\/(\d+)/i) ?? trimmed.match(/\b(\d{3,})\b/)
  if (!match) throw new Error('Paste a Rankedin tournament URL or numeric tournament ID.')

  return { tournamentId: Number(match[1]) }
}

export async function searchTournamentsByName(term: string, take = 8, signal?: AbortSignal): Promise<TournamentSearchResult[]> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const response = await request<RawTournamentSearchResult[]>(
    `/Search/GetTournamentsAsync${query({ term: normalizedTerm, language: 'en', take, skip: 0 })}`,
    signal,
  )

  return response.flatMap((tournament) => {
    try {
      const { tournamentId } = parseTournamentReference(tournament.Url)
      return [{
        id: tournamentId,
        name: tournament.Name,
        url: tournament.Url,
        startDate: tournament.StartDate ?? '',
        sport: tournament.Sport,
        countryFlag: tournament.CountryFlag,
        isPremium: tournament.IsPremium,
      }]
    } catch {
      return []
    }
  })
}

export function parseLeagueReference(value: string) {
  const trimmed = value.trim()
  const directId = /^\d+$/.test(trimmed) ? Number(trimmed) : null
  if (directId) return { leagueId: directId }

  const match = trimmed.match(/\/teamleague\/(\d+)/i) ?? trimmed.match(/\b(\d{2,})\b/)
  if (!match) throw new Error('Paste a Rankedin Lunar League URL or numeric league ID.')

  return { leagueId: Number(match[1]) }
}

export async function searchTeamLeaguesByName(term: string, take = 8, signal?: AbortSignal): Promise<LeagueSearchResult[]> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const response = await request<RawLeagueSearchResult[]>(
    `/Search/GetTeamLeaguesAsync${query({ term: normalizedTerm, language: 'en', take, skip: 0 })}`,
    signal,
  )

  return response.flatMap((league) => {
    if (!league.Url || !league.Name) return []
    try {
      const { leagueId } = parseLeagueReference(league.Url)
      return [{
        id: leagueId,
        name: league.Name,
        url: league.Url,
        startDate: league.StartDate ?? '',
        sport: league.Sport ?? null,
        countryFlag: league.CountryFlag ?? null,
        isPremium: league.IsPremium ?? null,
      }]
    } catch {
      return []
    }
  })
}

export function parsePlayerReference(value: string) {
  const trimmed = value.trim()
  const directId = /^R\d+$/i.test(trimmed) ? trimmed : null
  const match = trimmed.match(/\/player\/(R\d+)/i) ?? trimmed.match(/\b(R\d+)\b/i)
  const rankedInId = (directId ?? match?.[1])?.toUpperCase()
  if (!rankedInId) throw new Error('Paste a Rankedin player profile URL or R-number.')

  return { rankedInId }
}

export function parseWinLossRecord(value: string | null | undefined): WinLossRecord | null {
  const match = value?.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (!match) return null
  return { wins: Number(match[1]), losses: Number(match[2]) }
}

export async function searchPlayersByName(term: string, take = 8, signal?: AbortSignal): Promise<PlayerSearchResult[]> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const response = await request<RawPlayerSearchResult[]>(
    `/Search/GetPlayersByNameSimpleAsync${query({ name: normalizedTerm, take, skip: 0 })}`,
    signal,
  )

  return response
    .filter((player) => player.RankedinId && player.Name)
    .map((player) => ({
      id: player.Id,
      rankedInId: player.RankedinId,
      name: player.Name,
    }))
}

export async function getPlayerProfile(reference: string): Promise<PlayerProfile> {
  const { rankedInId } = parsePlayerReference(reference)
  const response = await request<RawPlayerProfileResponse>(
    `/player/PlayerProfileInfoAsync${query({ rankedinId: rankedInId, language: 'en' })}`,
  )
  const header = response.Header

  return {
    id: header.PlayerId,
    rankedInId: header.RankedinId,
    name: response.FullName || `${header.FirstName} ${header.LastName}`.trim(),
    url: `/en/player/${header.RankedinId}/${response.NameForRouting}/info`,
    rating: null,
    countryCode: header.CountryShort,
    homeClubName: header.HomeClubName,
    homeClubUrl: header.HomeClubUrl,
    doublesStats: {
      currentYear: parseWinLossRecord(response.Statistics?.WinLossDoublesCurrentYear),
      career: parseWinLossRecord(response.Statistics?.CareerWinLossDoubles),
    },
  }
}

export async function getClassParticipants(tournamentId: number, classId: number) {
  const response = await request<RawPlayersResponse>(
    `/tournament/GetPlayersForClassAsync${query({
      tournamentId,
      tournamentClassId: classId,
      language: 'en',
    })}`,
  )

  return response.Participants.map(normalizePair)
}

export async function getTournamentSnapshot(
  reference: string,
  selectedClassId?: number,
): Promise<TournamentSnapshot> {
  const { tournamentId } = parseTournamentReference(reference)
  const [header, standings] = await Promise.all([
    request<RawHeader>(`/tournament/GetheaderAsync${query({ id: tournamentId, language: 'en' })}`),
    request<RawStandingResponse>(`/tournament/GetStandingsAsync${query({ id: tournamentId })}`),
  ])

  const classes = standings.Classes.map((item) => ({
    id: item.Id,
    name: item.Name,
    participantsType: item.ParticipantsType,
  }))
  const selectedClass =
    classes.find((item) => item.id === selectedClassId) ??
    classes.find((item) => item.name.toLowerCase().includes('mix')) ??
    classes[0]

  if (!selectedClass) throw new Error('This tournament has no public classes yet.')

  return {
    tournamentId,
    name: header.Name,
    location: header.City,
    country: header.Country,
    sport: sportName(header.Sport),
    startDate: header.StartDate,
    endDate: header.EndDate,
    state: header.EventState,
    isPremium: header.IsPremium,
    classes,
    selectedClass,
    participants: await getClassParticipants(tournamentId, selectedClass.id),
  }
}

function leaguePoolParts(name: string) {
  const separator = name.indexOf(' - ')
  if (separator < 0) return { regionName: 'Region unavailable', divisionName: name }
  return {
    regionName: name.slice(0, separator).trim() || 'Region unavailable',
    divisionName: name.slice(separator + 3).trim() || 'Division unavailable',
  }
}

function teamIdFromUrl(url: string) {
  const match = url.match(/\/team\/homepage\/(\d+)/i)
  return match ? Number(match[1]) : null
}

function normalizeLeaguePool(
  pool: { id: number; name: string },
  statistics: RawLeaguePoolStatistic[],
): LeaguePool {
  const parts = leaguePoolParts(pool.name)
  const stat = statistics.find((item) => item.PoolId === pool.id)
  return {
    id: pool.id,
    name: pool.name,
    divisionName: stat?.DivisionName?.trim() || parts.divisionName,
    regionName: stat?.RegionName?.trim() || parts.regionName,
    teamCount: stat?.TeamsCount ?? 0,
    playerCount: stat?.PlayersCount ?? 0,
  }
}

function normalizeLeagueTeam(team: RawLeaguePoolTeam): LeagueTeam {
  return {
    id: team.Id,
    name: team.Name,
    homeClubName: team.HomeClubName || null,
    homeClubUrl: team.HomeClubUrl || null,
    teamUrl: team.TeamUrl || `/en/team/homepage/${team.Id}`,
    players: (team.Players ?? []).map((player) => ({
      name: player.Name,
      url: player.Url,
      countryCode: player.CountryShort || null,
      isCaptain: player.IsCaptain,
      rating: player.Rating,
    })),
    teamPower: team.TeamPower ?? null,
  }
}

function normalizeLeagueStanding(standing: RawTeamStanding, teamsByName: Map<string, LeagueTeam>): LeagueStanding {
  const teamId = teamIdFromUrl(standing.participantUrl) ?? teamsByName.get(standing.participantName)?.id ?? standing.participantId
  return {
    teamId,
    teamName: standing.participantName,
    teamUrl: standing.participantUrl,
    standing: standing.standing,
    matchPoints: standing.matchPoints,
    played: standing.played,
    draws: standing.draws,
    wins: standing.wins,
    losses: standing.losses,
    gamesWon: standing.gamesWon,
    gamesLost: standing.gamesLost,
    gamesDifference: standing.gamesDifference,
    teamGamesWon: standing.teamGamesWon,
    teamGamesLost: standing.teamGamesLost,
    teamGamesDifference: standing.teamGamesDifference,
    scoredPoints: standing.scoredPoints,
    concededPoints: standing.concededPoints,
    pointsDifference: standing.pointsDifference,
  }
}

function normalizeLeaguePoolFixture(fixture: RawLeaguePoolMatch): LeagueFixture {
  const date = fixture.details?.time || fixture.details?.date || fixture.date || ''
  const normalizeSide = (side: RawLeaguePoolMatchSide): LeagueFixtureSide => ({
    id: side.id,
    name: side.name,
    url: side.url,
    score: fixture.showResults ? side.result : null,
    isWinner: fixture.showResults ? side.isWinner : null,
  })

  return {
    id: fixture.matchId,
    date,
    round: fixture.details?.round ?? null,
    location: fixture.location || null,
    showResults: fixture.showResults,
    url: fixture.url || `/en/team/matchresults/${fixture.matchId}`,
    team1: normalizeSide(fixture.team1),
    team2: normalizeSide(fixture.team2),
  }
}

export async function getLeagueSnapshot(reference: string, selectedPoolId?: number): Promise<LeagueSnapshot> {
  const { leagueId } = parseLeagueReference(reference)
  const [header, info, poolsResponse] = await Promise.all([
    request<RawTeamLeagueHeader>(`/teamleague/GetHeaderAsync${query({ id: leagueId, language: 'en' })}`),
    request<RawTeamLeagueInfo>(`/teamleague/GetInfoAsync${query({ id: leagueId, language: 'en' })}`),
    request<RawLeaguePoolsResponse>(`/teamleague/GetPoolsInfoAsync${query({ id: leagueId })}`),
  ])
  const statistics = info.MatchesDetailsModel?.PoolsWithStatistics ?? []
  const pools = (poolsResponse.pools ?? []).map((pool) => normalizeLeaguePool(pool, statistics))
  const selectedPool = pools.find((pool) => pool.id === selectedPoolId) ?? pools[0] ?? null
  const base: Omit<LeagueSnapshot, 'selectedPool' | 'teams' | 'standings' | 'fixtures'> = {
    leagueId,
    name: header.Name,
    startDate: header.StartDate,
    endDate: header.EndDate,
    state: header.EventState ?? 0,
    statusText: header.EventStatusText ?? null,
    location: header.City || 'Location unavailable',
    country: header.Country || 'Country unavailable',
    countryCode: header.CountryShort || null,
    sport: sportName(header.Sport),
    eventUrl: header.EventUrl || `/en/teamleague/${leagueId}`,
    clubName: info.Club?.Name ?? null,
    clubUrl: info.Club?.Url ?? null,
    uniquePlayersCount: header.UniquePlayersCount ?? info.PoolsStatistics?.PlayersCount ?? 0,
    totalTeamCount: info.PoolsStatistics?.TeamsCount ?? 0,
    totalPlayerCount: info.PoolsStatistics?.PlayersCount ?? 0,
    totalClubCount: info.PoolsStatistics?.ClubsCount ?? 0,
    pools,
  }

  if (!selectedPool) {
    return { ...base, selectedPool: null, teams: [], standings: [], fixtures: [] }
  }

  const [rawTeams, standingsResponse, matchesResponse] = await Promise.all([
    request<RawLeaguePoolTeam[]>(`/teamleague/GetPoolTeamsAsync${query({ poolId: selectedPool.id, language: 'en' })}`),
    request<RawTeamStandingsResponse>(`/teamleague/GetTeamStandingsAsync${query({ poolId: selectedPool.id, language: 'en' })}`),
    request<RawLeaguePoolMatchesResponse>(`/teamleague/GetMatchesForPoolAsync${query({ poolId: selectedPool.id, language: 'en' })}`),
  ])
  const teams = rawTeams.map(normalizeLeagueTeam)
  const teamsByName = new Map(teams.map((team) => [team.name, team]))

  return {
    ...base,
    selectedPool,
    teams,
    standings: standingsResponse.scoresViewModels
      .map((standing) => normalizeLeagueStanding(standing, teamsByName))
      .sort((first, second) => first.standing - second.standing),
    fixtures: (matchesResponse.matches ?? [])
      .map(normalizeLeaguePoolFixture)
      .sort((first, second) => parseRankedinDate(first.date) - parseRankedinDate(second.date)),
  }
}

function isPlayerOnSide(side: RawSide, playerId: number) {
  return side.Player1Id === playerId || side.Player2Id === playerId
}

function sideNames(side: RawSide) {
  return [side.Name, side.Player2Name].filter(Boolean)
}

function formatMatchScore(match: RawMatch) {
  const score = match.MatchResult?.Score
  if (!score) return 'No score'

  const sets = score.DetailedScoring?.map((set) => {
    const tiebreak = set.LoserTiebreak === null ? '' : ` (${set.LoserTiebreak})`
    return `${set.FirstParticipantScore}-${set.SecondParticipantScore}${tiebreak}`
  })

  return sets?.length ? sets.join('  ') : `${score.FirstParticipantScore}-${score.SecondParticipantScore}`
}

function normalizeMatch(match: RawMatch, playerId: number): MatchRecord | null {
  const playerOnChallenger = isPlayerOnSide(match.Challenger, playerId)
  const playerOnChallenged = isPlayerOnSide(match.Challenged, playerId)
  if (!playerOnChallenger && !playerOnChallenged) return null

  const winner = match.MatchResult?.IsFirstParticipantWinner
  const won = winner === null || winner === undefined ? null : playerOnChallenger ? winner : !winner
  const currentSide = playerOnChallenger ? match.Challenger : match.Challenged
  const opponentSide = playerOnChallenger ? match.Challenged : match.Challenger

  return {
    id: match.Id,
    date: match.Date,
    className: match.TournamentClassName,
    draw: match.Draw,
    won,
    partner: sideNames(currentSide).find((name) => name !== currentSide.Name) ?? '',
    opponents: sideNames(opponentSide),
    opponentIds: [opponentSide.Player1Id, opponentSide.Player2Id].filter((id) => id > 0),
    score: formatMatchScore(match),
  }
}

export async function getEventMatches(tournamentId: number, classId: number, playerId: number) {
  const draws = await request<RawClassDraw[]>(
    `/tournament/GetClassesAndDrawNamesAsync${query({ tournamentId })}`,
  )
  const classDraw = draws.find((item) => item.Id === classId)
  const drawRequests = classDraw?.TournamentDraws ?? []

  const responses = drawRequests.length
    ? await Promise.all(
        drawRequests.map((draw) =>
          request<RawMatchesResponse>(
            `/tournament/GetMatchesSectionAsync${query({
              Id: tournamentId,
              LanguageCode: 'en',
              IsReadonly: true,
              TournamentClassId: classId,
              DrawStrength: draw.Strength,
              DrawStage: draw.Stage,
            })}`,
          ),
        ),
      )
    : [
        await request<RawMatchesResponse>(
          `/tournament/GetMatchesSectionAsync${query({
            Id: tournamentId,
            LanguageCode: 'en',
            IsReadonly: true,
          })}`,
        ),
      ]

  return responses.flatMap((response) => response.Matches).flatMap((match) => {
    const normalized = normalizeMatch(match, playerId)
    return normalized ? [normalized] : []
  })
}

export type RecentPlayerMatches = {
  matches: MatchRecord[]
  requestedEvents: number
  loadedEvents: number
  failedEvents: number
}

export async function getRecentPlayerMatches(analysis: PlayerAnalysis, maxEvents = 5): Promise<RecentPlayerMatches> {
  const events = analysis.events
    .filter((event) => event.matchQuery)
    .slice(0, maxEvents)
  const results = await Promise.allSettled(events.map((event) => {
    const query = event.matchQuery
    if (!query) return Promise.resolve([] as MatchRecord[])
    return getEventMatches(query.tournamentId, query.classId, analysis.playerId)
  }))

  return {
    matches: results.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
    requestedEvents: events.length,
    loadedEvents: results.filter((result) => result.status === 'fulfilled').length,
    failedEvents: results.filter((result) => result.status === 'rejected').length,
  }
}

async function analyzeEvent(event: RawEvent, playerId: number): Promise<PlayerEventAnalysis> {
  const base = {
    id: event.Id,
    name: event.Name,
    startDate: event.StartDate,
    className: null,
    standing: null,
    standingRangeTo: null,
    fieldSize: null,
    ratingBegin: null,
    ratingEnd: null,
    rankingPoints: null,
    partner: null,
    matchQuery: null,
    matches: [],
  } satisfies PlayerEventAnalysis

  try {
    const standings = await request<RawStandingResponse>(
      `/tournament/GetStandingsAsync${query({ id: event.Id })}`,
    )
    const rankingId = standings.Rankings[0]?.Id

    const match = await findPlayerClassResult(event.Id, standings.Classes, rankingId, playerId)
    if (!match) return base

    const playerIsFirst = match.playerResult.Player1ParticipantId === playerId
    return {
      ...base,
      className: match.classOption.Name,
      standing: match.playerResult.Standing,
      standingRangeTo: match.playerResult.StandingRangeTo || null,
      fieldSize: match.result.Data.length || null,
      ratingBegin: playerIsFirst ? match.playerResult.Player1RatingBegin : match.playerResult.Player2RatingBegin,
      ratingEnd: playerIsFirst ? match.playerResult.Player1RatingEnd : match.playerResult.Player2RatingEnd,
      rankingPoints: match.playerResult.RankingPoint?.Points ?? null,
      partner: playerIsFirst ? match.playerResult.Player2Name : match.playerResult.Player1Name,
      matchQuery: { tournamentId: event.Id, classId: match.classOption.Id },
      matches: [],
    }
  } catch {
    return base
  }
}

function leagueSideHasPlayer(side: RawLeagueSide, playerId: number) {
  return side.player1Id === playerId || side.player2Id === playerId
}

function leaguePartner(side: RawLeagueSide, playerId: number) {
  return side.player1Id === playerId ? side.player2Name : side.name
}

function formatLeagueMatchScore(match: RawLeagueDouble) {
  const score = match.matchResult?.score
  if (!score) return 'No score'

  const sets = score.detailedScoring?.map((set) => {
    const tiebreak = set.loserTiebreak === null ? '' : ` (${set.loserTiebreak})`
    return `${set.firstParticipantScore}-${set.secondParticipantScore}${tiebreak}`
  })

  return sets?.length ? sets.join('  ') : `${score.firstParticipantScore}-${score.secondParticipantScore}`
}

function normalizeLeagueMatch(match: RawLeagueDouble, playerId: number): LeagueMatchAnalysis | null {
  const playerOnChallenger = leagueSideHasPlayer(match.challenger, playerId)
  const playerOnChallenged = leagueSideHasPlayer(match.challenged, playerId)
  if (!playerOnChallenger && !playerOnChallenged) return null

  const currentSide = playerOnChallenger ? match.challenger : match.challenged
  const opponentSide = playerOnChallenger ? match.challenged : match.challenger
  const hasScore = match.matchResult?.hasScore ?? Boolean(match.matchResult?.score)
  const winner = match.matchResult?.score?.isFirstParticipantWinner

  return {
    id: match.id,
    date: match.date,
    round: null,
    partner: leaguePartner(currentSide, playerId),
    opponents: [opponentSide.name, opponentSide.player2Name].filter(Boolean),
    won: hasScore && winner !== undefined
      ? playerOnChallenger ? winner : !winner
      : null,
    played: match.matchResult?.isPlayed ?? hasScore,
    score: formatLeagueMatchScore(match),
  }
}

function normalizeLeagueFixture(fixture: RawLeagueFixture, teamId: number): LeagueFixtureAnalysis | null {
  if (fixture.team1.id !== teamId && fixture.team2.id !== teamId) return null
  const teamIsFirst = fixture.team1.id === teamId
  const team = teamIsFirst ? fixture.team1 : fixture.team2
  const opponent = teamIsFirst ? fixture.team2 : fixture.team1
  if (!team || !opponent) return null

  return {
    id: fixture.matchId,
    date: fixture.details?.time ?? fixture.details?.date ?? '',
    round: fixture.details?.round ?? null,
    teamName: team.name,
    opponentTeam: opponent.name,
    teamScore: team.result,
    opponentScore: opponent.result,
    won: fixture.showResults && team.isWinner !== null ? team.isWinner : null,
    matches: [],
  }
}

type LeagueAggregate = {
  id: string
  participantUrl: string
  participantName: string
  wins: number
  losses: number
  draws: number
  matchPoints: number
  gamesWon: number
  gamesLost: number
  teamGamesWon: number
  teamGamesLost: number
  scoredPoints: number
  concededPoints: number
  headToHead: Map<string, { wins: number; losses: number }>
}

const DEFAULT_LEAGUE_STANDING_RULES = [
  'Team Matches Won',
  'Matches Difference',
  'Sets Difference',
  'Game Difference',
  'Head To Head',
  'Match-Points',
  'Individual Matches Won',
]

function leagueAggregateKey(row: RawTeamStanding) {
  return row.participantUrl || String(row.participantId)
}

function createLeagueAggregate(row: RawTeamStanding): LeagueAggregate {
  return {
    id: leagueAggregateKey(row),
    participantUrl: row.participantUrl,
    participantName: row.participantName,
    wins: 0,
    losses: 0,
    draws: 0,
    matchPoints: 0,
    gamesWon: 0,
    gamesLost: 0,
    teamGamesWon: 0,
    teamGamesLost: 0,
    scoredPoints: 0,
    concededPoints: 0,
    headToHead: new Map(),
  }
}

function addLeagueMatchStanding(aggregate: LeagueAggregate, row: RawTeamStanding) {
  aggregate.wins += row.wins
  aggregate.losses += row.losses
  aggregate.draws += row.draws
  aggregate.matchPoints += row.matchPoints
  aggregate.gamesWon += row.gamesWon
  aggregate.gamesLost += row.gamesLost
  aggregate.teamGamesWon += row.teamGamesWon
  aggregate.teamGamesLost += row.teamGamesLost
  aggregate.scoredPoints += row.scoredPoints
  aggregate.concededPoints += row.concededPoints
}

function leagueRuleValue(aggregate: LeagueAggregate, rule: string) {
  const normalized = rule.toLowerCase()
  if (normalized.includes('team matches won')) return aggregate.wins
  if (normalized.includes('matches difference')) return aggregate.gamesWon - aggregate.gamesLost
  if (normalized.includes('sets difference')) return aggregate.teamGamesWon - aggregate.teamGamesLost
  if (normalized.includes('game difference')) return aggregate.scoredPoints - aggregate.concededPoints
  if (normalized.includes('match-points')) return aggregate.matchPoints
  if (normalized.includes('individual matches won')) return aggregate.gamesWon
  return null
}

function compareLeagueAggregates(
  first: LeagueAggregate,
  second: LeagueAggregate,
  rules: string[],
) {
  for (const rule of rules) {
    if (rule.toLowerCase().includes('head to head')) {
      const firstHead = first.headToHead.get(second.id)?.wins ?? 0
      const secondHead = second.headToHead.get(first.id)?.wins ?? 0
      if (firstHead !== secondHead) return secondHead - firstHead
      continue
    }

    const firstValue = leagueRuleValue(first, rule)
    const secondValue = leagueRuleValue(second, rule)
    if (firstValue !== null && secondValue !== null && firstValue !== secondValue) {
      return secondValue - firstValue
    }
  }

  return first.participantName.localeCompare(second.participantName)
}

function leagueFixtureResult(fixture: RawLeagueFixture, teamId: number): 'win' | 'loss' | 'draw' | null {
  const team = fixture.team1.id === teamId ? fixture.team1 : fixture.team2.id === teamId ? fixture.team2 : null
  const opponent = fixture.team1.id === teamId ? fixture.team2 : fixture.team2.id === teamId ? fixture.team1 : null
  if (!team || !opponent || !fixture.showResults) return null
  if (team.isWinner === true) return 'win'
  if (opponent.isWinner === true) return 'loss'
  if (team.isWinner === false && opponent.isWinner === false) return 'draw'
  return null
}

async function reconstructLeagueStandingHistory(
  poolId: number,
  teamId: number,
  finalStandings: RawTeamStandingsResponse,
  rules: string[],
): Promise<LeagueStandingSnapshot[]> {
  const poolMatches = await request<RawTeamMatchesResponse>(
    `/teamleague/GetMatchesForPoolAsync${query({ poolId, language: 'en' })}`,
  )
  const fixtures = poolMatches.matches.filter((fixture) => fixture.showResults)
  const fixtureStandings = await mapWithConcurrency(
    fixtures,
    MAX_LEAGUE_STANDING_CONCURRENCY,
    async (fixture) => ({
      fixture,
      standings: await request<RawTeamStandingsResponse>(
        `/teamleague/TeamLeagueTeamMatchStandingsAsync${query({
          teamMatchId: fixture.matchId,
          language: 'en',
        })}`,
      ),
    }),
  )
  const aggregates = new Map(finalStandings.scoresViewModels.map((row) => [leagueAggregateKey(row), createLeagueAggregate(row)]))
  const entries = fixtureStandings
    .map((entry) => ({
      ...entry,
      timestamp: parseRankedinDate(entry.fixture.details?.time ?? entry.fixture.details?.date ?? ''),
    }))
    .sort((first, second) => first.timestamp - second.timestamp)
  const snapshots: LeagueStandingSnapshot[] = []
  let entryIndex = 0

  while (entryIndex < entries.length) {
    const currentTimestamp = entries[entryIndex].timestamp
    const currentEntries = Number.isNaN(currentTimestamp)
      ? [entries[entryIndex]]
      : entries.filter((entry) => entry.timestamp === currentTimestamp)
    entryIndex += currentEntries.length

    currentEntries.forEach(({ standings }) => {
      const [firstRow, secondRow] = standings.scoresViewModels
      if (!firstRow || !secondRow) return
      const firstKey = leagueAggregateKey(firstRow)
      const secondKey = leagueAggregateKey(secondRow)
      const firstAggregate = aggregates.get(firstKey) ?? createLeagueAggregate(firstRow)
      const secondAggregate = aggregates.get(secondKey) ?? createLeagueAggregate(secondRow)
      addLeagueMatchStanding(firstAggregate, firstRow)
      addLeagueMatchStanding(secondAggregate, secondRow)
      aggregates.set(firstKey, firstAggregate)
      aggregates.set(secondKey, secondAggregate)
      const firstHead = firstAggregate.headToHead.get(secondKey) ?? { wins: 0, losses: 0 }
      const secondHead = secondAggregate.headToHead.get(firstKey) ?? { wins: 0, losses: 0 }
      firstAggregate.headToHead.set(secondKey, {
        wins: firstHead.wins + firstRow.wins,
        losses: firstHead.losses + firstRow.losses,
      })
      secondAggregate.headToHead.set(firstKey, {
        wins: secondHead.wins + secondRow.wins,
        losses: secondHead.losses + secondRow.losses,
      })
    })

    const ordered = [...aggregates.values()].sort((first, second) => compareLeagueAggregates(first, second, rules))
    currentEntries.forEach(({ fixture }) => {
      if (fixture.team1.id !== teamId && fixture.team2.id !== teamId) return
      const selected = ordered.find((aggregate) => aggregate.participantUrl.includes(`/${teamId}`))
      const opponent = fixture.team1.id === teamId ? fixture.team2 : fixture.team1
      if (!selected) return
      snapshots.push({
        fixtureId: fixture.matchId,
        date: fixture.details?.time ?? fixture.details?.date ?? '',
        standing: ordered.indexOf(selected) + 1,
        teamCount: ordered.length,
        result: leagueFixtureResult(fixture, teamId),
        teamScore: fixture.team1.id === teamId ? fixture.team1.result : fixture.team2.result,
        opponentScore: opponent.result,
        opponentTeam: opponent.name,
        teamWins: selected.wins,
        matchPoints: selected.matchPoints,
        matchDifference: selected.gamesWon - selected.gamesLost,
        setDifference: selected.teamGamesWon - selected.teamGamesLost,
        gameDifference: selected.scoredPoints - selected.concededPoints,
      })
    })
  }

  return snapshots
}

async function enrichLeagueFixture(fixture: LeagueFixtureAnalysis, playerId: number) {
  try {
    const response = await request<RawLeagueDoublesResponse>(
      `/teamleague/GetTeamLeagueTeamsMatchesAsync${query({ teamMatchId: fixture.id, language: 'en' })}`,
    )
    const matches = response.flatMap((group) => group.matches?.matches ?? [])
      .map((match) => normalizeLeagueMatch(match, playerId))
      .filter((match): match is LeagueMatchAnalysis => match !== null)
      .map((match) => ({ ...match, round: fixture.round }))

    return { ...fixture, matches }
  } catch {
    return fixture
  }
}

async function analyzeLeagueTeam(
  event: RawTeamLeagueHeader,
  detail: RawLeagueTeamDetail,
  playerId: number,
): Promise<LeagueSeasonAnalysis | null> {
  try {
    const [homepage, teamMatches] = await Promise.all([
      request<RawLeagueTeamHomepage>(
        `/teamleague/GetTeamLeagueTeamHomepageAsync${query({ TeamId: detail.teamId, Language: 'en' })}`,
      ),
      request<RawTeamMatchesResponse>(
        `/teamleague/GetTeamMatchesAsync${query({ teamId: detail.teamId, language: 'en' })}`,
      ),
    ])
    const [standings, rules] = await Promise.all([
      request<RawTeamStandingsResponse>(
        `/teamleague/GetTeamStandingsAsync${query({ poolId: homepage.poolId, language: 'en' })}`,
      ),
      request<RawStandingsRulesResponse>(
        `/teamleague/GetStandingsRulesSettingsAsync${query({
          teamLeagueId: event.Id,
          sport: event.Sport,
          language: 'en',
        })}`,
      ).catch(() => ({ TeamMatchesRules: [] })),
    ])
    const teamStanding = standings.scoresViewModels.find((standing) => (
      standing.participantUrl.includes(`/${detail.teamId}`) || standing.participantName === detail.teamName
    ))
    const fixtures = teamMatches.matches
      .map((fixture) => normalizeLeagueFixture(fixture, detail.teamId))
      .filter((fixture): fixture is LeagueFixtureAnalysis => fixture !== null)
      .sort((first, second) => parseRankedinDate(first.date) - parseRankedinDate(second.date))
    const standingHistoryPromise = reconstructLeagueStandingHistory(
      homepage.poolId,
      detail.teamId,
      standings,
      rules.TeamMatchesRules?.length ? rules.TeamMatchesRules : DEFAULT_LEAGUE_STANDING_RULES,
    ).catch(() => [])
    const enrichedFixturesPromise = mapWithConcurrency(
      fixtures,
      MAX_LEAGUE_STANDING_CONCURRENCY,
      (fixture) => enrichLeagueFixture(fixture, playerId),
    )
    const [standingHistory, enrichedFixtures] = await Promise.all([
      standingHistoryPromise,
      enrichedFixturesPromise,
    ])

    return {
      id: event.Id,
      name: event.Name,
      startDate: event.StartDate,
      endDate: event.EndDate,
      divisionName: detail.divisionName,
      regionName: detail.regionName,
      teamId: detail.teamId,
      teamName: detail.teamName,
      teamUrl: detail.teamUrl,
      poolId: homepage.poolId,
      teamStanding: teamStanding?.standing ?? null,
      teamCount: standings.scoresViewModels.length || null,
      teamPoints: teamStanding?.matchPoints ?? null,
      teamPlayed: teamStanding?.played ?? null,
      teamWins: teamStanding?.wins ?? null,
      teamLosses: teamStanding?.losses ?? null,
      eventUrl: event.EventUrl ?? `/en/teamleague/${event.Id}`,
      fixtures: enrichedFixtures,
      standingHistory,
    }
  } catch {
    return null
  }
}

async function analyzeLeagueSeason(event: RawEvent, playerId: number) {
  const [header, details] = await Promise.all([
    request<RawTeamLeagueHeader>(
      `/teamleague/GetHeaderAsync${query({ id: event.Id, language: 'en' })}`,
    ),
    request<RawLeagueTeamDetail[]>(
      `/teamleague/GetTeamLeagueTeamDetailsAsync${query({
        teamLeagueId: event.Id,
        participantId: playerId,
        language: 'en',
      })}`,
    ),
  ])
  const uniqueDetails = Array.from(new Map(details.map((detail) => [detail.teamId, detail])).values())
  return mapWithConcurrency(
    uniqueDetails,
    MAX_EVENT_ANALYSIS_CONCURRENCY,
    (detail) => analyzeLeagueTeam(header, detail, playerId),
  )
}

function cachedEventAnalysis(event: RawEvent, playerId: number) {
  const cacheKey = `${playerId}:${event.Id}`
  const cached = eventAnalysisCache.get(cacheKey)
  if (cached) return cached

  const pending = analyzeEvent(event, playerId)
  eventAnalysisCache.set(cacheKey, pending)
  pending.catch(() => {
    if (eventAnalysisCache.get(cacheKey) === pending) eventAnalysisCache.delete(cacheKey)
  })
  return pending
}

export async function getPlayerAnalysis(
  playerId: number,
  maxEvents = 10,
  onEvent?: (event: PlayerEventAnalysis) => void,
): Promise<PlayerAnalysis> {
  const events = await getPlayerParticipatedEvents(playerId)
  const finishedEvents = events
    .filter((event) => event.State === FINISHED_EVENT_STATE && event.Type === 4)
    .slice(0, maxEvents)
  const analyses = await mapWithConcurrency(finishedEvents, MAX_EVENT_ANALYSIS_CONCURRENCY, async (event) => {
    const analysis = await cachedEventAnalysis(event, playerId)
    onEvent?.(analysis)
    return analysis
  })

  return { playerId, playerName: 'Selected player', events: analyses }
}

function latestLeagueEvent(events: RawEvent[]) {
  return events
    .filter((event) => event.Type === 3)
    .sort((first, second) => parseRankedinDate(second.StartDate) - parseRankedinDate(first.StartDate))[0]
}

export async function getPlayerCurrentLeagueDivision(playerId: number): Promise<PlayerLeagueDivision | null> {
  const events = await getPlayerParticipatedEvents(playerId)
  const event = latestLeagueEvent(events)
  if (!event) return null

  const details = await request<RawLeagueTeamDetail[]>(
    `/teamleague/GetTeamLeagueTeamDetailsAsync${query({
      teamLeagueId: event.Id,
      participantId: playerId,
      language: 'en',
    })}`,
  )
  const divisionName = details.find((detail) => detail.divisionName?.trim())?.divisionName.trim()
  return divisionName ? { divisionName } : null
}

export async function getPlayerLeagueAnalysis(
  playerId: number,
  maxSeasons = 10,
  onSeason?: (season: LeagueSeasonAnalysis) => void,
): Promise<PlayerLeagueAnalysis> {
  const events = await getPlayerParticipatedEvents(playerId)
  const finishedLeagueEvents = events
    .filter((event) => event.State === FINISHED_EVENT_STATE && event.Type === 3)
    .slice(0, maxSeasons)
  const seasons = await mapWithConcurrency(
    finishedLeagueEvents,
    MAX_EVENT_ANALYSIS_CONCURRENCY,
    async (event) => {
      try {
        const analyses = await analyzeLeagueSeason(event, playerId)
        analyses.forEach((season) => {
          if (season) onSeason?.(season)
        })
        return analyses
      } catch {
        return []
      }
    },
  )

  return {
    playerId,
    playerName: 'Selected player',
    seasons: seasons.flatMap((items) => items).filter((season): season is LeagueSeasonAnalysis => season !== null),
  }
}
