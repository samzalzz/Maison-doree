'use client'

import React, { useState, useCallback } from 'react'
import {
  X,
  Copy,
  Check,
  ArrowLeftRight,
  Bell,
  Box,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react'
import type {
  WorkflowActionResponse,
  WorkflowStep,
  ActionType,
  ActionStatus,
} from './workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionDetailModalProps {
  action: WorkflowActionResponse
  step: WorkflowStep
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ActionStatus,
  { label: string; bg: string; text: string; Icon: React.ElementType }
> = {
  COMPLETED: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  FAILED: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-700', Icon: XCircle },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-yellow-100', text: 'text-yellow-700', Icon: Loader2 },
  PENDING: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-600', Icon: Clock },
}

const ACTION_TYPE_CONFIG: Record<ActionType, { label: string; Icon: React.ElementType; color: string }> = {
  TRANSFER: { label: 'Transfer Stock', Icon: ArrowLeftRight, color: 'text-blue-600' },
  UPDATE_INVENTORY: { label: 'Update Inventory', Icon: Box, color: 'text-purple-600' },
  NOTIFY: { label: 'Send Notification', Icon: Bell, color: 'text-amber-600' },
  EMAIL: { label: 'Send Email', Icon: Mail, color: 'text-teal-600' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(createdAt: string, executedAt: string | null): string {
  if (!executedAt) return '—'
  const ms = new Date(executedAt).getTime() - new Date(createdAt).getTime()
  if (ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}m`
}

// ---------------------------------------------------------------------------
// JSON Block sub-component
// ---------------------------------------------------------------------------

interface JsonBlockProps {
  label: string
  value: Record<string, unknown> | null | undefined
  testId?: string
}

function JsonBlock({ label, value, testId }: JsonBlockProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-2 hover:text-gray-800 transition-colors"
        aria-expanded={!collapsed}
      >
        <span
          className={`inline-block w-3 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        >
          ▶
        </span>
        {label}
      </button>
      {!collapsed && (
        <pre
          className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed"
          data-testid={testId}
        >
          {value !== null && value !== undefined
            ? JSON.stringify(value, null, 2)
            : 'No data available.'}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionDetailModal({
  action,
  step,
  isOpen,
  onClose,
}: ActionDetailModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const text = action.result
      ? JSON.stringify(action.result, null, 2)
      : 'No result available.'
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text in a temporary textarea
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [action.result])

  if (!isOpen) return null

  const status = action.status in STATUS_CONFIG ? action.status : 'PENDING'
  const statusCfg = STATUS_CONFIG[status]
  const actionType = step.actionType
  const actionCfg =
    actionType && actionType in ACTION_TYPE_CONFIG
      ? ACTION_TYPE_CONFIG[actionType as ActionType]
      : null

  const StatusIcon = statusCfg.Icon
  const isSpinning = status === 'IN_PROGRESS'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="action-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Action execution detail"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {actionCfg && (
                <actionCfg.Icon
                  className={`w-5 h-5 flex-shrink-0 ${actionCfg.color}`}
                />
              )}
              <h3 className="text-base font-bold text-gray-900">
                {actionCfg ? actionCfg.label : 'Action Execution'}
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                data-testid="modal-status-badge"
              >
                <StatusIcon className={`w-3 h-3 ${isSpinning ? 'animate-spin' : ''}`} />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Step {step.stepNumber}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              aria-label="Copy result JSON"
              data-testid="copy-result-btn"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              aria-label="Close modal"
              data-testid="action-detail-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Created</p>
              <p className="text-xs text-gray-700" data-testid="meta-created-at">
                {formatTimestamp(action.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Executed</p>
              <p className="text-xs text-gray-700" data-testid="meta-executed-at">
                {formatTimestamp(action.executedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="text-xs text-gray-700" data-testid="meta-duration">
                {formatDuration(action.createdAt, action.executedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Action Type</p>
              <p className="text-xs text-gray-700">{step.actionType ?? '—'}</p>
            </div>
          </div>

          {/* Error message */}
          {action.status === 'FAILED' && action.errorMessage && (
            <div
              className="rounded-lg bg-red-50 border border-red-200 p-3"
              data-testid="error-message-block"
            >
              <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
              <p className="text-xs text-red-600 font-mono break-all">
                {action.errorMessage}
              </p>
            </div>
          )}

          {/* Request / payload */}
          <JsonBlock
            label="Request (Action Payload)"
            value={step.actionPayload ?? {}}
            testId="json-request"
          />

          {/* Response / result */}
          <JsonBlock
            label="Response (Result)"
            value={action.result}
            testId="json-response"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400 font-mono truncate">
            Execution ID: {action.workflowExecutionId}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
