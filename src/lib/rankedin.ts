const API_BASE = 'https://api.rankedin.com/v1'
const FINISHED_EVENT_STATE = 4

export type PlayerRecord = {
  id: number
  rankedInId: string
  name: string
  url: string
  rating: number | null
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

export type PlayerEventAnalysis = {
  id: number
  name: string
  startDate: string
  className: string | null
  standing: number | null
  standingRangeTo: number | null
  ratingBegin: number | null
  ratingEnd: number | null
  rankingPoints: number | null
  partner: string | null
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

type RawStandingResponse = {
  TournamentId: number
  Classes: Array<{ Id: number; Name: string; ParticipantsType: number }>
  Rankings: Array<{ Id: number; Name: string }>
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

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(`Rankedin returned ${response.status} for ${path}`)
  }

  return response.json() as Promise<T>
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value))
  })

  return `?${search.toString()}`
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

async function getClassMatches(tournamentId: number, classId: number, playerId: number) {
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
    ratingBegin: null,
    ratingEnd: null,
    rankingPoints: null,
    partner: null,
    matches: [],
  } satisfies PlayerEventAnalysis

  try {
    const standings = await request<RawStandingResponse>(
      `/tournament/GetStandingsAsync${query({ id: event.Id })}`,
    )
    const rankingId = standings.Rankings[0]?.Id

    for (const classOption of standings.Classes) {
      try {
        const result = await request<RawResultsResponse>(
          `/tournament/GetResultsAsync${query({
            tournamentId: event.Id,
            classId: classOption.Id,
            rankingId,
            language: 'en',
          })}`,
        )
        const playerResult = result.Data.find(
          (item) => item.Player1ParticipantId === playerId || item.Player2ParticipantId === playerId,
        )

        if (!playerResult) continue

        const playerIsFirst = playerResult.Player1ParticipantId === playerId
        const matches = await getClassMatches(event.Id, classOption.Id, playerId)
        return {
          ...base,
          className: classOption.Name,
          standing: playerResult.Standing,
          standingRangeTo: playerResult.StandingRangeTo || null,
          ratingBegin: playerIsFirst ? playerResult.Player1RatingBegin : playerResult.Player2RatingBegin,
          ratingEnd: playerIsFirst ? playerResult.Player1RatingEnd : playerResult.Player2RatingEnd,
          rankingPoints: playerResult.RankingPoint?.Points ?? null,
          partner: playerIsFirst ? playerResult.Player2Name : playerResult.Player1Name,
          matches,
        }
      } catch {
        continue
      }
    }
  } catch {
    return base
  }

  return base
}

export async function getPlayerAnalysis(playerId: number, maxEvents = 10): Promise<PlayerAnalysis> {
  const response = await request<RawEventsResponse>(
    `/player/ParticipatedEventsAsync${query({
      PlayerId: playerId,
      Language: 'en',
      Skip: 0,
      Take: Math.max(maxEvents * 3, 30),
    })}`,
  )
  const finishedEvents = response.Payload.filter((event) => event.State === FINISHED_EVENT_STATE).slice(
    0,
    maxEvents,
  )
  const events = await Promise.all(finishedEvents.map((event) => analyzeEvent(event, playerId)))
  const firstMatch = events.flatMap((event) => event.matches)[0]
  const playerName = firstMatch?.partner ? 'Selected player' : 'Selected player'

  return { playerId, playerName, events }
}
