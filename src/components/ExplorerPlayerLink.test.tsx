// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ExplorerPlayerLink } from './ExplorerPlayerLink'

describe('ExplorerPlayerLink', () => {
  afterEach(() => cleanup())

  it('opens the selected player workspace in a new tab', () => {
    render(<ExplorerPlayerLink rankedInId="R000123456" name="A player" />)

    const link = screen.getByRole('link', { name: 'Open A player in Rankedin Explorer in a new tab' })
    expect(link.getAttribute('href')).toBe('?mode=player&player=R000123456')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('keeps names plain when a public player ID is unavailable', () => {
    render(<ExplorerPlayerLink rankedInId={null} name="A player" />)

    expect(screen.getByText('A player').tagName).not.toBe('A')
  })
})
