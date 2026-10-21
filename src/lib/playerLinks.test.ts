import { describe, expect, it } from 'vitest'
import { explorerPlayerHref } from './playerLinks'
import { rankedInIdFromPlayerUrl } from './rankedin/shared'

describe('player links', () => {
  it('extracts a public Rankedin ID from a player URL', () => {
    expect(rankedInIdFromPlayerUrl('https://www.rankedin.com/en/player/r000123456/example/info')).toBe('R000123456')
  })

  it('leaves non-player URLs unresolved', () => {
    expect(rankedInIdFromPlayerUrl('/en/team/123/example')).toBeNull()
  })

  it('builds a shareable player workspace URL', () => {
    expect(explorerPlayerHref('R000123456')).toBe('?mode=player&player=R000123456')
  })
})
