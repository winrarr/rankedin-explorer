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
  age: number | null
  doublesStats: PlayerDoublesStats
}

export type DpfPlayerRanking = {
  points: number
  position: number
  ageGroup: string | null
  matchType: string
  rankingDate: string | null
  rankingName: string
  rankingUrl: string
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
  partnerRankedInId: string | null
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

export type PlayerLeagueReference = {
  leagueId: number
  leagueName: string
  leagueUrl: string
  startDate: string
  teamId: number
  teamName: string
  teamUrl: string
  divisionName: string
  regionName: string
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
  rankedInId: string | null
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

export type RawPlayer = {
  Id: number
  RankedinId: string
  Name: string
  PlayerUrl: string
  RatingBegin: number | null
}

export type RawPlayerSearchResult = {
  Id: number
  Name: string
  RankedinId: string
}

export type RawTournamentSearchResult = {
  Url: string
  Name: string
  StartDate: string | null
  Sport: string | null
  CountryFlag: string | null
  IsPremium: boolean | null
}

export type RawLeagueSearchResult = {
  Url?: string
  Name?: string
  StartDate?: string | null
  Sport?: string | null
  CountryFlag?: string | null
  IsPremium?: boolean | null
}

export type RawParticipant = {
  Participant: {
    FirstPlayer: RawPlayer
    SecondPlayer: RawPlayer
  }
  Ranking?: string
}

export type RawPlayersResponse = {
  Participants: RawParticipant[]
}

export type RawHeader = {
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

export type RawPlayerProfileResponse = {
  Header: {
    PlayerId: number
    FirstName: string
    LastName: string
    Age?: string | null
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

export type RawStandingResponse = {
  TournamentId: number
  Classes: RawClassOption[]
  Rankings: Array<{ Id: number; Name: string }>
}

export type RawClassOption = {
  Id: number
  Name: string
  ParticipantsType: number
}

export type RawClassDraw = {
  Id: number
  Name: string
  TournamentDraws: Array<{ Strength: number; Stage: number }>
}

export type RawEvent = {
  Id: number
  Name: string
  State: number
  Type?: number
  StartDate: string
}

export type RawEventsResponse = {
  Payload: RawEvent[]
  TotalCount: number
}

export type RawTeamLeagueHeader = {
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

export type RawLeaguePoolStatistic = {
  DivisionName?: string | null
  RegionName?: string | null
  TeamsCount?: number
  PlayersCount?: number
  PoolId?: number
}

export type RawTeamLeagueInfo = {
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

export type RawLeaguePoolsResponse = {
  pools?: Array<{
    id: number
    name: string
    isPrimary: boolean
  }>
}

export type RawLeaguePoolTeam = {
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

export type RawLeaguePoolMatchSide = {
  url: string
  isWinner: boolean | null
  name: string
  result: number | null
  id: number
}

export type RawLeaguePoolMatch = {
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

export type RawLeaguePoolMatchesResponse = {
  matches?: RawLeaguePoolMatch[]
}

export type RawLeagueTeamDetail = {
  teamId: number
  teamName: string
  teamUrl: string
  divisionName: string
  regionName: string
}

export type RawLeagueTeamHomepage = {
  teamLeagueId: number
  teamLeagueName: string
  poolId: number
  team: {
    id: number
    name: string
  }
}

export type RawTeamStanding = {
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

export type RawTeamStandingsResponse = {
  scoresViewModels: RawTeamStanding[]
}

export type RawStandingsRulesResponse = {
  TeamMatchesRules?: string[]
}

export type RawLeagueFixtureSide = {
  id: number
  name: string
  result: number | null
  isWinner: boolean | null
}

export type RawLeagueFixture = {
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

export type RawTeamMatchesResponse = {
  matches: RawLeagueFixture[]
}

export type RawLeagueSide = {
  name: string
  player2Name: string
  player1Id: number
  player2Id: number
}

export type RawLeagueDouble = {
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

export type RawLeagueDoublesResponse = Array<{
  matches?: {
    matches?: RawLeagueDouble[]
  }
}>

export type RawResult = {
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

export type RawResultsResponse = {
  Data: RawResult[]
}

export type RawRankingSearchResult = {
  Name: string
  Url: string
  OrganisationName: string | null
}

export type RawDpfRankingEntry = {
  Name: string | null
  RankedinId: string | null
  PlayerAgeGroup: string | null
  Participant?: {
    MatchTypeId: number
  }
  ParticipantPoints?: {
    Points: number
    RankingDate: string
  }
  Standing: number
}

export type RawDpfRankingSearchResponse = {
  Payload: RawDpfRankingEntry[] | null
}

export type PlayerClassResult = {
  classOption: RawClassOption
  result: RawResultsResponse
  playerResult: RawResult
}

export type RawSide = {
  Name: string
  Player2Name: string
  Player1Id: number
  Player2Id: number
}

export type RawMatch = {
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

export type RawMatchesResponse = {
  Matches: RawMatch[]
}


export type RecentPlayerMatches = {
  matches: MatchRecord[]
  requestedEvents: number
  loadedEvents: number
  failedEvents: number
}
