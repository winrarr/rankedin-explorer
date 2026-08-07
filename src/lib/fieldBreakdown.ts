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
      .sort((first, second) => second.playerCount - first.playerCount || first.divisionName.localeCompare(second.divisionName)),
    missingCount,
  }
}
