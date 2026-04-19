'use client'

import React from 'react'
import { Box, ArrowRight, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import type { WorkflowActionResponse, WorkflowStep, InventoryResult } from '../workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InventoryActionCardProps {
  action: WorkflowActionResponse
  step: WorkflowStep
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryActionCard({ action, step }: InventoryActionCardProps) {
  const payload = step.actionPayload ?? {}
  const labId = (payload.labId as string) ?? '—'
  const materialId = (payload.materialId as string) ?? '—'
  const reason = (payload.reason as string) ?? null

  if (action.status === 'FAILED') {
    return (
      <div
        className="rounded-lg bg-red-50 border border-red-200 p-4"
        data-testid="inventory-card-failed"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Inventory Update Failed</p>
            <p className="text-xs text-red-600 break-words">
              {action.errorMessage ?? 'An error occurred during the inventory update.'}
            </p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-500">
          <span className="font-mono">{labId}</span>
          {materialId !== '—' && (
            <span className="ml-2 text-red-400">· Material: {materialId}</span>
          )}
        </div>
      </div>
    )
  }

  const result = (action.result ?? {}) as Partial<InventoryResult>
  const oldQuantity = result.oldQuantity ?? (payload.quantity as number) ?? null
  const newQuantity = result.newQuantity ?? null
  const resultReason = result.reason ?? reason

  const delta =
    oldQuantity !== null && newQuantity !== null ? newQuantity - oldQuantity : null
  const isIncrease = delta !== null && delta > 0

  return (
    <div
      className="rounded-lg bg-purple-50 border border-purple-200 p-4 space-y-3"
      data-testid="inventory-card-completed"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Box className="w-4 h-4 text-purple-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-purple-800">
          Inventory Updated
        </span>
        {delta !== null && (
          <span
            className={`ml-auto inline-flex items-center gap-0.5 text-xs font-semibold ${
              isIncrease ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isIncrease ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {isIncrease ? '+' : ''}
            {delta}
          </span>
        )}
      </div>

      {/* Lab + quantity change */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 mb-0.5">Lab</p>
          <p className="font-semibold text-gray-800 truncate" data-testid="inventory-lab-id">
            {labId}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-gray-600">
          <span className="font-mono" data-testid="inventory-old-quantity">
            {oldQuantity ?? '?'}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          <span
            className={`font-mono font-semibold ${isIncrease ? 'text-green-700' : 'text-red-700'}`}
            data-testid="inventory-new-quantity"
          >
            {newQuantity ?? '?'}
          </span>
        </div>
      </div>

      {/* Material + reason */}
      <div className="pt-2 border-t border-purple-200 space-y-1 text-xs text-gray-500">
        {materialId !== '—' && (
          <p>
            Material ID:{' '}
            <span className="font-mono text-gray-700" data-testid="inventory-material-id">
              {materialId}
            </span>
          </p>
        )}
        {resultReason && (
          <p data-testid="inventory-reason">
            Reason: <span className="text-gray-700">{resultReason}</span>
          </p>
        )}
      </div>
    </div>
  )
}
