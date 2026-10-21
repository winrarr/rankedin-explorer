// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LeagueSeasonAnalysis } from '../lib/rankedin'
import { LeagueProgressSection } from './LeagueProgressSection'

const season: LeagueSeasonAnalysis = {
  id: 1,
  name: 'Spring 2026',
  startDate: '01/03/2026',
  endDate: '30/06/2026',
  divisionName: 'Division 1',
  regionName: 'Copenhagen',
  teamId: 20,
  teamName: 'Example team',
  teamUrl: '/en/team/homepage/20',
  poolId: 30,
  teamStanding: 1,
  teamCount: 4,
  teamPoints: 3,
  teamPlayed: 1,
  teamWins: 1,
  teamLosses: 0,
  eventUrl: '/en/teamleague/1',
  fixtures: [{
    id: 40,
    date: '01/04/2026',
    round: 1,
    teamName: 'Example team',
    opponentTeam: 'Other team',
    teamScore: 3,
    opponentScore: 0,
    won: true,
    matches: [{
      id: 50,
      date: '01/04/2026',
      round: 1,
      partner: { name: 'Partner Player', rankedInId: 'R000000020' },
      opponents: [
        { name: 'Opponent One', rankedInId: 'R000000030' },
        { name: 'Opponent Two', rankedInId: 'R000000040' },
      ],
      won: true,
      played: true,
      score: '6-4 6-3',
    }],
  }],
  standingHistory: [],
}

describe('LeagueProgressSection', () => {
  it('opens player links from an individual league match', () => {
    render(<LeagueProgressSection seasons={[season]} isLoading={false} error={null} />)

    fireEvent.click(screen.getByText('Individual matches'))

    const partnerLink = screen.getByRole('link', { name: 'Open Partner Player in Rankedin Explorer in a new tab' })
    expect(partnerLink.getAttribute('href')).toBe('?mode=player&player=R000000020')
    expect(partnerLink.getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('link', { name: 'Open Opponent One in Rankedin Explorer in a new tab' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Opponent Two in Rankedin Explorer in a new tab' })).toBeTruthy()
  })
})
