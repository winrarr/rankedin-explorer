import {
  compactClassName,
  formatCompactDate,
  placementSummaryPosition,
} from './formatters'
import type {
  PairRecord,
  PlayerAnalysis,
  PlayerEventAnalysis,
  PlayerLeagueDivision,
  TournamentSnapshot,
} from './rankedin'
import type {
  FieldClassSummary,
  FieldLeagueDivisionCount,
} from './fieldBreakdown'

export type TournamentExportInput = {
  snapshot: TournamentSnapshot
  averageRating: number | null
  fieldClassSummaries: FieldClassSummary[]
  fieldLeagueSummary: {
    divisions: FieldLeagueDivisionCount[]
    missingCount: number
  }
  fieldPlacementSummaries: Record<number, PlayerAnalysis | null>
  fieldLeagueDivisions: Record<number, PlayerLeagueDivision | null>
  fieldPlacementsLoaded: boolean
  fieldLeagueDivisionsLoaded: boolean
}

type ExportRecentResult = {
  date: string
  dateLabel: string
  eventId: number
  event: string
  normalizedClass: string
  rawClass: string | null
  placement: number | null
  placementRangeTo: number | null
  placementLabel: string
  fieldSize: number | null
  placementPercent: number | null
  partner: string | null
  sourceUrl: string
}

type ExportPlayer = {
  id: number
  rankedInId: string
  name: string
  profileUrl: string
  ratingAtEntry: number | null
  currentLunarLeagueDivision: string | null
  recentResults: ExportRecentResult[] | null
}

type ExportPair = {
  position: number
  id: string
  ranking: number | null
  players: ExportPlayer[]
}

export type TournamentExport = {
  exportVersion: 1
  exportedAt: string
  source: {
    app: 'Rankedin Explorer'
    tournamentUrl: string
  }
  tournament: {
    id: number
    name: string
    location: string
    country: string
    sport: string
    startDate: string
    endDate: string
    state: number
    isPremium: boolean
    selectedClass: {
      id: number
      name: string
    }
    classes: TournamentSnapshot['classes']
  }
  summary: {
    registeredPlayers: number
    pairs: number
    averageSkill: number | null
    currentLunarLeaguePlayers: number
    currentLunarLeagueMissingPlayers: number
    recentFormByClass: FieldClassSummary[]
    dataStatus: {
      recentForm: 'complete' | 'partial'
      lunarLeague: 'complete' | 'partial'
    }
  }
  lunarLeague: {
    divisions: FieldLeagueDivisionCount[]
    missingPlayers: number
    players: Array<{
      playerId: number
      playerName: string
      division: string | null
    }>
  }
  pairs: ExportPair[]
}

function eventPlacementPercent(event: PlayerEventAnalysis) {
  if (event.standing === null || !event.fieldSize) return null
  const rangeEnd = event.standingRangeTo ?? event.standing
  return Math.min(1, Math.max(0, ((event.standing + rangeEnd) / 2) / event.fieldSize))
}

function exportRecentResult(event: PlayerEventAnalysis): ExportRecentResult {
  return {
    date: event.startDate,
    dateLabel: formatCompactDate(event.startDate),
    eventId: event.id,
    event: event.name,
    normalizedClass: compactClassName(event.className),
    rawClass: event.className,
    placement: event.standing,
    placementRangeTo: event.standingRangeTo,
    placementLabel: placementSummaryPosition(event),
    fieldSize: event.fieldSize,
    placementPercent: eventPlacementPercent(event),
    partner: event.partner,
    sourceUrl: `https://www.rankedin.com/en/tournament/${event.id}`,
  }
}

function exportPlayer(
  player: PairRecord['first'],
  fieldPlacementSummaries: Record<number, PlayerAnalysis | null>,
  fieldLeagueDivisions: Record<number, PlayerLeagueDivision | null>,
): ExportPlayer {
  const hasPlacementSummary = Object.prototype.hasOwnProperty.call(fieldPlacementSummaries, player.id)
  const analysis = fieldPlacementSummaries[player.id]

  return {
    id: player.id,
    rankedInId: player.rankedInId,
    name: player.name,
    profileUrl: `https://www.rankedin.com${player.url}`,
    ratingAtEntry: player.rating,
    currentLunarLeagueDivision: fieldLeagueDivisions[player.id]?.divisionName ?? null,
    recentResults: hasPlacementSummary
      ? analysis
        ? analysis.events.filter((event) => event.className).slice(0, 5).map(exportRecentResult)
        : null
      : null,
  }
}

