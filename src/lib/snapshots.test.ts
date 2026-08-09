import { describe, expect, it } from 'vitest'
import { restoreTournamentSnapshot, type RestoredTournamentSnapshot } from './snapshots'
import type { TournamentExport } from './exports'

const report: TournamentExport = {
  exportVersion: 1,
  exportedAt: '2026-08-09T00:00:00.000Z',
  source: {
    app: 'Rankedin Explorer',
    tournamentUrl: 'https://www.rankedin.com/en/tournament/68954',
  },
  tournament: {
    id: 68954,
    name: 'Pakhus Open',
    location: 'Aarhus',
    country: 'Denmark',
    sport: 'Padel',
    startDate: '21/08/2026',
    endDate: '22/08/2026',
    state: 4,
    isPremium: false,
    selectedClass: { id: 163028, name: 'Herrer DPF35' },
    classes: [{ id: 163028, name: 'Herrer DPF35' }],
  },
  summary: {
    registeredPlayers: 2,
    pairs: 1,
    averageSkill: 14,
    currentLunarLeaguePlayers: 1,
    currentLunarLeagueMissingPlayers: 1,
    recentFormByClass: [],
    dataStatus: { recentForm: 'complete', lunarLeague: 'complete' },
  },
  lunarLeague: {
    divisions: [{ divisionName: 'Serie 1', playerCount: 1 }],
    missingPlayers: 1,
    players: [
      { playerId: 1, playerName: 'Alpha One', division: 'Serie 1' },
      { playerId: 2, playerName: 'Beta Two', division: null },
    ],
  },
  pairs: [{
    position: 1,
    id: '1-2',
    ranking: 3,
    players: [
      {
        id: 1,
        rankedInId: 'R000000001',
        name: 'Alpha One',
        profileUrl: 'https://www.rankedin.com/en/player/R000000001/alpha-one/info',
        ratingAtEntry: 14.5,
        currentLunarLeagueDivision: 'Serie 1',
        recentResults: [{
          date: '01/08/2026',
          dateLabel: '01 Aug 2026',
          eventId: 100,
          event: 'Spring Open',
          normalizedClass: 'DPF35 Herrer',
          rawClass: 'Herrer DPF35',
          placement: 2,
          placementRangeTo: 3,
          placementLabel: '2nd–3rd',
          fieldSize: 8,
          placementPercent: .3125,
          partner: 'Beta Two',
          sourceUrl: 'https://www.rankedin.com/en/tournament/100',
        }],
      },
      {
        id: 2,
        rankedInId: 'R000000002',
        name: 'Beta Two',
        profileUrl: 'https://www.rankedin.com/en/player/R000000002/beta-two/info',
        ratingAtEntry: 13.5,
        currentLunarLeagueDivision: null,
        recentResults: null,
      },
    ],
  }],
}

describe('tournament snapshots', () => {
  it('restores a report into renderable tournament state without API fields', () => {
    const restored: RestoredTournamentSnapshot = restoreTournamentSnapshot(report)

    expect(restored.snapshot).toMatchObject({
      tournamentId: 68954,
      selectedClass: { id: 163028, name: 'Herrer DPF35' },
      participants: [{
        id: '1-2',
        first: {
          id: 1,
          url: '/en/player/R000000001/alpha-one/info',
        },
      }],
    })
    expect(restored.averageRating).toBe(14)
    expect(restored.fieldPlacementSummaries[1]?.events[0]).toMatchObject({
      id: 100,
      className: 'Herrer DPF35',
      standing: 2,
      standingRangeTo: 3,
      fieldSize: 8,
      matches: [],
    })
    expect(restored.fieldPlacementSummaries[2]).toBeNull()
    expect(restored.fieldLeagueDivisions).toEqual({
      1: { divisionName: 'Serie 1' },
      2: null,
    })
    expect(restored.fieldPlacementsLoaded).toBe(true)
    expect(restored.fieldLeagueDivisionsLoaded).toBe(true)
  })
})
