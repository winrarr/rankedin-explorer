import { describe, expect, it } from 'vitest'
import { tournament68954ClassLabels } from './fixtures/tournament-68954-class-labels'
import { additionalTournamentClassLabels } from './fixtures/tournament-class-labels'
import { normalizeCompetitionClassName, normalizeDpfRankingEntries, parseLeagueReference, parsePlayerReference, parseTournamentReference, parseWinLossRecord } from './rankedin'

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

describe('parseLeagueReference', () => {
  it('accepts a full Rankedin team league URL', () => {
    expect(parseLeagueReference('https://www.rankedin.com/en/teamleague/273/lunar-ligaen-efterar-2021')).toEqual({ leagueId: 273 })
  })

  it('accepts a league ID', () => {
    expect(parseLeagueReference('273')).toEqual({ leagueId: 273 })
  })

  it('rejects unrelated input', () => {
    expect(() => parseLeagueReference('not a league')).toThrow(/Rankedin Lunar League URL/)
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

describe('normalizeDpfRankingEntries', () => {
  it('keeps the selected player’s current points and ranking context', () => {
    expect(normalizeDpfRankingEntries([
      {
        Name: 'Emil Lilleøre',
        RankedinId: 'R000051592',
        PlayerAgeGroup: 'Men-Main',
        Participant: { MatchTypeId: 3 },
        ParticipantPoints: { Points: 11645, RankingDate: '2026-09-21T00:00:00' },
        Standing: 2,
      },
      {
        Name: 'Another player with the same name',
        RankedinId: 'R000051593',
        PlayerAgeGroup: 'Men-Main',
        Participant: { MatchTypeId: 3 },
        ParticipantPoints: { Points: 9000, RankingDate: '2026-09-21T00:00:00' },
        Standing: 4,
      },
    ], 'R000051592', '/en/ranking/2032/dansk-padel-forbunds-rangliste')).toEqual([{
      points: 11645,
      position: 2,
      ageGroup: 'Men-Main',
      matchType: 'Men doubles',
      rankingDate: '2026-09-21T00:00:00',
      rankingName: 'Dansk Padel Forbunds rangliste',
      rankingUrl: '/en/ranking/2032/dansk-padel-forbunds-rangliste',
    }])
  })
})
