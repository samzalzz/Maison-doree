'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadMoreButtonProps {
  /** Called when the user clicks the button to load more items. */
  onClick: () => void
  /** When true the button is disabled and shows a spinner. */
  isLoading: boolean
  /** Optional label override. Defaults to "Load More". */
  label?: string
  /** Extra class names for the root element. */
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoadMoreButton({
  onClick,
  isLoading,
  label = 'Load More',
  className = '',
}: LoadMoreButtonProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <button
        onClick={onClick}
        disabled={isLoading}
        aria-label={isLoading ? 'Loading more items…' : label}
        aria-busy={isLoading}
        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading…
          </>
        ) : (
          label
        )}
      </button>
    </div>
  )
}
