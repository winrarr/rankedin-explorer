import { describe, expect, it } from 'vitest'
import { summarizeFieldLeagueDivisions } from './fieldBreakdown'

describe('summarizeFieldLeagueDivisions', () => {
  it('groups players by their current division and counts missing data', () => {
    expect(summarizeFieldLeagueDivisions({
      1: { divisionName: 'Serie 2 - A' },
      2: { divisionName: 'Serie 2 - A' },
      3: { divisionName: 'Serie 3 - B' },
      4: null,
    })).toEqual({
      divisions: [
        { divisionName: 'Serie 2 - A', playerCount: 2 },
        { divisionName: 'Serie 3 - B', playerCount: 1 },
      ],
      missingCount: 1,
    })
  })

  it('sorts divisions from the highest league level to the lowest', () => {
    expect(summarizeFieldLeagueDivisions({
      1: { divisionName: 'Serie 3 - B' },
      2: { divisionName: 'Serie 3 - B' },
      3: { divisionName: 'Serie 3 - B' },
      4: { divisionName: 'Serie 3 - B' },
      5: { divisionName: 'Serie 1 - A' },
      6: { divisionName: '1. Division - B' },
      7: { divisionName: 'Elitedivision - A' },
      8: { divisionName: 'Unrecognised division' },
    }).divisions).toEqual([
      { divisionName: 'Elitedivision - A', playerCount: 1 },
      { divisionName: '1. Division - B', playerCount: 1 },
      { divisionName: 'Serie 1 - A', playerCount: 1 },
      { divisionName: 'Serie 3 - B', playerCount: 4 },
      { divisionName: 'Unrecognised division', playerCount: 1 },
    ])
  })
})
