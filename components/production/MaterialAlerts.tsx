'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

export interface MaterialAlert {
  materialId: string
  name: string
  type: string
  currentQuantity: number
  minThreshold: number
  unit: string
  labName: string
  daysUntilStockout?: number
}

interface MaterialAlertsProps {
  alerts: MaterialAlert[]
  isLoading: boolean
}

export default function MaterialAlerts({ alerts, isLoading }: MaterialAlertsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Alerts</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Alerts</h3>
        <p className="text-sm text-gray-500">All materials above minimum thresholds</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Alerts</h3>
      <div className="space-y-3">
        {alerts.map(alert => (
          <div
            key={`${alert.materialId}-${alert.labName}`}
            className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200"
          >
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-900">
                {alert.name}{' '}
                <span className="text-xs font-normal">({alert.type})</span>
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                {alert.labName}: {alert.currentQuantity}
                {alert.unit} / {alert.minThreshold}
                {alert.unit} min
              </p>
              {alert.daysUntilStockout !== undefined && alert.daysUntilStockout > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Stock depleted in ~{alert.daysUntilStockout} days
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
