'use client'

import React from 'react'

type Tier = 'BRONZE' | 'SILVER' | 'GOLD'

interface TierProgressBarProps {
  currentTier: Tier
  nextTier: string | null
  progressPercent: number
  spendToNextTier: number | null
  totalSpent: number
}

const TIER_TRACK_COLOR: Record<Tier, string> = {
  BRONZE: 'bg-amber-500',
  SILVER: 'bg-slate-500',
  GOLD: 'bg-yellow-500',
}

const TIER_TRACK_BG: Record<Tier, string> = {
  BRONZE: 'bg-amber-100',
  SILVER: 'bg-slate-100',
  GOLD: 'bg-yellow-100',
}

export function TierProgressBar({
  currentTier,
  nextTier,
  progressPercent,
  spendToNextTier,
  totalSpent,
}: TierProgressBarProps) {
  if (currentTier === 'GOLD') {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-yellow-800">
            Maximum tier reached
          </span>
          <span className="text-xs text-yellow-600">
            {totalSpent.toFixed(2)} MAD spent
          </span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-yellow-100">
          <div className="h-full w-full rounded-full bg-yellow-400" />
        </div>
        <p className="mt-1 text-xs text-yellow-600">You have reached Gold status</p>
      </div>
    )
  }

  const clampedPercent = Math.min(100, Math.max(0, progressPercent))

  return (
    <div className={`rounded-xl border p-4 ${TIER_TRACK_BG[currentTier]} border-opacity-50`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-800">
          Progress to{' '}
          <span className="capitalize font-bold">{nextTier}</span>
        </span>
        <span className="text-xs text-gray-500">
          {clampedPercent}%
        </span>
      </div>

      {/* Track */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${TIER_TRACK_COLOR[currentTier]}`}
          style={{ width: `${clampedPercent}%` }}
          role="progressbar"
          aria-valuenow={clampedPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500">
        <span>{totalSpent.toFixed(2)} MAD spent</span>
        {spendToNextTier !== null && spendToNextTier > 0 ? (
          <span>
            <strong>{spendToNextTier.toFixed(2)} MAD</strong> to {nextTier}
          </span>
        ) : (
          <span className="text-green-600 font-medium">Threshold reached!</span>
        )}
      </div>
    </div>
  )
}
