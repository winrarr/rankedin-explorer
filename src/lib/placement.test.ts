import { describe, expect, it } from 'vitest'
import { relativeFinishPercent } from './placement'

describe('relativeFinishPercent', () => {
  it('scales first and last place to the same endpoints across field sizes', () => {
    expect(relativeFinishPercent({ standing: 1, standingRangeTo: null, fieldSize: 8 })).toBe(1)
    expect(relativeFinishPercent({ standing: 8, standingRangeTo: null, fieldSize: 8 })).toBe(0)
    expect(relativeFinishPercent({ standing: 1, standingRangeTo: null, fieldSize: 16 })).toBe(1)
    expect(relativeFinishPercent({ standing: 16, standingRangeTo: null, fieldSize: 16 })).toBe(0)
  })

  it('uses the midpoint of a tied placement range', () => {
    expect(relativeFinishPercent({ standing: 2, standingRangeTo: 3, fieldSize: 8 })).toBeCloseTo(11 / 14)
  })

  it('leaves unknown placements and fields without comparison unavailable', () => {
    expect(relativeFinishPercent({ standing: null, standingRangeTo: null, fieldSize: 8 })).toBeNull()
    expect(relativeFinishPercent({ standing: 1, standingRangeTo: null, fieldSize: null })).toBeNull()
    expect(relativeFinishPercent({ standing: 1, standingRangeTo: null, fieldSize: 1 })).toBeNull()
  })
})
