export type WorkspaceMode = 'tournament' | 'player' | 'league'

export function isDirectTournamentReference(value: string) {
  const trimmed = value.trim()
  return /^\d{3,}$/.test(trimmed) || /\/tournament\/\d+/i.test(trimmed)
}

export function isDirectPlayerReference(value: string) {
  const trimmed = value.trim()
  return /^R\d+$/i.test(trimmed) || /\/player\/R\d+/i.test(trimmed)
}

export function isDirectLeagueReference(value: string) {
  const trimmed = value.trim()
  return /^\d{2,}$/.test(trimmed) || /\/teamleague\/\d+/i.test(trimmed)
}
