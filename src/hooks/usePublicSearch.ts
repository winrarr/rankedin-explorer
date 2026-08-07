import { useEffect, useRef, useState } from 'react'

type SearchFunction<T> = (term: string, take?: number, signal?: AbortSignal) => Promise<T[]>

type PublicSearchOptions<T> = {
  enabled: boolean
  term: string
  label: string
  search: SearchFunction<T>
}

export function usePublicSearch<T>({ enabled, term, label, search }: PublicSearchOptions<T>) {
  const [results, setResults] = useState<T[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    const normalizedTerm = term.trim()
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setResults([])
    setError(null)
    setIsSearching(false)

    if (!enabled || normalizedTerm.length < 2) return

    const controller = new AbortController()
    let disposed = false
    let didTimeout = false
    let searchTimeout = 0
    const debounceTimeout = window.setTimeout(() => {
      setIsSearching(true)
      searchTimeout = window.setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, 8000)
      void search(normalizedTerm, 8, controller.signal)
        .then((nextResults) => {
          if (disposed || requestId !== requestRef.current) return
          setResults(nextResults)
        })
        .catch((caught) => {
          if (disposed || requestId !== requestRef.current) return
          if (caught instanceof Error && caught.name === 'AbortError') {
            if (didTimeout) setError(`${label} search timed out. Try again.`)
            return
          }
          setError(caught instanceof Error ? caught.message : `${label} search could not be completed.`)
        })
        .finally(() => {
          window.clearTimeout(searchTimeout)
          if (!disposed && requestId === requestRef.current) setIsSearching(false)
        })
    }, 280)

    return () => {
      disposed = true
      window.clearTimeout(debounceTimeout)
      window.clearTimeout(searchTimeout)
      controller.abort()
    }
  }, [enabled, label, search, term])

  return { results, isSearching, error }
}
