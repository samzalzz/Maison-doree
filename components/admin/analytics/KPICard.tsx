'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/Skeleton'

interface KPICardProps {
  label: string
  value: string | number
  /** Optional sub-label under the value */
  subLabel?: string
  /** Positive = improvement, Negative = decline (shown as coloured badge) */
  trend?: number
  /** Icon element displayed in top-left */
  icon?: React.ReactNode
  /** Whether to show skeleton state */
  isLoading?: boolean
}

function TrendBadge({ value }: { value: number }) {
  const isPositive = value >= 0
  const color = isPositive ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
  const arrow = isPositive ? '▲' : '▼'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function KPICard({
  label,
  value,
  subLabel,
  trend,
  icon,
  isLoading = false,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
      {/* Header row: icon + trend */}
      <div className="flex items-center justify-between">
        {icon ? (
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">{icon}</div>
        ) : (
          <div />
        )}
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>

      {/* Main value */}
      <p className="text-3xl font-bold text-gray-900 mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      {/* Label */}
      <p className="text-sm font-medium text-gray-500">{label}</p>

      {/* Optional sub-label */}
      {subLabel && <p className="text-xs text-gray-400">{subLabel}</p>}
    </div>
  )
}
