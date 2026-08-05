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

export type TournamentSearchResult = {
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
  source: 'live' | 'preview'
}

export type MatchRecord = {
  id: number
  date: string
  className: string
  draw: string
  won: boolean | null
  partner: string
  opponents: string[]
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
type QueuedRequest = {
  cancelled: boolean
  run: () => void
}

const requestQueue: QueuedRequest[] = []
const MAX_ACTIVE_REQUESTS = 15
const MAX_EVENT_ANALYSIS_CONCURRENCY = MAX_ACTIVE_REQUESTS
const MAX_RETRY_ATTEMPTS = 3
let activeRequestCount = 0

function drainRequestQueue() {
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
    if (Number.isFinite(seconds)) return Math.min(5000, Math.max(250, seconds * 1000))
    const timestamp = Date.parse(retryAfter)
    if (!Number.isNaN(timestamp)) return Math.min(5000, Math.max(250, timestamp - Date.now()))
  }
  return Math.min(5000, 500 * (2 ** attempt))
}

async function fetchJson(path: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw abortError()

    const timeoutSignal = AbortSignal.timeout(12000)
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
    const response = await fetch(`${API_BASE}${path}`, { signal: requestSignal })
    if (response.ok) return response.json()

    const canRetry = response.status === 429 || response.status === 503
    if (!canRetry || attempt === MAX_RETRY_ATTEMPTS - 1) {
      throw new Error(`Rankedin returned ${response.status} for ${path}`)
    }
    await waitForRetry(retryDelay(response, attempt), signal)
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
        const result = await request<RawResultsResponse>(
          `/tournament/GetResultsAsync${query({
            tournamentId: eventId,
            classId: classOption.Id,
            rankingId,
            language: 'en',
          })}`,
          controller.signal,
        )
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
    Array.from({ length: Math.min(4, classes.length) }, () => worker()),
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

export function parseTournamentReference(value: string) {
  const trimmed = value.trim()
  const directId = /^\d+$/.test(trimmed) ? Number(trimmed) : null
  if (directId) return { tournamentId: directId }

  const match = trimmed.match(/\/tournament\/(\d+)/i) ?? trimmed.match(/\b(\d{3,})\b/)
  if (!match) throw new Error('Paste a Rankedin tournament URL or numeric tournament ID.')

  return { tournamentId: Number(match[1]) }
}

export async function searchTournamentsByName(term: string, take = 8): Promise<TournamentSearchResult[]> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const response = await request<RawTournamentSearchResult[]>(
    `/Search/GetTournamentsAsync${query({ term: normalizedTerm, language: 'en', take, skip: 0 })}`,
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

export function parsePlayerReference(value: string) {
  const trimmed = value.trim()
  const directId = /^R\d+$/i.test(trimmed) ? trimmed : null
  const match = trimmed.match(/\/player\/(R\d+)/i) ?? trimmed.match(/\b(R\d+)\b/i)
  const rankedInId = (directId ?? match?.[1])?.toUpperCase()
  if (!rankedInId) throw new Error('Paste a Rankedin player profile URL or R-number.')

  return { rankedInId }
}

export async function searchPlayersByName(term: string, take = 8): Promise<PlayerSearchResult[]> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const response = await request<RawPlayerSearchResult[]>(
    `/Search/GetPlayersByNameSimpleAsync${query({ name: normalizedTerm, take, skip: 0 })}`,
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
    source: 'live',
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

function cachedEventAnalysis(event: RawEvent, playerId: number) {
  const cacheKey = `${playerId}:${event.Id}`
  const cached = eventAnalysisCache.get(cacheKey)
  if (cached) return cached

  const pending = analyzeEvent(event, playerId)
  eventAnalysisCache.set(cacheKey, pending)
  return pending
}

export async function getPlayerAnalysis(
  playerId: number,
  maxEvents = 10,
  onEvent?: (event: PlayerEventAnalysis) => void,
): Promise<PlayerAnalysis> {
  const response = await request<RawEventsResponse>(
    `/player/ParticipatedEventsAsync${query({
      PlayerId: playerId,
      Language: 'en',
      Skip: 0,
      Take: Math.max(maxEvents + 5, 30),
    })}`,
  )
  const finishedEvents = response.Payload
    .filter((event) => event.State === FINISHED_EVENT_STATE && event.Type === 4)
    .slice(0, maxEvents)
  const recentEvents = finishedEvents.slice(0, Math.min(10, maxEvents))
  const olderEvents = finishedEvents.slice(recentEvents.length)
  async function analyzeEvents(events: RawEvent[]) {
    return mapWithConcurrency(events, MAX_EVENT_ANALYSIS_CONCURRENCY, async (event) => {
      const analysis = await cachedEventAnalysis(event, playerId)
      onEvent?.(analysis)
      return analysis
    })
  }

  const recentAnalyses = await analyzeEvents(recentEvents)
  const olderAnalyses = await analyzeEvents(olderEvents)

  return { playerId, playerName: 'Selected player', events: [...recentAnalyses, ...olderAnalyses] }
}