function exportPair(
  pair: PairRecord,
  position: number,
  fieldPlacementSummaries: Record<number, PlayerAnalysis | null>,
  fieldLeagueDivisions: Record<number, PlayerLeagueDivision | null>,
): ExportPair {
  return {
    position,
    id: pair.id,
    ranking: pair.ranking,
    players: [pair.first, pair.second].map((player) => exportPlayer(
      player,
      fieldPlacementSummaries,
      fieldLeagueDivisions,
    )),
  }
}

export function buildTournamentExport(input: TournamentExportInput): TournamentExport {
  const { snapshot, fieldLeagueSummary } = input
  const pairs = snapshot.participants.map((pair, index) => exportPair(
    pair,
    index + 1,
    input.fieldPlacementSummaries,
    input.fieldLeagueDivisions,
  ))
  const players = pairs.flatMap((pair) => pair.players)

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    source: {
      app: 'Rankedin Explorer',
      tournamentUrl: `https://www.rankedin.com/en/tournament/${snapshot.tournamentId}`,
    },
    tournament: {
      id: snapshot.tournamentId,
      name: snapshot.name,
      location: snapshot.location,
      country: snapshot.country,
      sport: snapshot.sport,
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
      state: snapshot.state,
      isPremium: snapshot.isPremium,
      selectedClass: {
        id: snapshot.selectedClass.id,
        name: snapshot.selectedClass.name,
      },
      classes: snapshot.classes,
    },
    summary: {
      registeredPlayers: snapshot.participants.length * 2,
      pairs: snapshot.participants.length,
      averageSkill: input.averageRating,
      currentLunarLeaguePlayers: fieldLeagueSummary.divisions.reduce((sum, division) => sum + division.playerCount, 0),
      currentLunarLeagueMissingPlayers: fieldLeagueSummary.missingCount,
      recentFormByClass: input.fieldClassSummaries,
      dataStatus: {
        recentForm: input.fieldPlacementsLoaded ? 'complete' : 'partial',
        lunarLeague: input.fieldLeagueDivisionsLoaded ? 'complete' : 'partial',
      },
    },
    lunarLeague: {
      divisions: fieldLeagueSummary.divisions,
      missingPlayers: fieldLeagueSummary.missingCount,
      players: players.map((player) => ({
        playerId: player.id,
        playerName: player.name,
        division: player.currentLunarLeagueDivision,
      })),
    },
    pairs,
  }
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function buildTournamentCsv(input: TournamentExportInput) {
  const report = buildTournamentExport(input)
  const recentColumns = Array.from({ length: 5 }, (_, index) => [
    `Recent ${index + 1} date`,
    `Recent ${index + 1} class`,
    `Recent ${index + 1} placement`,
    `Recent ${index + 1} field size`,
  ]).flat()
  const headers = [
    'Pair position',
    'Pair',
    'Pair ranking',
    'Player',
    'Rankedin ID',
    'Skill at entry',
    'Current Lunar League division',
    ...recentColumns,
  ]
  const rows = report.pairs.flatMap((pair) => pair.players.map((player) => {
    const recentValues = Array.from({ length: 5 }, (_, index) => {
      const result = player.recentResults?.[index]
      return [result?.dateLabel ?? '', result?.normalizedClass ?? '', result?.placementLabel ?? '', result?.fieldSize ?? '']
    }).flat()
    return [
      pair.position,
      pair.players.map((item) => item.name).join(' + '),
      pair.ranking,
      player.name,
      player.rankedInId,
      player.ratingAtEntry,
      player.currentLunarLeagueDivision,
      ...recentValues,
    ].map(csvCell).join(',')
  }))

  return `\uFEFF${[headers.map(csvCell).join(','), ...rows].join('\r\n')}\r\n`
}

export function tournamentExportFileBaseName(snapshot: TournamentSnapshot) {
  const cleanName = snapshot.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return `rankedin-${snapshot.tournamentId}-${cleanName || 'tournament'}`
}

function downloadFile(filename: string, content: string, mimeType: string) {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadTournamentJson(input: TournamentExportInput) {
  const report = buildTournamentExport(input)
  downloadFile(
    `${tournamentExportFileBaseName(input.snapshot)}.json`,
    JSON.stringify(report, null, 2),
    'application/json;charset=utf-8',
  )
}

export function downloadTournamentCsv(input: TournamentExportInput) {
  downloadFile(
    `${tournamentExportFileBaseName(input.snapshot)}.csv`,
    buildTournamentCsv(input),
    'text/csv;charset=utf-8',
  )
}
