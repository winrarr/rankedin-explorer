export function explorerPlayerHref(rankedInId: string) {
  const params = new URLSearchParams({ mode: 'player', player: rankedInId })
  return `?${params.toString()}`
}
