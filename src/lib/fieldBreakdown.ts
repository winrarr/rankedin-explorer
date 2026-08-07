import { normalizeCompetitionClassName, type PlayerLeagueDivision } from './rankedin'

export type FieldClassSummary = {
  className: string
  kind: ReturnType<typeof normalizeCompetitionClassName>['kind']
  averageTopPercent: number
  resultCount: number
  playerCount: number
}

export type FieldLeagueDivisionCount = {
  divisionName: string
  playerCount: number
}

export const leagueDivisionScale = [
  'Elitedivision',
  '1. Division',
  '2. Division',
  'Danmarksserie',
  'Serie 1',
  'Serie 2',
  'Serie 3',
  'Serie 4',
  'Serie 5',
]

function leagueDivisionLabel(value: string) {
  return value.replace(/\s*-\s*[A-Z]\s*$/i, '').trim() || value
}

export function leagueDivisionRank(value: string) {
  const label = leagueDivisionLabel(value).toLowerCase()
  if (label.includes('elite')) return 0
  if (/^1\.\s*division/.test(label)) return 1
  if (/^2\.\s*division/.test(label)) return 2
  if (label.includes('danmarksserie')) return 3
  const serie = label.match(/^serie\s+(\d+)/)
  if (serie) return Math.min(8, 3 + Number(serie[1]))
  return leagueDivisionScale.length
}

export function leagueDivisionIndex(value: string) {
  return Math.min(leagueDivisionScale.length - 1, leagueDivisionRank(value))
}

export function summarizeFieldLeagueDivisions(divisions: Record<number, PlayerLeagueDivision | null>) {
  const groups = new Map<string, number>()
  let missingCount = 0

  Object.values(divisions).forEach((division) => {
    const divisionName = division?.divisionName.trim()
    if (!divisionName) {
      missingCount += 1
      return
    }
    groups.set(divisionName, (groups.get(divisionName) ?? 0) + 1)
  })

  return {
    divisions: Array.from(groups, ([divisionName, playerCount]): FieldLeagueDivisionCount => ({ divisionName, playerCount }))
      .sort((first, second) => leagueDivisionRank(first.divisionName) - leagueDivisionRank(second.divisionName)
        || second.playerCount - first.playerCount
        || first.divisionName.localeCompare(second.divisionName)),
    missingCount,
  }
}
