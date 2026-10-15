// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('optional analytics', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.replaceChildren()
    delete window.goatcounter
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses a fixed page path and flushes generic lookup events after the script loads', async () => {
    const { initializeAnalytics, trackSuccessfulLookup } = await import('./analytics')
    initializeAnalytics('rankedin-explorer')
    trackSuccessfulLookup('tournament')
    trackSuccessfulLookup('player')
    trackSuccessfulLookup('league')

    const script = document.querySelector<HTMLScriptElement>('#goatcounter-script')
    expect(script?.src).toBe('https://gc.zgo.at/count.js')
    expect(script?.dataset.goatcounter).toBe('https://rankedin-explorer.goatcounter.com/count')
    expect(script?.dataset.goatcounterSettings).toBe('{"path":"/app"}')

    const count = vi.fn()
    window.goatcounter = { count }
    script?.dispatchEvent(new Event('load'))

    expect(count).toHaveBeenNthCalledWith(1, {
      path: 'lookup-tournament',
      title: 'Tournament lookup',
      event: true,
      no_session: true,
    })
    expect(count).toHaveBeenNthCalledWith(2, {
      path: 'lookup-player',
      title: 'Player lookup',
      event: true,
      no_session: true,
    })
    expect(count).toHaveBeenNthCalledWith(3, {
      path: 'lookup-lunar-league',
      title: 'Lunar League lookup',
      event: true,
      no_session: true,
    })
    expect(count).toHaveBeenCalledTimes(3)
  })

  it('does not load analytics or send events without a configured site code', async () => {
    const { initializeAnalytics, trackSuccessfulLookup } = await import('./analytics')
    initializeAnalytics('')
    trackSuccessfulLookup('player')

    expect(document.querySelector('#goatcounter-script')).toBeNull()
    expect(window.goatcounter).toBeUndefined()
  })
})
