'use client'

import React from 'react'
import { LoyaltyCard as LoyaltyCardType } from '@/lib/types'

interface LoyaltyCardProps {
  card: LoyaltyCardType
}

// Tier thresholds
const TIER_THRESHOLDS = {
  BRONZE: { min: 0, max: 99 },
  SILVER: { min: 100, max: 499 },
  GOLD: { min: 500, max: Infinity },
}

const TIER_COLORS = {
  BRONZE: {
    bg: 'from-amber-100 to-yellow-50',
    border: 'border-amber-400',
    text: 'text-amber-900',
    badge: 'bg-amber-500',
    progress: 'bg-amber-500',
  },
  SILVER: {
    bg: 'from-slate-100 to-gray-50',
    border: 'border-slate-400',
    text: 'text-slate-900',
    badge: 'bg-slate-500',
    progress: 'bg-slate-500',
  },
  GOLD: {
    bg: 'from-yellow-100 to-amber-50',
    border: 'border-yellow-400',
    text: 'text-yellow-900',
    badge: 'bg-yellow-500',
    progress: 'bg-yellow-500',
  },
}

export default function LoyaltyCard({ card }: LoyaltyCardProps) {
  const tier = card.tier as keyof typeof TIER_COLORS
  const colors = TIER_COLORS[tier]
  const threshold = TIER_THRESHOLDS[tier]

  // Calculate progress to next tier
  let nextTierSpent = 0
  let nextTierName = 'GOLD'
  let progressPercentage = 100

  if (tier === 'BRONZE') {
    nextTierName = 'SILVER'
    nextTierSpent = TIER_THRESHOLDS.SILVER.min - card.totalSpent
    const tierRange =
      TIER_THRESHOLDS.SILVER.min - TIER_THRESHOLDS.BRONZE.min
    const currentProgress = card.totalSpent - TIER_THRESHOLDS.BRONZE.min
    progressPercentage = (currentProgress / tierRange) * 100
  } else if (tier === 'SILVER') {
    nextTierName = 'GOLD'
    nextTierSpent = TIER_THRESHOLDS.GOLD.min - card.totalSpent
    const tierRange =
      TIER_THRESHOLDS.GOLD.min - TIER_THRESHOLDS.SILVER.min
    const currentProgress = card.totalSpent - TIER_THRESHOLDS.SILVER.min
    progressPercentage = (currentProgress / tierRange) * 100
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br ${colors.bg} border-2 ${colors.border} p-8`}
    >
      {/* Card Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx="20" cy="20" r="15" fill="currentColor" />
          <circle cx="80" cy="70" r="20" fill="currentColor" />
          <circle cx="70" cy="20" r="10" fill="currentColor" />
        </svg>
      </div>

      <div className="relative z-10">
        {/* Header with Tier Badge */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className={`text-3xl font-bold ${colors.text} mb-2`}>
              Loyalty Card
            </h2>
            <p className="text-gray-600">Maison Dorée</p>
          </div>
          <div className="text-right">
            <div
              className={`${colors.badge} text-white px-6 py-2 rounded-full font-bold text-lg inline-block`}
            >
              {tier}
            </div>
          </div>
        </div>

        {/* Points Display */}
        <div className="bg-white/50 rounded-xl p-6 mb-8 backdrop-blur-sm">
          <p className="text-gray-600 text-sm font-semibold uppercase tracking-wide mb-2">
            Current Points
          </p>
          <p className={`text-5xl font-bold ${colors.text}`}>
            {card.points}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {card.points} MAD earned from purchases
          </p>
        </div>

        {/* Total Spent */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/50 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">
              Total Spent
            </p>
            <p className={`text-2xl font-bold ${colors.text}`}>
              {card.totalSpent.toFixed(2)} MAD
            </p>
          </div>
          <div className="bg-white/50 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide mb-1">
              Tier Rank
            </p>
            <p className={`text-2xl font-bold ${colors.text}`}>
              #{
                tier === 'BRONZE'
                  ? 1
                  : tier === 'SILVER'
                    ? 2
                    : 3
              }
            </p>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {tier !== 'GOLD' && (
          <div className="bg-white/50 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-600 text-sm font-semibold">
                Progress to {nextTierName}
              </p>
              <p className="text-gray-600 text-sm font-semibold">
                {nextTierSpent > 0
                  ? `${nextTierSpent.toFixed(2)} MAD away`
                  : 'Unlocked!'}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`${colors.progress} h-full rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {progressPercentage.toFixed(0)}% of the way to {nextTierName}
            </p>
          </div>
        )}

        {/* Tier Benefits */}
        <div className="mt-8 pt-6 border-t border-white/20">
          <h3 className={`text-lg font-bold ${colors.text} mb-4`}>
            {tier} Tier Benefits
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            {tier === 'BRONZE' && (
              <>
                <li className="flex items-center">
                  <span className="text-amber-600 mr-3 font-bold">•</span>
                  1 point per MAD spent
                </li>
                <li className="flex items-center">
                  <span className="text-amber-600 mr-3 font-bold">•</span>
                  Access to exclusive deals
                </li>
                <li className="flex items-center">
                  <span className="text-amber-600 mr-3 font-bold">•</span>
                  Birthday discount coming
                </li>
              </>
            )}
            {tier === 'SILVER' && (
              <>
                <li className="flex items-center">
                  <span className="text-slate-600 mr-3 font-bold">•</span>
                  1.25 points per MAD spent
                </li>
                <li className="flex items-center">
                  <span className="text-slate-600 mr-3 font-bold">•</span>
                  Priority customer support
                </li>
                <li className="flex items-center">
                  <span className="text-slate-600 mr-3 font-bold">•</span>
                  10% birthday discount
                </li>
                <li className="flex items-center">
                  <span className="text-slate-600 mr-3 font-bold">•</span>
                  Early access to new products
                </li>
              </>
            )}
            {tier === 'GOLD' && (
              <>
                <li className="flex items-center">
                  <span className="text-yellow-600 mr-3 font-bold">•</span>
                  1.5 points per MAD spent
                </li>
                <li className="flex items-center">
                  <span className="text-yellow-600 mr-3 font-bold">•</span>
                  24/7 VIP support
                </li>
                <li className="flex items-center">
                  <span className="text-yellow-600 mr-3 font-bold">•</span>
                  15% birthday discount
                </li>
                <li className="flex items-center">
                  <span className="text-yellow-600 mr-3 font-bold">•</span>
                  Exclusive invitation-only events
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
