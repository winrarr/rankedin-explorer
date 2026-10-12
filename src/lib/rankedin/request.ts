const API_BASE = 'https://api.rankedin.com/v1'
const responseCache = new Map<string, Promise<unknown>>()

type QueuedRequest = {
  cancelled: boolean
  run: () => void
}

const requestQueue: QueuedRequest[] = []
const MAX_ACTIVE_REQUESTS = 25
const MAX_RETRY_ATTEMPTS = 4
let activeRequestCount = 0
let requestNotBefore = 0
let requestDrainTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRequestDrain() {
  if (requestDrainTimer !== null) return
  const delay = Math.max(0, requestNotBefore - Date.now())
  requestDrainTimer = setTimeout(() => {
    requestDrainTimer = null
    drainRequestQueue()
  }, delay)
}

function drainRequestQueue() {
  if (Date.now() < requestNotBefore) {
    scheduleRequestDrain()
    return
  }

  while (activeRequestCount < MAX_ACTIVE_REQUESTS && requestQueue.length) {
    const nextRequest = requestQueue.shift()
    if (!nextRequest) return
    if (nextRequest.cancelled) continue
    activeRequestCount += 1
    nextRequest.run()
  }
}

function abortError() {
  const error = new Error('Request aborted.')
  error.name = 'AbortError'
  return error
}

function waitForRetry(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, delay)
    function cancel() {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', cancel)
      reject(abortError())
    }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(30000, Math.max(250, seconds * 1000))
    const timestamp = Date.parse(retryAfter)
    if (!Number.isNaN(timestamp)) return Math.min(30000, Math.max(250, timestamp - Date.now()))
  }
  return Math.min(12000, 500 * (2 ** attempt) + Math.round(Math.random() * 250))
}

function pauseRequestQueue(delay: number) {
  requestNotBefore = Math.max(requestNotBefore, Date.now() + delay)
  scheduleRequestDrain()
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function isRetryableError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) return false
  return error instanceof TypeError || (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError'))
}

async function fetchJson(path: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) throw abortError()

    const timeoutSignal = AbortSignal.timeout(12000)
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
    try {
      const response = await fetch(`${API_BASE}${path}`, { signal: requestSignal })
      if (response.ok) return response.json()

      if (!isRetryableStatus(response.status) || attempt === MAX_RETRY_ATTEMPTS - 1) {
        throw new Error(`Rankedin returned ${response.status} for ${path}`)
      }
      const delay = retryDelay(response, attempt)
      if (response.status === 429) pauseRequestQueue(delay)
      await waitForRetry(delay, signal)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Rankedin returned')) throw error
      if (!isRetryableError(error, signal) || attempt === MAX_RETRY_ATTEMPTS - 1) throw error
      await waitForRetry(Math.min(12000, 500 * (2 ** attempt) + Math.round(Math.random() * 250)), signal)
    }
  }

  throw new Error(`Rankedin request failed for ${path}`)
}

function enqueueRequest<T>(task: () => Promise<T>, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    let started = false
    const queuedRequest: QueuedRequest = {
      cancelled: false,
      run: async () => {
        started = true
        signal?.removeEventListener('abort', cancel)
        try {
          if (signal?.aborted) throw abortError()
          resolve(await task())
        } catch (error) {
          reject(error)
        } finally {
          activeRequestCount -= 1
          drainRequestQueue()
        }
      },
    }
    function cancel() {
      if (started) return
      queuedRequest.cancelled = true
      reject(abortError())
      drainRequestQueue()
    }

    if (signal?.aborted) {
      reject(abortError())
      return
    }
    signal?.addEventListener('abort', cancel, { once: true })
    requestQueue.push(queuedRequest)
    drainRequestQueue()
  })
}

export async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const cacheable = !signal
  const cached = cacheable ? responseCache.get(path) : undefined
  if (cached) return cached as Promise<T>

  const pending = enqueueRequest(() => fetchJson(path, signal), signal)
  if (cacheable) responseCache.set(path, pending)

  try {
    return await pending as T
  } catch (error) {
    if (cacheable) responseCache.delete(path)
    throw error
  }
}

export function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) search.set(key, String(value))
  })

  return `?${search.toString()}`
}
