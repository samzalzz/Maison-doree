'use client'

import React, { useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationControlsProps {
  /** Whether a previous page is available. */
  hasPrevious: boolean
  /** Whether a next page is available. */
  hasNext: boolean
  /** Navigate to the previous page. */
  onPrevious: () => void
  /** Navigate to the next page. */
  onNext: () => void
  /** 1-based current page number, shown in the middle indicator. */
  currentPage: number
  /** Optional total page count; when provided shows "Page X of Y". */
  totalPages?: number
  /** Extra class names for the root element. */
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaginationControls({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  currentPage,
  totalPages,
  className = '',
}: PaginationControlsProps) {
  // Keyboard navigation: left arrow = previous, right arrow = next
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'ArrowLeft' && hasPrevious) {
        onPrevious()
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext()
      }
    },
    [hasPrevious, hasNext, onPrevious, onNext],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const pageLabel =
    totalPages != null
      ? `Page ${currentPage} of ${totalPages}`
      : `Page ${currentPage}`

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={`flex items-center justify-center gap-3 ${className}`}
    >
      <button
        onClick={onPrevious}
        disabled={!hasPrevious}
        aria-label="Go to previous page"
        aria-disabled={!hasPrevious}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        Previous
      </button>

      <span
        aria-live="polite"
        aria-atomic="true"
        className="text-sm text-gray-600 font-medium px-2 select-none"
      >
        {pageLabel}
      </span>

      <button
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Go to next page"
        aria-disabled={!hasNext}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
      >
        Next
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  )
}
