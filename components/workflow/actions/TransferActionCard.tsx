'use client'

import React from 'react'
import { ArrowRight, ArrowLeftRight, AlertCircle } from 'lucide-react'
import type { WorkflowActionResponse, WorkflowStep, TransferResult } from '../workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransferActionCardProps {
  action: WorkflowActionResponse
  step: WorkflowStep
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransferActionCard({ action, step }: TransferActionCardProps) {
  const payload = step.actionPayload ?? {}
  const sourceLabId = (payload.sourceLabId as string) ?? '—'
  const destLabId = (payload.destLabId as string) ?? '—'
  const payloadQty = (payload.quantity as number) ?? null

  if (action.status === 'FAILED') {
    return (
      <div
        className="rounded-lg bg-red-50 border border-red-200 p-4"
        data-testid="transfer-card-failed"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Transfer Failed</p>
            <p className="text-xs text-red-600 break-words">
              {action.errorMessage ?? 'An error occurred during the transfer.'}
            </p>
          </div>
        </div>
        {/* Show intended transfer details */}
        {payloadQty !== null && (
          <div className="mt-3 pt-3 border-t border-red-200 flex items-center gap-2 text-xs text-red-500">
            <span className="font-mono">{sourceLabId}</span>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <span className="font-mono">{destLabId}</span>
            <span className="ml-auto">Qty: {payloadQty}</span>
          </div>
        )}
      </div>
    )
  }

  const result = (action.result ?? {}) as Partial<TransferResult>
  const transferredQty: number | string = result.transferredQuantity ?? payloadQty ?? '?'
  const sourceStockBefore: number | null = result.sourceStock !== undefined
    ? result.sourceStock + (result.transferredQuantity ?? 0)
    : null
  const sourceStockAfter: number | null = result.sourceStock ?? null
  const destStockBefore: number | null = result.destStock !== undefined
    ? result.destStock - (result.transferredQuantity ?? 0)
    : null
  const destStockAfter: number | null = result.destStock ?? null

  return (
    <div
      className="rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3"
      data-testid="transfer-card-completed"
    >
      {/* Transfer direction header */}
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-blue-800">
          Transferred {transferredQty} units
        </span>
      </div>

      {/* From → To row */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 mb-0.5">Source</p>
          <p className="font-semibold text-gray-800 truncate" data-testid="transfer-source-lab">
            {sourceLabId}
          </p>
          {sourceStockBefore !== null && sourceStockAfter !== null && (
            <p className="text-gray-500 mt-0.5">
              {sourceStockBefore} → {sourceStockAfter}
            </p>
          )}
        </div>

        <ArrowRight className="w-5 h-5 text-blue-400 flex-shrink-0" />

        <div className="flex-1 min-w-0 text-right">
          <p className="text-gray-500 mb-0.5">Destination</p>
          <p className="font-semibold text-gray-800 truncate" data-testid="transfer-dest-lab">
            {destLabId}
          </p>
          {destStockBefore !== null && destStockAfter !== null && (
            <p className="text-gray-500 mt-0.5">
              {destStockBefore} → {destStockAfter}
            </p>
          )}
        </div>
      </div>

      {/* Material row */}
      {typeof payload.materialId === 'string' && payload.materialId && (
        <div className="pt-2 border-t border-blue-200">
          <p className="text-xs text-gray-500">
            Material ID:{' '}
            <span className="font-mono text-gray-700" data-testid="transfer-material-id">
              {payload.materialId}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
