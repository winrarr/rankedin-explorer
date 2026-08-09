import { describe, expect, it } from 'vitest'
import { summarizeFieldOpponents } from './opponentContext'
import type { MatchRecord, PairRecord } from './rankedin'

const selectedPair: PairRecord = {
  id: '1-2',
  ranking: null,
  first: { id: 1, rankedInId: 'R1', name: 'Us One', url: '/en/player/R1/us-one', rating: null },
  second: { id: 2, rankedInId: 'R2', name: 'Us Two', url: '/en/player/R2/us-two', rating: null },
}

const field: PairRecord[] = [
  selectedPair,
  { id: '3-4', ranking: null, first: { id: 3, rankedInId: 'R3', name: 'Opponent One', url: '', rating: null }, second: { id: 4, rankedInId: 'R4', name: 'Opponent Two', url: '', rating: null } },
]

function match(overrides: Partial<MatchRecord>): MatchRecord {
  return {
    id: 1,
    date: '01/08/2026',
    className: 'DPF35 Herrer',
    draw: 'Main draw',
    won: true,
    partner: 'Us Two',
    opponents: ['Opponent One', 'Opponent Two'],
    opponentIds: [3, 4],
    score: '6-3 6-4',
    ...overrides,
  }
}

describe('summarizeFieldOpponents', () => {
  it('deduplicates matches and counts only opponents in the current field', () => {
    const result = summarizeFieldOpponents([
      match({ id: 1, date: '01/08/2026', won: true }),
      match({ id: 1, date: '01/08/2026', won: true }),
      match({ id: 2, date: '02/08/2026', won: false, opponentIds: [3], opponents: ['Opponent One'] }),
      match({ id: 3, date: '03/08/2026', won: null, opponentIds: [99], opponents: ['Outside field'] }),
    ], field, selectedPair)

    expect(result).toMatchObject({
      matchesChecked: 3,
      matchesWithFieldOpponents: 2,
      wins: 1,
      losses: 1,
      draws: 1,
    })
    expect(result.opponents).toEqual([
      expect.objectContaining({ id: 3, name: 'Opponent One', meetings: 2, wins: 1, losses: 1, latestDate: '02/08/2026', latestWon: false }),
      expect.objectContaining({ id: 4, name: 'Opponent Two', meetings: 1 }),
    ])
  })
})
