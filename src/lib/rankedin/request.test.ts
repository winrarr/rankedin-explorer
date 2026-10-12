import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const jsonResponse = (value: unknown, status = 200, headers?: HeadersInit) => new Response(
  JSON.stringify(value),
  { status, headers },
)

describe('Rankedin request lifecycle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('cancels a request during retry backoff without issuing another fetch', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { request } = await import('./request')
    const controller = new AbortController()
    const pending = request('/cancel-during-retry', controller.signal)

    await vi.advanceTimersByTimeAsync(0)
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a transient server failure with backoff', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { request } = await import('./request')
    const pending = request<{ ok: boolean }>('/retry-server-failure')

    await vi.advanceTimersByTimeAsync(499)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('honors Retry-After for 429 responses and pauses requests waiting in the queue', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/limited') && fetchMock.mock.calls.filter(([call]) => String(call).endsWith('/limited')).length === 1) {
        return Promise.resolve(jsonResponse({}, 429, { 'Retry-After': '2' }))
      }
      return Promise.resolve(jsonResponse({ url }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('./request')
    const limited = request<{ url: string }>('/limited')

    await vi.advanceTimersByTimeAsync(0)
    const queued = request<{ url: string }>('/queued-after-rate-limit')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(Promise.all([limited, queued])).resolves.toEqual([
      { url: 'https://api.rankedin.com/v1/limited' },
      { url: 'https://api.rankedin.com/v1/queued-after-rate-limit' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('deduplicates concurrent requests and caches successful responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ value: 42 }))
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('./request')

    await expect(Promise.all([
      request<{ value: number }>('/cached-result'),
      request<{ value: number }>('/cached-result'),
    ])).resolves.toEqual([{ value: 42 }, { value: 42 }])
    await expect(request<{ value: number }>('/cached-result')).resolves.toEqual({ value: 42 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('evicts a failed cached request so a later call can retry it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ recovered: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { request } = await import('./request')

    await expect(request('/failed-cache-entry')).rejects.toThrow('Rankedin returned 404')
    await expect(request('/failed-cache-entry')).resolves.toEqual({ recovered: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
