import type { WorkspaceMode } from './references'

export type SharedLocation = {
  mode: WorkspaceMode
  tournamentReference: string
  classId: number | undefined
  playerReference: string
  leagueReference: string
  poolId: number | undefined
}

export type SharedLocationUpdate = {
  mode: WorkspaceMode
  tournament?: string
  classId?: number
  player?: string
  league?: string
  poolId?: number
}

export function readSharedLocation(): SharedLocation {
  if (typeof window === 'undefined') {
    return {
      mode: 'tournament',
      tournamentReference: '',
      classId: undefined,
      playerReference: '',
      leagueReference: '',
      poolId: undefined,
    }
  }

  const params = new URLSearchParams(window.location.search)
  const tournamentReference = params.get('tournament')?.trim() ?? ''
  const playerReference = params.get('player')?.trim() ?? ''
  const leagueReference = params.get('league')?.trim() ?? ''
  const modeParam = params.get('mode')
  const mode: WorkspaceMode = modeParam === 'league' || (!tournamentReference && !playerReference && leagueReference)
    ? 'league'
    : modeParam === 'player' || (!tournamentReference && playerReference)
      ? 'player'
      : 'tournament'
  const classValue = Number(params.get('class'))
  const poolValue = Number(params.get('pool'))

  return {
    mode,
    tournamentReference,
    classId: Number.isInteger(classValue) && classValue > 0 ? classValue : undefined,
    playerReference,
    leagueReference,
    poolId: Number.isInteger(poolValue) && poolValue > 0 ? poolValue : undefined,
  }
}

export function updateSharedLocation({ mode, tournament, classId, player, league, poolId }: SharedLocationUpdate) {
  if (typeof window === 'undefined') return

  const params = new URLSearchParams()
  if (mode !== 'tournament') params.set('mode', mode)
  if (mode === 'tournament' && tournament?.trim()) {
    params.set('tournament', tournament.trim())
    if (classId) params.set('class', String(classId))
  }
  if (mode === 'player' && player?.trim()) {
    params.set('player', player.trim())
  }
  if (mode === 'league' && league?.trim()) {
    params.set('league', league.trim())
    if (poolId) params.set('pool', String(poolId))
  }

  const query = params.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
}
