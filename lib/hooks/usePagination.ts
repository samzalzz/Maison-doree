'use client'

import { useState, useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePaginationOptions<T> {
  /** Number of items per page. Defaults to 20. */
  pageSize?: number
  /**
   * Async function that fetches one page of data.
   * Receives the opaque cursor (null means "first page") and the page size.
   * Must resolve to `{ items, nextCursor }`.
   */
  fetchFn: (
    cursor: string | null,
    limit: number,
  ) => Promise<{ items: T[]; nextCursor: string | null }>
}

export interface UsePaginationResult<T> {
  /** All accumulated items across all fetched pages. */
  items: T[]
  /** True while a fetch is in flight. */
  isLoading: boolean
  /** True when there is at least one more page available. */
  hasMore: boolean
  /** Fetch the next page and append its items to `items`. */
  loadMore: () => void
  /** Clear all items and re-fetch the first page. */
  reset: () => void
  /** Opaque cursor for the next page (null when on first page or no more). */
  nextCursor: string | null
  /** Non-null error message if the last fetch failed. */
  error: string | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePagination<T>(
  options: UsePaginationOptions<T>,
): UsePaginationResult<T> {
  const { pageSize = 20, fetchFn } = options

  const [items, setItems] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Prevent concurrent fetches
  const isFetchingRef = useRef(false)

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchFn(cursor, pageSize)

        setItems((prev) => (append ? [...prev, ...result.items] : result.items))
        setNextCursor(result.nextCursor)
        setHasMore(result.nextCursor !== null)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to fetch data.'
        setError(message)
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [fetchFn, pageSize],
  )

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return
    fetchPage(nextCursor, true)
  }, [hasMore, isLoading, nextCursor, fetchPage])

  const reset = useCallback(() => {
    setItems([])
    setNextCursor(null)
    setHasMore(true)
    setError(null)
    fetchPage(null, false)
  }, [fetchPage])

  return { items, isLoading, hasMore, loadMore, reset, nextCursor, error }
}
