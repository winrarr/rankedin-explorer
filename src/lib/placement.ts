import type { PlayerEventAnalysis } from './rankedin'

export function relativeFinishPercent(event: Pick<PlayerEventAnalysis, 'standing' | 'standingRangeTo' | 'fieldSize'>) {
  if (event.standing === null || !event.fieldSize || event.fieldSize <= 1) return null

  const rangeEnd = event.standingRangeTo ?? event.standing
  const standing = (event.standing + rangeEnd) / 2
  return Math.min(1, Math.max(0, (event.fieldSize - standing) / (event.fieldSize - 1)))
}

export function placementGradient(event: PlayerEventAnalysis) {
  const finish = relativeFinishPercent(event) ?? 0.5
  const strongerFinishWeight = Math.round(finish * 100)
  const weakerFinishWeight = 100 - strongerFinishWeight
  return {
    background: `color-mix(in srgb, var(--sage-soft) ${strongerFinishWeight}%, var(--coral-soft) ${weakerFinishWeight}%)`,
    borderColor: `color-mix(in srgb, var(--sage) ${strongerFinishWeight}%, var(--coral) ${weakerFinishWeight}%)`,
    color: `color-mix(in srgb, var(--sage) ${strongerFinishWeight}%, var(--coral) ${weakerFinishWeight}%)`,
  }
}
