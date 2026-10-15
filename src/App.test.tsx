// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PairRecord, PlayerAnalysis, PlayerEventAnalysis, TournamentSnapshot } from './lib/rankedin'

const api = vi.hoisted(() => ({
  getClassParticipants: vi.fn(),
  getCurrentPlayerLeague: vi.fn(),
  getLeagueSnapshot: vi.fn(),
  getPlayerAnalysis: vi.fn(),
  getPlayerCurrentLeagueDivision: vi.fn(),
  getPlayerDpfRankings: vi.fn(),
  getPlayerLeagueAnalysis: vi.fn(),
  getPlayerProfile: vi.fn(),
  getRecentPlayerMatches: vi.fn(),
  getTournamentSnapshot: vi.fn(),
}))
const analytics = vi.hoisted(() => ({ trackSuccessfulLookup: vi.fn() }))

vi.mock('./lib/rankedin', async (importOriginal) => ({
  ...await importOriginal<typeof import('./lib/rankedin')>(),
  ...api,
}))
vi.mock('./lib/analytics', () => analytics)

import App from './App'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function pair(id: number, firstName: string): PairRecord {
  return {
    id: `${id}-${id + 1}`,
    ranking: null,
    first: { id, rankedInId: `R${id}`, name: firstName, url: `/en/player/R${id}`, rating: null },
    second: { id: id + 1, rankedInId: `R${id + 1}`, name: `${firstName} Partner`, url: `/en/player/R${id + 1}`, rating: null },
  }
}

function tournament(tournamentId: number, firstName: string): TournamentSnapshot {
  const classes = [
    { id: tournamentId * 10 + 1, name: 'Class A' },
    { id: tournamentId * 10 + 2, name: 'Class B' },
  ]
  return {
    tournamentId,
    name: `Tournament ${tournamentId}`,
    location: 'Copenhagen',
    country: 'Denmark',
    sport: 'Padel',
    startDate: '01/06/2026',
    endDate: '02/06/2026',
    state: 4,
    isPremium: false,
    classes,
    selectedClass: classes[0],
    participants: [pair(tournamentId * 100, firstName)],
  }
}

function analysis(playerId: number, className: string): PlayerAnalysis {
  const event: PlayerEventAnalysis = {
    id: playerId,
    name: `${className} history`,
    startDate: '01/05/2026',
    className,
    standing: 1,
    standingRangeTo: null,
    fieldSize: 8,
    ratingBegin: null,
    ratingEnd: null,
    rankingPoints: null,
    partner: null,
    matchQuery: null,
    matches: [],
  }
  return { playerId, playerName: 'A player', events: [event] }
}

describe('tournament class changes', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?mode=tournament&tournament=100')
    localStorage.clear()
    vi.clearAllMocks()
    api.getTournamentSnapshot.mockImplementation((reference: string) => Promise.resolve(tournament(Number(reference), `Tournament ${reference} player`)))
    api.getClassParticipants.mockImplementation((_tournamentId: number, classId: number) => Promise.resolve([pair(classId * 10, `Class ${classId} player`)]))
    api.getPlayerAnalysis.mockImplementation((playerId: number) => Promise.resolve({ playerId, playerName: 'A player', events: [] }))
    api.getPlayerDpfRankings.mockResolvedValue([])
    api.getPlayerCurrentLeagueDivision.mockResolvedValue(null)
    api.getPlayerLeagueAnalysis.mockResolvedValue({ playerId: 0, playerName: 'A player', seasons: [] })
    api.getPlayerProfile.mockResolvedValue(null)
    api.getRecentPlayerMatches.mockResolvedValue({ matches: [], requestedEvents: 0, loadedEvents: 0, failedEvents: 0 })
    api.getCurrentPlayerLeague.mockResolvedValue(null)
    api.getLeagueSnapshot.mockResolvedValue(null)
  })

  afterEach(() => cleanup())

  it('switches classes while old player histories are still loading and ignores those late results', async () => {
    const pendingHistories = new Map<number, ReturnType<typeof deferred<PlayerAnalysis>>>()
    api.getPlayerAnalysis.mockImplementation((playerId: number) => {
      if (playerId === 10000 || playerId === 10001) {
        const request = deferred<PlayerAnalysis>()
        pendingHistories.set(playerId, request)
        return request.promise
      }
      return Promise.resolve({ playerId, playerName: 'A player', events: [] })
    })

    render(<App />)
    const classPicker = await screen.findByRole('combobox', { name: 'Choose tournament class' })
    await waitFor(() => expect(pendingHistories.size).toBe(2))
    expect((classPicker as HTMLSelectElement).disabled).toBe(false)

    fireEvent.change(classPicker, { target: { value: '1002' } })
    await waitFor(() => expect(api.getClassParticipants).toHaveBeenCalledWith(100, 1002))
    await waitFor(() => expect((classPicker as HTMLSelectElement).value).toBe('1002'))

    await act(async () => {
      for (const [playerId, request] of pendingHistories) request.resolve(analysis(playerId, 'Old class'))
    })

    await waitFor(() => expect((classPicker as HTMLSelectElement).value).toBe('1002'))
    expect(screen.queryByText('Old class')).toBeNull()
  })

  it('records a tournament lookup after its snapshot loads', async () => {
    render(<App />)

    await screen.findByRole('heading', { name: 'Tournament 100' })
    await waitFor(() => expect(analytics.trackSuccessfulLookup).toHaveBeenCalledWith('tournament'))
    expect(analytics.trackSuccessfulLookup).toHaveBeenCalledTimes(1)
  })

  it('does not record a tournament lookup when its snapshot fails', async () => {
    api.getTournamentSnapshot.mockRejectedValue(new Error('The tournament could not be loaded.'))
    render(<App />)

    await screen.findByRole('alert')
    expect(analytics.trackSuccessfulLookup).not.toHaveBeenCalled()
  })

  it('ignores a late class response after opening a different tournament', async () => {
    const pendingClass = deferred<PairRecord[]>()
    api.getClassParticipants.mockImplementation((_tournamentId: number, classId: number) => (
      classId === 1002 ? pendingClass.promise : Promise.resolve([pair(classId * 10, `Class ${classId} player`)])
    ))

    render(<App />)
    const classPicker = await screen.findByRole('combobox', { name: 'Choose tournament class' })
    fireEvent.change(classPicker, { target: { value: '1002' } })

    const tournamentInput = screen.getByPlaceholderText('Name, URL or ID')
    fireEvent.change(tournamentInput, { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Analyze field' }))
    await screen.findByRole('heading', { name: 'Tournament 200' })
    await screen.findByRole('row', { name: /View history for Tournament 200 player/ })

    await act(async () => pendingClass.resolve([pair(9900, 'Late old class player')]))

    await waitFor(() => expect(screen.getByRole('row', { name: /View history for Tournament 200 player/ })).toBeTruthy())
    expect(screen.queryByText('Late old class player')).toBeNull()
    expect((screen.getByRole('combobox', { name: 'Choose tournament class' }) as HTMLSelectElement).value).toBe('2001')
  })
})
