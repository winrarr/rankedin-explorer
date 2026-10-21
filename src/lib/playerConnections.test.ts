import { describe, expect, it } from 'vitest'
import type { MatchRecord, PlayerEventAnalysis } from './rankedin'
import { summarizePlayerConnections } from './playerConnections'

function event(overrides: Partial<PlayerEventAnalysis> = {}): PlayerEventAnalysis {
  return {
    id: 1,
    name: 'Event',
    startDate: '01/01/2026',
    className: 'Class',
    standing: 1,
    standingRangeTo: null,
    fieldSize: 8,
    ratingBegin: null,
    ratingEnd: null,
    rankingPoints: null,
    partner: 'Partner One',
    partnerRankedInId: 'R000000010',
    matchQuery: { tournamentId: 1, classId: 1 },
    matches: [],
    ...overrides,
  }
}

function match(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 1,
    date: '01/01/2026',
    className: 'Class',
    draw: 'Final',
    won: true,
    partner: 'Partner One',
    opponents: ['Opponent One', 'Opponent Two'],
    opponentIds: [20, 21],
    score: '6-2 6-3',
    ...overrides,
  }
}

describe('summarizePlayerConnections', () => {
  it('counts partners from visible events and opponents only from loaded match histories', () => {
    const events = [
      event({ id: 1 }),
      event({ id: 2, partner: 'Partner One', partnerRankedInId: 'r000000010' }),
      event({ id: 3, partner: 'Partner Two', partnerRankedInId: 'R000000011' }),
    ]
    const result = summarizePlayerConnections(events, {
      1: {
        matches: [match()],
        playerRankedInIds: { 20: 'R000000020' },
      },
      2: { matches: null, playerRankedInIds: {} },
    })

    expect(result.partners).toEqual([
      { name: 'Partner One', rankedInId: 'R000000010', eventCount: 2 },
      { name: 'Partner Two', rankedInId: 'R000000011', eventCount: 1 },
    ])
    expect(result.opponents).toEqual([
      { name: 'Opponent One', rankedInId: 'R000000020', matchCount: 1, wins: 1, losses: 0, unknownResults: 0 },
      { name: 'Opponent Two', rankedInId: null, matchCount: 1, wins: 1, losses: 0, unknownResults: 0 },
    ])
    expect(result.loadedMatchEventCount).toBe(1)
  })

  it('counts a doubles opponent pair once per match and keeps unknown outcomes unknown', () => {
    const result = summarizePlayerConnections(
      [event({ partner: null, partnerRankedInId: null })],
      {
        1: {
          matches: [match({ won: null, opponents: ['Opponent One', 'Opponent One'], opponentIds: [20, 20] })],
          playerRankedInIds: {},
        },
      },
    )

    expect(result.opponents).toEqual([
      { name: 'Opponent One', rankedInId: null, matchCount: 1, wins: 0, losses: 0, unknownResults: 1 },
    ])
  })
})
