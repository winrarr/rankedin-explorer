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
})
