import { describe, expect, it } from 'vitest'
import { formatCompactDate, formatDate } from './formatters'

describe('Rankedin date formatting', () => {
  it('handles the API day-first date format consistently', () => {
    expect(formatDate('21/08/2026')).toBe('21 Aug 2026')
    expect(formatCompactDate('21/08/2026')).toBe('21/8/2026')
  })

  it('keeps malformed dates honest', () => {
    expect(formatDate('not a date')).toBe('—')
    expect(formatCompactDate('not a date')).toBe('Unknown date')
  })
})
