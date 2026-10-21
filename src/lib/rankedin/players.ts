import { query, request } from './request'
import { mapWithConcurrency } from './shared'
import { getClassParticipants } from './tournaments'
import type {
  PlayerRecord,
  PlayerSearchResult,
  WinLossRecord,
  PlayerProfile,
  DpfPlayerRanking,
  MatchRecord,
  PlayerEventAnalysis,
  PlayerAnalysis,
  RawPlayerSearchResult,
  RawPlayerProfileResponse,
  RawStandingResponse,
  RawClassOption,
  RawClassDraw,
  RawEvent,
  RawEventsResponse,
  RawResultsResponse,
  RawRankingSearchResult,
  RawDpfRankingEntry,
  RawDpfRankingSearchResponse,
  PlayerClassResult,
  RawSide,
  RawMatch,
  RawMatchesResponse,
  RecentPlayerMatches,
} from './types'

const FINISHED_EVENT_STATE = 4
const eventAnalysisCache = new Map<string, Promise<PlayerEventAnalysis>>()
const participatedEventsCache = new Map<number, Promise<RawEvent[]>>()
const dpfPlayerRankingCache = new Map<string, Promise<DpfPlayerRanking[]>>()
let dpfRankingReferenceCache: Promise<{ id: number; url: string } | null> | null = null
const MAX_EVENT_ANALYSIS_CONCURRENCY = 4
const MAX_CLASS_PROBE_CONCURRENCY = 2
const PARTICIPATED_EVENTS_TAKE = 50
const DPF_RANKING_NAME = 'Dansk Padel Forbunds rangliste'
const DPF_RANKING_ORGANISATION = 'Dansk Padel Forbund'


