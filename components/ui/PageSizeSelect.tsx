'use client'

import React from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageSizeSelectProps {
  /** Currently selected page size. */
  value: number
  /** Called with the new page size when the user changes the selection. */
  onChange: (size: number) => void
  /** Allowed page-size options. Defaults to [10, 20, 50, 100]. */
  options?: number[]
  /** Extra class names for the root wrapper. */
  className?: string
}

const DEFAULT_OPTIONS: readonly number[] = [10, 20, 50, 100]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PageSizeSelect({
  value,
  onChange,
  options = DEFAULT_OPTIONS as number[],
  className = '',
}: PageSizeSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parsed = parseInt(e.target.value, 10)
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="page-size-select"
        className="text-sm text-gray-600 whitespace-nowrap"
      >
        Items per page:
      </label>
      <select
        id="page-size-select"
        value={value}
        onChange={handleChange}
        aria-label="Number of items per page"
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}
