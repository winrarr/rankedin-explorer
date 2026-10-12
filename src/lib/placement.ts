import type { PlayerEventAnalysis } from './rankedin'

export function relativeFinishPercent(event: Pick<PlayerEventAnalysis, 'standing' | 'standingRangeTo' | 'fieldSize'>) {
  if (event.standing === null || !event.fieldSize || event.fieldSize <= 1) return null

  const rangeEnd = event.standingRangeTo ?? event.standing
  const standing = (event.standing + rangeEnd) / 2
  return Math.min(1, Math.max(0, (event.fieldSize - standing) / (event.fieldSize - 1)))
}
