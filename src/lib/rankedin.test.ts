import { describe, expect, it } from 'vitest'
import { parsePlayerReference, parseTournamentReference } from './rankedin'

describe('parseTournamentReference', () => {
  it('accepts a full Rankedin tournament URL', () => {
    expect(
      parseTournamentReference('https://www.rankedin.com/en/tournament/70385/meny-x-wepadel-open'),
    ).toEqual({ tournamentId: 70385 })
  })

  it('accepts a tournament ID', () => {
    expect(parseTournamentReference('70385')).toEqual({ tournamentId: 70385 })
  })

  it('rejects unrelated input', () => {
    expect(() => parseTournamentReference('not a tournament')).toThrow(/Rankedin tournament URL/)
  })
})

describe('parsePlayerReference', () => {
  it('accepts a full Rankedin player URL', () => {
    expect(
      parsePlayerReference('https://www.rankedin.com/en/player/R000229993/rasmus-kock-thygesen/info'),
    ).toEqual({ rankedInId: 'R000229993' })
  })

  it('accepts an R-number', () => {
    expect(parsePlayerReference('r000229993')).toEqual({ rankedInId: 'R000229993' })
  })

  it('rejects unrelated input', () => {
    expect(() => parsePlayerReference('not a player')).toThrow(/Rankedin player profile/)
  })
})
