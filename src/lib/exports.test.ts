import { describe, expect, it } from 'vitest'
import { buildTournamentCsv, buildTournamentExport, tournamentExportFileBaseName, type TournamentExportInput } from './exports'

const input: TournamentExportInput = {
  snapshot: {
    tournamentId: 68954,
    name: 'Pakhus Open #10 powered by Liiteguard',
    location: 'Aarhus',
    country: 'Denmark',
    sport: 'Padel',
    startDate: '21/08/2026',
    endDate: '22/08/2026',
    state: 4,
    isPremium: false,
    classes: [{ id: 163028, name: 'Herrer DPF35' }],
    selectedClass: { id: 163028, name: 'Herrer DPF35' },
    participants: [{
      id: '1-2',
      ranking: 3,
      first: { id: 1, rankedInId: 'R000000001', name: 'Alpha, One', url: '/en/player/R000000001/alpha/info', rating: 14.5 },
      second: { id: 2, rankedInId: 'R000000002', name: 'Beta Two', url: '/en/player/R000000002/beta/info', rating: 13.5 },
    }],
  },
  averageRating: 14,
  fieldClassSummaries: [{
    className: 'DPF35 Herrer',
    kind: 'dpf',
    averageTopPercent: .25,
    resultCount: 2,
    playerCount: 2,
  }],
  fieldLeagueSummary: {
    divisions: [{ divisionName: 'Serie 1', playerCount: 1 }],
    missingCount: 1,
  },
  fieldPlacementSummaries: {
    1: {
      playerId: 1,
      playerName: 'Alpha, One',
      events: [{
        id: 100,
        name: 'Spring Open',
        startDate: '01/08/2026',
        className: 'DPF35A Herrer',
        standing: 2,
        standingRangeTo: 3,
        fieldSize: 8,
        ratingBegin: 14,
        ratingEnd: 14.2,
        rankingPoints: 10,
        partner: 'Beta Two',
        matchQuery: null,
        matches: [],
      }],
    },
    2: null,
  },
  fieldLeagueDivisions: {
    1: { divisionName: 'Serie 1' },
    2: null,
  },
  fieldPlacementsLoaded: true,
  fieldLeagueDivisionsLoaded: true,
}

describe('tournament exports', () => {
  it('builds a normalized report without requesting additional data', () => {
    const report = buildTournamentExport(input)

    expect(report.summary).toMatchObject({
      registeredPlayers: 2,
      pairs: 1,
      averageSkill: 14,
      currentLunarLeaguePlayers: 1,
      currentLunarLeagueMissingPlayers: 1,
    })
    expect(report.pairs[0].players[0]).toMatchObject({
      currentLunarLeagueDivision: 'Serie 1',
      recentResults: [{
        normalizedClass: 'DPF35 Herrer',
        placementLabel: '2nd–3rd',
        fieldSize: 8,
      }],
    })
    expect(report.pairs[0].players[1].recentResults).toBeNull()
  })

  it('creates a spreadsheet-friendly CSV with quoted values', () => {
    const csv = buildTournamentCsv(input)

    expect(csv).toContain('Pair position,Pair,Pair ranking,Player')
    expect(csv).toContain('1,"Alpha, One + Beta Two",3,"Alpha, One"')
    expect(csv).toContain('2nd–3rd')
  })

  it('creates a safe file name from the tournament title', () => {
    expect(tournamentExportFileBaseName(input.snapshot)).toBe('rankedin-68954-pakhus-open-10-powered-by-liiteguard')
  })
})
