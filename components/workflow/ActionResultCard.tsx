'use client'

import React from 'react'
import {
  ArrowLeftRight,
  Bell,
  Box,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import type { WorkflowActionResponse, WorkflowStep, ActionType, ActionStatus } from './workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionResultCardProps {
  action: WorkflowActionResponse
  step?: WorkflowStep
  onViewDetail?: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ActionStatus,
  { label: string; border: string; bg: string; text: string; Icon: React.ElementType }
> = {
  COMPLETED: {
    label: 'Completed',
    border: 'border-l-green-500',
    bg: 'bg-green-50',
    text: 'text-green-700',
    Icon: CheckCircle2,
  },
  FAILED: {
    label: 'Failed',
    border: 'border-l-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    Icon: XCircle,
  },
  IN_PROGRESS: {
    label: 'In Progress',
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    Icon: Loader2,
  },
  PENDING: {
    label: 'Pending',
    border: 'border-l-gray-400',
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    Icon: Clock,
  },
}

const ACTION_TYPE_CONFIG: Record<
  ActionType,
  { label: string; Icon: React.ElementType; color: string }
> = {
  TRANSFER: { label: 'Transfer Stock', Icon: ArrowLeftRight, color: 'text-blue-600' },
  UPDATE_INVENTORY: { label: 'Update Inventory', Icon: Box, color: 'text-purple-600' },
  NOTIFY: { label: 'Send Notification', Icon: Bell, color: 'text-amber-600' },
  EMAIL: { label: 'Send Email', Icon: Mail, color: 'text-teal-600' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(createdAt: string, executedAt: string | null): string {
  if (!executedAt) return '—'
  const ms = new Date(executedAt).getTime() - new Date(createdAt).getTime()
  if (ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}m`
}

function buildResultSummary(
  action: WorkflowActionResponse,
  step: WorkflowStep | undefined,
): string {
  if (action.status === 'FAILED') {
    return action.errorMessage ?? 'Action failed.'
  }
  if (action.status === 'PENDING') return 'Waiting to execute…'
  if (action.status === 'IN_PROGRESS') return 'Executing…'

  const payload = step?.actionPayload ?? {}
  const result = action.result ?? {}
  const actionType = step?.actionType

  if (actionType === 'TRANSFER') {
    const qty = (result.transferredQuantity as number) ?? (payload.quantity as number) ?? '?'
    const src = (payload.sourceLabId as string) ?? 'Source'
    const dst = (payload.destLabId as string) ?? 'Dest'
    return `Transferred ${qty} from ${src} to ${dst}`
  }
  if (actionType === 'UPDATE_INVENTORY') {
    const lab = (payload.labId as string) ?? 'Lab'
    const oldQty = (result.oldQuantity as number) ?? '?'
    const newQty = (result.newQuantity as number) ?? '?'
    return `Updated ${lab} stock: ${oldQty} → ${newQty}`
  }
  if (actionType === 'NOTIFY') {
    const channels = Array.isArray(payload.channels)
      ? (payload.channels as string[]).join(', ')
      : 'channels'
    return `Notification sent to ${channels}`
  }
  if (actionType === 'EMAIL') {
    const to = (result.to as string) ?? (payload.to as string) ?? 'recipient'
    return `Email sent to ${to}`
  }
  return action.result ? 'Action completed.' : 'No result available.'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionResultCard({
  action,
  step,
  onViewDetail,
}: ActionResultCardProps) {
  const status = action.status in STATUS_CONFIG ? action.status : 'PENDING'
  const statusCfg = STATUS_CONFIG[status]
  const actionType = step?.actionType ?? null
  const actionCfg = actionType && actionType in ACTION_TYPE_CONFIG
    ? ACTION_TYPE_CONFIG[actionType as ActionType]
    : null

  const duration = formatDuration(action.createdAt, action.executedAt)
  const summary = buildResultSummary(action, step)
  const stepNumber = step?.stepNumber ?? null

  const StatusIcon = statusCfg.Icon
  const isSpinning = status === 'IN_PROGRESS'

  return (
    <button
      type="button"
      onClick={onViewDetail}
      disabled={!onViewDetail}
      data-testid={`action-result-card-${action.id}`}
      className={[
        'group relative w-full text-left bg-white rounded-xl border border-gray-200 border-l-4',
        statusCfg.border,
        'shadow-sm px-4 py-3 transition-all duration-150',
        onViewDetail
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
          : 'cursor-default',
      ].join(' ')}
    >
      {/* Top row: status badge + step number */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
          data-testid={`status-badge-${action.id}`}
        >
          <StatusIcon
            className={`w-3 h-3 ${isSpinning ? 'animate-spin' : ''}`}
          />
          {statusCfg.label}
        </span>

        <div className="flex items-center gap-1.5">
          {stepNumber !== null && (
            <span className="text-xs text-gray-400 font-mono">
              Step {stepNumber}
            </span>
          )}
          {onViewDetail && (
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          )}
        </div>
      </div>

      {/* Middle row: action type icon + label */}
      <div className="flex items-center gap-2 mb-2">
        {actionCfg ? (
          <>
            <actionCfg.Icon className={`w-4 h-4 flex-shrink-0 ${actionCfg.color}`} />
            <span className="text-sm font-semibold text-gray-800 leading-none">
              {actionCfg.label}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold text-gray-500">Unknown Action</span>
        )}
        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
          {duration}
        </span>
      </div>

      {/* Bottom row: result summary */}
      <p
        className={`text-xs leading-relaxed truncate ${
          action.status === 'FAILED' ? 'text-red-600' : 'text-gray-500'
        }`}
        data-testid={`result-summary-${action.id}`}
        title={summary}
      >
        {summary}
      </p>
    </button>
  )
}
