import { describe, expect, it } from 'vitest'
import { normalizeLeagueMatch } from './leagues'
import type { RawLeagueDouble } from './types'

const match: RawLeagueDouble = {
  id: 41,
  date: '2026-06-01T10:00:00',
  challenger: {
    name: 'Selected player',
    player2Name: 'Tournament partner',
    player1Id: 10,
    player2Id: 20,
    player1Url: '/en/player/R000000010/selected-player/info',
    player2Url: '/en/player/R000000020/tournament-partner/info',
  },
  challenged: {
    name: 'Opponent one',
    player2Name: 'Opponent two',
    player1Id: 30,
    player2Id: 40,
    player1Url: '/en/player/R000000030/opponent-one/info',
    player2Url: '/en/player/R000000040/opponent-two/info',
  },
  matchResult: {
    hasScore: true,
    isFirstParticipantWinner: true,
    isPlayed: true,
    score: {
      firstParticipantScore: 2,
      secondParticipantScore: 1,
      isFirstParticipantWinner: true,
      detailedScoring: [],
    },
  },
}

describe('normalizeLeagueMatch', () => {
  it('retains public player links for the selected player’s partner and opponents', () => {
    expect(normalizeLeagueMatch(match, 10)).toMatchObject({
      partner: { name: 'Tournament partner', rankedInId: 'R000000020' },
      opponents: [
        { name: 'Opponent one', rankedInId: 'R000000030' },
        { name: 'Opponent two', rankedInId: 'R000000040' },
      ],
      won: true,
    })
  })

  it('uses the correct side when the selected player is in the challenged pair', () => {
    expect(normalizeLeagueMatch(match, 40)).toMatchObject({
      partner: { name: 'Opponent one', rankedInId: 'R000000030' },
      opponents: [
        { name: 'Selected player', rankedInId: 'R000000010' },
        { name: 'Tournament partner', rankedInId: 'R000000020' },
      ],
      won: false,
    })
  })

  it('ignores matches that do not include the selected player', () => {
    expect(normalizeLeagueMatch(match, 999)).toBeNull()
  })
})