export function getPlayerParticipatedEvents(playerId: number) {
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

export function parsePlayerReference(value: string) {
  const trimmed = value.trim()
  const directId = /^R\d+$/i.test(trimmed) ? trimmed : null
  const match = trimmed.match(/\/player\/(R\d+)/i) ?? trimmed.match(/\b(R\d+)\b/i)
  const rankedInId = (directId ?? match?.[1])?.toUpperCase()
  if (!rankedInId) throw new Error('Paste a Rankedin player profile URL or R-number.')

  return { rankedInId }
}

function dpfAgeGroup(age: number | null, isWomen: boolean) {
  if (age === null) return isWomen ? 83 : 82
  if (age < 20) {
    if (isWomen) {
      if (age >= 18) return 75
      if (age >= 16) return 74
      if (age >= 14) return 73
      if (age >= 12) return 72
      if (age >= 10) return 71
      return 70
    }
    if (age >= 18) return 69
    if (age >= 16) return 68
    if (age >= 14) return 67
    if (age >= 12) return 66
    if (age >= 10) return 65
    return 64
  }
  if (age < 35) return isWomen ? 83 : 82

  if (isWomen) {
    if (age >= 70) return 21
    if (age >= 65) return 20
    if (age >= 60) return 19
    if (age >= 55) return 18
    if (age >= 50) return 17
    if (age >= 45) return 16
    if (age >= 40) return 15
    return 14
  }
  if (age >= 85) return 12
  if (age >= 80) return 11
  if (age >= 75) return 10
  if (age >= 70) return 9
  if (age >= 65) return 8
  if (age >= 60) return 7
  if (age >= 55) return 6
  if (age >= 50) return 5
  if (age >= 45) return 4
  if (age >= 40) return 3
  return 2
}

export function normalizeDpfRankingEntries(
  entries: RawDpfRankingEntry[],
  rankedInId: string,
  rankingUrl: string,
): DpfPlayerRanking[] {
  return entries.flatMap((entry) => {
    if (entry.RankedinId?.toUpperCase() !== rankedInId.toUpperCase()) return []
    const points = entry.ParticipantPoints?.Points
    const position = entry.Standing
    if (typeof points !== 'number' || !Number.isFinite(points) || !Number.isFinite(position) || position < 1) return []

    const matchType = entry.Participant?.MatchTypeId
    return [{
      points,
      position,
      ageGroup: entry.PlayerAgeGroup?.trim() || null,
      matchType: matchType === 4 ? 'Women doubles' : 'Men doubles',
      rankingDate: entry.ParticipantPoints?.RankingDate || null,
      rankingName: DPF_RANKING_NAME,
      rankingUrl,
    }]
  }).sort((first, second) => second.points - first.points)
}

async function getDpfRankingReference() {
  if (dpfRankingReferenceCache) return dpfRankingReferenceCache

  const pending = request<RawRankingSearchResult[]>(
    `/Search/GetRankingsAsync${query({ term: DPF_RANKING_NAME, language: 'en', take: 10, skip: 0 })}`,
  ).then((rankings) => {
    const ranking = rankings.find((item) => (
      item.Name.toLowerCase() === DPF_RANKING_NAME.toLowerCase() &&
      item.OrganisationName?.toLowerCase() === DPF_RANKING_ORGANISATION.toLowerCase()
    ))
    const rankingId = ranking?.Url.match(/\/ranking\/(\d+)/i)?.[1]
    if (!ranking || !rankingId) return null
    return { id: Number(rankingId), url: ranking.Url }
  })
  dpfRankingReferenceCache = pending
  pending.catch(() => {
    if (dpfRankingReferenceCache === pending) dpfRankingReferenceCache = null
  })
  return pending
}

async function searchDpfRankingForPlayer(
  player: Pick<PlayerRecord, 'rankedInId' | 'name'>,
  rankingId: number,
  rankingUrl: string,
  rankingType: 3 | 4,
  ageGroup: number,
  signal?: AbortSignal,
) {
  const name = player.name.trim()
  const normalizedName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const searchTerms = Array.from(new Set([
    name,
    ...(normalizedName !== name ? [normalizedName] : []),
    ...(/[-'’]/.test(name) ? [name.split(/\s+/)[0] ?? ''] : []),
  ].filter(Boolean)))

  for (const searchTerm of searchTerms) {
    const response = await request<RawDpfRankingSearchResponse>(
      `/Ranking/SearchRankingPlayersAsync${query({
        SearchTerm: searchTerm,
        RankingId: rankingId,
        RankingType: rankingType,
        AgeGroup: ageGroup,
        ParticipantAgeGroup: ageGroup,
        ParticipantGender: rankingType === 4 ? 2 : 1,
        Language: 'en',
        Skip: 0,
        Take: 100,
      })}`,
      signal,
    )
    const matches = normalizeDpfRankingEntries(response.Payload ?? [], player.rankedInId, rankingUrl)
    if (matches.length) return matches
  }

  return []
}

async function loadDpfPlayerRankings(
  player: Pick<PlayerProfile, 'id' | 'rankedInId' | 'name' | 'age'>,
  signal?: AbortSignal,
): Promise<DpfPlayerRanking[]> {
  const ranking = await getDpfRankingReference()
  if (!ranking) return []

  const rankedAgeGroups: Array<[3 | 4, number]> = [
    [3, dpfAgeGroup(player.age, false)],
    [4, dpfAgeGroup(player.age, true)],
  ]
  let lookups = await Promise.allSettled(rankedAgeGroups.map(([rankingType, ageGroup]) => (
    searchDpfRankingForPlayer(player, ranking.id, ranking.url, rankingType, ageGroup, signal)
  )))
  let rankings = lookups.flatMap((lookup) => lookup.status === 'fulfilled' ? lookup.value : [])

  if (!rankings.length && player.age !== null && rankedAgeGroups.some(([, ageGroup], index) => (
    ageGroup !== (index === 0 ? 82 : 83)
  ))) {
    lookups = await Promise.allSettled([
      searchDpfRankingForPlayer(player, ranking.id, ranking.url, 3, 82, signal),
      searchDpfRankingForPlayer(player, ranking.id, ranking.url, 4, 83, signal),
    ])
    rankings = lookups.flatMap((lookup) => lookup.status === 'fulfilled' ? lookup.value : [])
  }

  if (!rankings.length && lookups.every((lookup) => lookup.status === 'rejected')) {
    throw lookups[0].status === 'rejected' ? lookups[0].reason : new Error('The DPF ranking could not be loaded.')
  }

  const uniqueRankings = new Map<string, DpfPlayerRanking>()
  rankings.forEach((item) => uniqueRankings.set(`${item.matchType}:${item.ageGroup}:${item.position}`, item))
  return Array.from(uniqueRankings.values()).sort((first, second) => second.points - first.points)
}

export function getPlayerDpfRankings(
  player: Pick<PlayerProfile, 'id' | 'rankedInId' | 'name' | 'age'> | PlayerRecord,
  signal?: AbortSignal,
): Promise<DpfPlayerRanking[]> {
  const age = 'age' in player ? player.age : null
  const cacheKey = `${player.id}:${age ?? 'unknown'}`
  const cached = signal ? undefined : dpfPlayerRankingCache.get(cacheKey)
  if (cached) return cached

  const pending = loadDpfPlayerRankings({ ...player, age }, signal)
  if (signal) return pending

  dpfPlayerRankingCache.set(cacheKey, pending)
  pending.catch(() => {
    if (dpfPlayerRankingCache.get(cacheKey) === pending) dpfPlayerRankingCache.delete(cacheKey)
  })
  return pending
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

export async function getPlayerProfile(reference: string, signal?: AbortSignal): Promise<PlayerProfile> {
  const { rankedInId } = parsePlayerReference(reference)
  const response = await request<RawPlayerProfileResponse>(
    `/player/PlayerProfileInfoAsync${query({ rankedinId: rankedInId, language: 'en' })}`,
    signal,
  )
  const header = response.Header
  const age = header.Age?.trim()

  return {
    id: header.PlayerId,
    rankedInId: header.RankedinId,
    name: response.FullName || `${header.FirstName} ${header.LastName}`.trim(),
    url: `/en/player/${header.RankedinId}/${response.NameForRouting}/info`,
    rating: null,
    countryCode: header.CountryShort,
    homeClubName: header.HomeClubName,
    homeClubUrl: header.HomeClubUrl,
    age: age && Number.isFinite(Number(age)) ? Number(age) : null,
    doublesStats: {
      currentYear: parseWinLossRecord(response.Statistics?.WinLossDoublesCurrentYear),
      career: parseWinLossRecord(response.Statistics?.CareerWinLossDoubles),
    },
  }
}

function isPlayerOnSide(side: RawSide, playerId: number) {
  return side.Player1Id === playerId || side.Player2Id === playerId
}

function sidePlayers(side: RawSide) {
  return [
    { id: side.Player1Id, name: side.Name },
    { id: side.Player2Id, name: side.Player2Name },
  ].filter((player) => Boolean(player.name))
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
  const currentPlayers = sidePlayers(currentSide)
  const opponentPlayers = sidePlayers(opponentSide)

  return {
    id: match.Id,
    date: match.Date,
    className: match.TournamentClassName,
    draw: match.Draw,
    won,
    partner: currentPlayers.find((player) => player.id !== playerId)?.name ?? '',
    opponents: opponentPlayers.map((player) => player.name),
    opponentIds: opponentPlayers.map((player) => player.id),
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
    partnerRankedInId: null,
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
    const partnerParticipantId = playerIsFirst
      ? match.playerResult.Player2ParticipantId
      : match.playerResult.Player1ParticipantId
    let partnerRankedInId: string | null = null
    try {
      const pairs = await getClassParticipants(event.Id, match.classOption.Id)
      partnerRankedInId = pairs
        .flatMap((pair) => [pair.first, pair.second])
        .find((player) => player.id === partnerParticipantId)?.rankedInId ?? null
    } catch {
      // Keep the event result when its public participant list is unavailable.
    }

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
      partnerRankedInId,
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
