import { describe, expect, it } from 'vitest'
import { tournament68954ClassLabels } from './fixtures/tournament-68954-class-labels'
import { additionalTournamentClassLabels } from './fixtures/tournament-class-labels'
import { normalizeCompetitionClassName, parsePlayerReference, parseTournamentReference, parseWinLossRecord } from './rankedin'

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

describe('normalizeCompetitionClassName', () => {
  it.each(tournament68954ClassLabels)('normalizes $raw', ({ raw, normalized, kind }) => {
    expect(normalizeCompetitionClassName(raw)).toEqual({ name: normalized, kind })
  })

  it.each(additionalTournamentClassLabels)('normalizes tournament $tournamentId label $raw', ({ raw, normalized, kind }) => {
    expect(normalizeCompetitionClassName(raw)).toEqual({ name: normalized, kind })
  })

  it('keeps an unrecognised source label separate instead of inventing a level', () => {
    expect(normalizeCompetitionClassName('ABG Open')).toEqual({ name: 'ABG Open', kind: 'other' })
  })
})

describe('parseWinLossRecord', () => {
  it('normalizes Rankedin doubles statistics', () => {
    expect(parseWinLossRecord('15-14')).toEqual({ wins: 15, losses: 14 })
    expect(parseWinLossRecord('15–14')).toEqual({ wins: 15, losses: 14 })
  })

  it('returns null for missing or malformed statistics', () => {
    expect(parseWinLossRecord(null)).toBeNull()
    expect(parseWinLossRecord('unknown')).toBeNull()
  })
})
