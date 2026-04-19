'use client'

import React, { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeftRight,
  Bell,
  Box,
  Mail,
} from 'lucide-react'
import type {
  WorkflowActionResponse,
  WorkflowStep,
  ActionStatus,
  ActionType,
} from './workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionTimelineProps {
  actions: WorkflowActionResponse[]
  steps: WorkflowStep[]
  onActionClick?: (action: WorkflowActionResponse, step: WorkflowStep) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<
  ActionStatus,
  { bg: string; border: string; ring: string; Icon: React.ElementType }
> = {
  COMPLETED: {
    bg: 'bg-green-500',
    border: 'border-green-500',
    ring: 'ring-green-200',
    Icon: CheckCircle2,
  },
  FAILED: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    ring: 'ring-red-200',
    Icon: XCircle,
  },
  IN_PROGRESS: {
    bg: 'bg-yellow-400',
    border: 'border-yellow-400',
    ring: 'ring-yellow-200',
    Icon: Loader2,
  },
  PENDING: {
    bg: 'bg-gray-300',
    border: 'border-gray-300',
    ring: 'ring-gray-200',
    Icon: Clock,
  },
}

const ACTION_TYPE_ICON: Record<ActionType, React.ElementType> = {
  TRANSFER: ArrowLeftRight,
  UPDATE_INVENTORY: Box,
  NOTIFY: Bell,
  EMAIL: Mail,
}

const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  TRANSFER: 'Transfer Stock',
  UPDATE_INVENTORY: 'Update Inventory',
  NOTIFY: 'Send Notification',
  EMAIL: 'Send Email',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(createdAt: string, executedAt: string | null): string {
  if (!executedAt) return ''
  const ms = new Date(executedAt).getTime() - new Date(createdAt).getTime()
  if (ms < 0) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}m`
}

function buildBriefSummary(action: WorkflowActionResponse, step: WorkflowStep): string {
  if (action.status === 'FAILED') return action.errorMessage ?? 'Failed'
  if (action.status === 'PENDING') return 'Pending…'
  if (action.status === 'IN_PROGRESS') return 'Running…'

  const payload = step.actionPayload ?? {}
  const result = action.result ?? {}
  const t = step.actionType

  if (t === 'TRANSFER') {
    const qty = (result.transferredQuantity as number) ?? (payload.quantity as number) ?? '?'
    return `Transferred ${qty} units`
  }
  if (t === 'UPDATE_INVENTORY') {
    const n = (result as Record<string, unknown>).newQuantity ?? '?'
    return `Stock updated → ${n}`
  }
  if (t === 'NOTIFY') {
    const channels = Array.isArray(payload.channels)
      ? (payload.channels as string[]).join(', ')
      : 'channels'
    return `Sent to ${channels}`
  }
  if (t === 'EMAIL') {
    const to = (result as Record<string, unknown>).to ?? payload.to ?? 'recipient'
    return `Email → ${to as string}`
  }
  return 'Completed'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionTimeline({
  actions,
  steps,
  onActionClick,
}: ActionTimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Build a map from stepId to step for O(1) lookups
  const stepMap = React.useMemo(() => {
    const m = new Map<string, WorkflowStep>()
    steps.forEach((s) => m.set(s.id, s))
    return m
  }, [steps])

  // Sort actions by createdAt ascending
  const sorted = React.useMemo(
    () => [...actions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [actions],
  )

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400" data-testid="timeline-empty">
        No actions recorded.
      </div>
    )
  }

  return (
    <div className="relative" data-testid="action-timeline">
      {/* Vertical connector line */}
      <div
        className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-200"
        aria-hidden="true"
      />

      <ol className="space-y-0">
        {sorted.map((action, idx) => {
          const step = stepMap.get(action.stepId)
          const status = action.status in STATUS_DOT ? action.status : 'PENDING'
          const dotCfg = STATUS_DOT[status]
          const isSpinning = status === 'IN_PROGRESS'
          const isLast = idx === sorted.length - 1
          const isHovered = hoveredId === action.id

          const actionType = step?.actionType
          const TypeIcon =
            actionType && actionType in ACTION_TYPE_ICON
              ? ACTION_TYPE_ICON[actionType as ActionType]
              : null
          const typeLabel =
            actionType && actionType in ACTION_TYPE_LABEL
              ? ACTION_TYPE_LABEL[actionType as ActionType]
              : 'Unknown Action'

          const brief = step ? buildBriefSummary(action, step) : ''
          const connectorDashed = action.status === 'FAILED'

          return (
            <li
              key={action.id}
              className="relative pl-12 pb-6"
              data-testid={`timeline-item-${action.id}`}
            >
              {/* Connector line segment override (dashed for failed) */}
              {!isLast && connectorDashed && (
                <div
                  className="absolute left-[18px] top-6 bottom-0 w-0.5"
                  style={{
                    background:
                      'repeating-linear-gradient(to bottom, #fca5a5 0, #fca5a5 4px, transparent 4px, transparent 8px)',
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Status dot */}
              <button
                type="button"
                className={[
                  'absolute left-0 top-1 w-9 h-9 rounded-full flex items-center justify-center transition-all',
                  dotCfg.bg,
                  'ring-2',
                  dotCfg.ring,
                  onActionClick && step
                    ? 'cursor-pointer hover:scale-110 hover:shadow-md'
                    : 'cursor-default',
                  isHovered ? 'scale-110 shadow-md' : '',
                ].join(' ')}
                onClick={() => {
                  if (onActionClick && step) onActionClick(action, step)
                }}
                onMouseEnter={() => setHoveredId(action.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={`View details for ${typeLabel} - ${status}`}
                data-testid={`timeline-dot-${action.id}`}
              >
                <dotCfg.Icon
                  className={`w-4 h-4 text-white ${isSpinning ? 'animate-spin' : ''}`}
                />
              </button>

              {/* Content row */}
              <div
                className={[
                  'rounded-xl border bg-white p-3 transition-all duration-150 text-left',
                  onActionClick && step
                    ? 'cursor-pointer hover:shadow-md hover:border-gray-300'
                    : '',
                  isHovered ? 'shadow-md border-gray-300' : 'border-gray-200 shadow-sm',
                ].join(' ')}
                onClick={() => {
                  if (onActionClick && step) onActionClick(action, step)
                }}
                onMouseEnter={() => setHoveredId(action.id)}
                onMouseLeave={() => setHoveredId(null)}
                role={onActionClick && step ? 'button' : undefined}
                tabIndex={onActionClick && step ? 0 : undefined}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && onActionClick && step) {
                    onActionClick(action, step)
                  }
                }}
                data-testid={`timeline-content-${action.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {TypeIcon && (
                      <TypeIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-gray-800 truncate">
                      {typeLabel}
                    </span>
                    {step && (
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                        Step {step.stepNumber}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 text-right">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatTime(action.createdAt)}
                    </span>
                    {formatDuration(action.createdAt, action.executedAt) && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        ({formatDuration(action.createdAt, action.executedAt)})
                      </span>
                    )}
                  </div>
                </div>

                {brief && (
                  <p
                    className={`mt-1 text-xs truncate ${
                      action.status === 'FAILED' ? 'text-red-500' : 'text-gray-500'
                    }`}
                    data-testid={`timeline-brief-${action.id}`}
                  >
                    {brief}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
