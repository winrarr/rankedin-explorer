import { describe, expect, it } from 'vitest'
import { parseTournamentReference } from './rankedin'

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
