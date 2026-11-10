// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldLeagueDivisionSummary } from './FieldBreakdown'

describe('FieldLeagueDivisionSummary', () => {
  it('shows linked player names inside each current division', () => {
    render(<FieldLeagueDivisionSummary
      divisions={[{
        divisionName: 'Serie 2 - A',
        playerCount: 2,
        players: [
          { name: 'Alex One', rankedInId: 'R000000001' },
          { name: 'Bailey Two', rankedInId: 'R000000002' },
        ],
      }]}
      missingCount={0}
      totalPlayers={2}
    />)

    fireEvent.click(screen.getByText('Show players'))

    expect(screen.getByRole('link', { name: 'Open Alex One in Rankedin Explorer in a new tab' }).getAttribute('href'))
      .toBe('?mode=player&player=R000000001')
    expect(screen.getByRole('link', { name: 'Open Bailey Two in Rankedin Explorer in a new tab' })).toBeTruthy()
  })
})
