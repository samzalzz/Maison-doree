'use client'

import React from 'react'

type Tier = 'BRONZE' | 'SILVER' | 'GOLD'

interface TierBadgeProps {
  tier: Tier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const TIER_STYLES: Record<Tier, { bg: string; text: string; ring: string; label: string }> = {
  BRONZE: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    ring: 'ring-amber-400',
    label: 'Bronze',
  },
  SILVER: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-400',
    label: 'Silver',
  },
  GOLD: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    ring: 'ring-yellow-400',
    label: 'Gold',
  },
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-5 py-2 text-base',
}

const ICON_SIZE = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

function TierIcon({ tier, className }: { tier: Tier; className?: string }) {
  if (tier === 'GOLD') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    )
  }
  if (tier === 'SILVER') {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    )
  }
  // BRONZE
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  )
}

export function TierBadge({ tier, size = 'md', showLabel = true }: TierBadgeProps) {
  const styles = TIER_STYLES[tier]
  const sizeClass = SIZE_CLASSES[size]
  const iconClass = ICON_SIZE[size]

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${styles.bg} ${styles.text} ${styles.ring} ${sizeClass}`}
      aria-label={`${styles.label} tier`}
    >
      <TierIcon tier={tier} className={iconClass} />
      {showLabel && styles.label}
    </span>
  )
}
