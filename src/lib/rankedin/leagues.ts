import { query, request } from './request'
import { parseRankedinDate, mapWithConcurrency, rankedInIdFromPlayerUrl, sportName } from './shared'
import { getPlayerParticipatedEvents } from './players'
import type {
  LeagueSearchResult,
  LeagueMatchAnalysis,
  LeagueFixtureAnalysis,
  LeagueStandingSnapshot,
  LeagueSeasonAnalysis,
  PlayerLeagueAnalysis,
  PlayerLeagueDivision,
  PlayerLeagueReference,
  LeaguePool,
  LeagueTeam,
  LeagueStanding,
  LeagueFixtureSide,
  LeagueFixture,
  LeagueSnapshot,
  RawLeagueSearchResult,
  RawEvent,
  RawTeamLeagueHeader,
  RawLeaguePoolStatistic,
  RawTeamLeagueInfo,
  RawLeaguePoolsResponse,
  RawLeaguePoolTeam,
  RawLeaguePoolMatchSide,
  RawLeaguePoolMatch,
  RawLeaguePoolMatchesResponse,
  RawLeagueTeamDetail,
  RawLeagueTeamHomepage,
  RawTeamStanding,
  RawTeamStandingsResponse,
  RawStandingsRulesResponse,
  RawLeagueFixture,
  RawTeamMatchesResponse,
  RawLeagueSide,
  RawLeagueDouble,
  RawLeagueDoublesResponse,
} from './types'

const FINISHED_EVENT_STATE = 4
const MAX_EVENT_ANALYSIS_CONCURRENCY = 4
const MAX_LEAGUE_STANDING_CONCURRENCY = 4


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
      rankedInId: rankedInIdFromPlayerUrl(player.Url),
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

function leagueSideHasPlayer(side: RawLeagueSide, playerId: number) {
  return side.player1Id === playerId || side.player2Id === playerId
}

function leagueSidePlayers(side: RawLeagueSide) {
  return [
    { id: side.player1Id, name: side.name, rankedInId: rankedInIdFromPlayerUrl(side.player1Url ?? '') },
    { id: side.player2Id, name: side.player2Name, rankedInId: rankedInIdFromPlayerUrl(side.player2Url ?? '') },
  ].flatMap((player) => {
    const name = player.name?.trim()
    return name ? [{ ...player, name }] : []
  })
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

export function normalizeLeagueMatch(match: RawLeagueDouble, playerId: number): LeagueMatchAnalysis | null {
  const playerOnChallenger = leagueSideHasPlayer(match.challenger, playerId)
  const playerOnChallenged = leagueSideHasPlayer(match.challenged, playerId)
  if (!playerOnChallenger && !playerOnChallenged) return null

  const currentSide = playerOnChallenger ? match.challenger : match.challenged
  const opponentSide = playerOnChallenger ? match.challenged : match.challenger
  const partner = leagueSidePlayers(currentSide).find((player) => player.id !== playerId)
  const hasScore = match.matchResult?.hasScore ?? Boolean(match.matchResult?.score)
  const winner = match.matchResult?.score?.isFirstParticipantWinner

  return {
    id: match.id,
    date: match.date,
    round: null,
    partner: partner ? { name: partner.name, rankedInId: partner.rankedInId } : null,
    opponents: leagueSidePlayers(opponentSide).map(({ name, rankedInId }) => ({ name, rankedInId })),
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

function currentLeagueEvent(events: RawEvent[]) {
  const leagueEvents = events.filter((event) => event.Type === 3)
  const activeOrUpcoming = leagueEvents.filter((event) => event.State !== FINISHED_EVENT_STATE)
  const now = Date.now()
  const active = activeOrUpcoming
    .filter((event) => parseRankedinDate(event.StartDate) <= now)
    .sort((first, second) => parseRankedinDate(second.StartDate) - parseRankedinDate(first.StartDate))[0]
  if (active) return active

  const upcoming = activeOrUpcoming
    .sort((first, second) => parseRankedinDate(first.StartDate) - parseRankedinDate(second.StartDate))[0]
  if (upcoming) return upcoming

  return leagueEvents
    .sort((first, second) => parseRankedinDate(second.StartDate) - parseRankedinDate(first.StartDate))[0]
}

export async function getPlayerCurrentLeagueDivision(playerId: number): Promise<PlayerLeagueDivision | null> {
  const events = await getPlayerParticipatedEvents(playerId)
  const event = currentLeagueEvent(events)
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

export async function getCurrentPlayerLeague(playerId: number): Promise<PlayerLeagueReference | null> {
  const events = await getPlayerParticipatedEvents(playerId)
  const event = currentLeagueEvent(events)
  if (!event) return null

  const details = await request<RawLeagueTeamDetail[]>(
    `/teamleague/GetTeamLeagueTeamDetailsAsync${query({
      teamLeagueId: event.Id,
      participantId: playerId,
      language: 'en',
    })}`,
  )
  const detail = details.find((item) => item.teamName?.trim() && item.teamUrl?.trim())
  if (!detail) return null

  return {
    leagueId: event.Id,
    leagueName: event.Name,
    leagueUrl: `/en/teamleague/${event.Id}`,
    startDate: event.StartDate,
    teamId: detail.teamId,
    teamName: detail.teamName,
    teamUrl: detail.teamUrl,
    divisionName: detail.divisionName,
    regionName: detail.regionName,
  }
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
