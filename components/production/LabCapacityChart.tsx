'use client'

import React from 'react'

export interface LabCapacityData {
  labId: string
  labName: string
  currentBatches: number
  maxCapacity: number
  utilizationPercent: number
}

interface LabCapacityChartProps {
  labs: LabCapacityData[]
}

function getBarColor(utilization: number): string {
  if (utilization >= 90) return 'bg-red-500'
  if (utilization >= 70) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getTextColor(utilization: number): string {
  if (utilization >= 90) return 'text-red-700'
  if (utilization >= 70) return 'text-yellow-700'
  return 'text-green-700'
}

export default function LabCapacityChart({ labs }: LabCapacityChartProps) {
  if (labs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No lab data available.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {labs.map((lab) => (
        <div key={lab.labId}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 truncate max-w-[160px]" title={lab.labName}>
              {lab.labName}
            </span>
            <span className={`text-sm font-semibold ${getTextColor(lab.utilizationPercent)}`}>
              {lab.currentBatches}/{lab.maxCapacity} ({lab.utilizationPercent}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${getBarColor(lab.utilizationPercent)}`}
              style={{ width: `${Math.min(100, lab.utilizationPercent)}%` }}
              role="progressbar"
              aria-valuenow={lab.utilizationPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${lab.labName} utilization: ${lab.utilizationPercent}%`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
