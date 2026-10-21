// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  searchPlayersByName: vi.fn(),
  searchTeamLeaguesByName: vi.fn(),
  searchTournamentsByName: vi.fn(),
}))

vi.mock('../lib/rankedin', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/rankedin')>(),
  ...api,
}))

import { WorkspaceSearch } from './WorkspaceSearch'

function renderSearch(mode: 'player' | 'league') {
  const callbacks = {
    onReferenceChange: vi.fn(),
    onSubmit: vi.fn(),
    onClearReference: vi.fn(),
    onSelectTournament: vi.fn(),
    onSelectPlayer: vi.fn(),
    onSelectLeague: vi.fn(),
    onSelectLeaguePlayer: vi.fn(),
  }
  render(
    <WorkspaceSearch
      mode={mode}
      references={{ tournament: '', player: mode === 'player' ? 'Player' : '', league: mode === 'league' ? 'Player' : '' }}
      loading={{ tournament: false, player: false, league: false }}
      hasPlayerProfile={false}
      hasLeagueSnapshot={false}
      errors={{ tournament: null, player: null, league: null }}
      {...callbacks}
    />,
  )
  return callbacks
}

describe('WorkspaceSearch player results', () => {
  beforeEach(() => {
    api.searchPlayersByName.mockResolvedValue([{ id: 1, rankedInId: 'R000000001', name: 'Player Example' }])
    api.searchTeamLeaguesByName.mockResolvedValue([])
    api.searchTournamentsByName.mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('opens a player search result in a new tab while keeping profile selection available', async () => {
    const callbacks = renderSearch('player')
    fireEvent.focus(screen.getByRole('textbox', { name: 'Find a public player' }))

    await screen.findByRole('group', { name: 'Player search results' })
    const openLink = screen.getByRole('link', { name: 'Open Player Example in Rankedin Explorer in a new tab' })
    expect(openLink.getAttribute('href')).toBe('?mode=player&player=R000000001')
    expect(openLink.getAttribute('target')).toBe('_blank')

    fireEvent.click(screen.getByRole('button', { name: /Player ExampleR000000001/ }))
    expect(callbacks.onSelectPlayer).toHaveBeenCalledWith({ id: 1, rankedInId: 'R000000001', name: 'Player Example' })
  })

  it('opens Lunar League player search results in a new tab', async () => {
    renderSearch('league')
    fireEvent.focus(screen.getByRole('textbox', { name: 'Find a public Lunar League' }))

    await waitFor(() => expect(screen.getByRole('group', { name: 'Players with Lunar League history' })).toBeTruthy())
    const openLink = screen.getByRole('link', { name: 'Open Player Example in Rankedin Explorer in a new tab' })
    expect(openLink.getAttribute('href')).toBe('?mode=player&player=R000000001')
    expect(openLink.getAttribute('target')).toBe('_blank')
  })
})
