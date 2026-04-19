'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, X, ChevronDown, ChevronRight } from 'lucide-react'
import ActionResultCard from '@/components/workflow/ActionResultCard'
import ActionDetailModal from '@/components/workflow/ActionDetailModal'
import ActionExecutionStats from '@/components/workflow/ActionExecutionStats'
import ActionTimeline from '@/components/workflow/ActionTimeline'
import type {
  WorkflowActionResponse,
  WorkflowStep,
  Workflow,
} from '@/components/workflow/workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed'

interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  errorMessage: string | null
  triggerData: Record<string, unknown>
  results: Record<string, unknown> | null
  startedAt: string
  completedAt: string | null
  /** Populated when the row is expanded */
  actions?: WorkflowActionResponse[]
}

interface WorkflowInfo {
  id: string
  name: string
  enabled: boolean
  triggerType: string
  steps?: WorkflowStep[]
  updatedAt: string
}

interface ApiExecutionsResponse {
  success: boolean
  data?: WorkflowExecution[]
  pagination?: { skip: number; take: number; total: number; hasMore: boolean }
  error?: { code: string; message: string }
}

interface ApiWorkflowResponse {
  success: boolean
  data?: WorkflowInfo
  error?: { code: string; message: string }
}

interface ExecutionsPageProps {
  params: { id: string }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

const STATUS_BADGE: Record<ExecutionStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
  running: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
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

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}m`
}

function truncateJson(obj: Record<string, unknown> | null): string {
  if (!obj) return '—'
  const str = JSON.stringify(obj)
  return str.length > 80 ? str.slice(0, 77) + '…' : str
}

/** Convert WorkflowInfo to the Workflow shape expected by ActionExecutionStats */
function toWorkflow(info: WorkflowInfo): Workflow {
  return {
    id: info.id,
    name: info.name,
    description: null,
    enabled: info.enabled,
    triggerType: info.triggerType as Workflow['triggerType'],
    steps: info.steps ?? [],
    createdAt: info.updatedAt,
    updatedAt: info.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Detail Modal (execution-level, kept for fallback / legacy view)
// ---------------------------------------------------------------------------

interface LegacyDetailModalProps {
  execution: WorkflowExecution | null
  onClose: () => void
}

function LegacyDetailModal({ execution, onClose }: LegacyDetailModalProps) {
  if (!execution) return null

  const statusCfg = STATUS_BADGE[execution.status] ?? { label: execution.status, className: 'bg-gray-100 text-gray-600' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="detail-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Execution Detail</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{execution.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Close detail"
            data-testid="detail-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Status + timing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Started</p>
              <p className="text-xs text-gray-700">{formatDate(execution.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Completed</p>
              <p className="text-xs text-gray-700">{formatDate(execution.completedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Duration</p>
              <p className="text-xs text-gray-700">{formatDuration(execution.startedAt, execution.completedAt)}</p>
            </div>
          </div>

          {/* Error message */}
          {execution.errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
              <p className="text-xs text-red-600 font-mono break-all">{execution.errorMessage}</p>
            </div>
          )}

          {/* Action cards */}
          {execution.actions && execution.actions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-3">Action Results</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {execution.actions.map((act) => (
                  <ActionResultCard key={act.id} action={act} />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Results</p>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all" data-testid="execution-results">
              {execution.results
                ? JSON.stringify(execution.results, null, 2)
                : 'No results available.'}
            </pre>
          </div>

          {/* Trigger data */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Trigger Data</p>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(execution.triggerData, null, 2)}
            </pre>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expanded row: actions timeline + stats
// ---------------------------------------------------------------------------

interface ExpandedExecutionRowProps {
  execution: WorkflowExecution
  steps: WorkflowStep[]
  workflow: WorkflowInfo
  onActionDetailOpen: (action: WorkflowActionResponse, step: WorkflowStep) => void
}

function ExpandedExecutionRow({
  execution,
  steps,
  workflow,
  onActionDetailOpen,
}: ExpandedExecutionRowProps) {
  const actions = execution.actions ?? []

  return (
    <div className="px-6 pb-6 pt-2 space-y-4 bg-gray-50/50" data-testid={`expanded-row-${execution.id}`}>
      {/* Stats */}
      {actions.length > 0 && (
        <ActionExecutionStats
          actions={actions}
          workflow={toWorkflow(workflow)}
        />
      )}

      {/* Two-column layout: timeline left, cards right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h4 className="text-xs font-semibold text-gray-600 mb-4 uppercase tracking-wide">
            Timeline
          </h4>
          {actions.length > 0 ? (
            <ActionTimeline
              actions={actions}
              steps={steps}
              onActionClick={onActionDetailOpen}
            />
          ) : (
            <p className="text-xs text-gray-400 text-center py-6">No actions recorded.</p>
          )}
        </div>

        {/* Action result cards */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Action Results
          </h4>
          {actions.length > 0 ? (
            actions.map((act) => {
              const step = steps.find((s) => s.id === act.stepId)
              return (
                <ActionResultCard
                  key={act.id}
                  action={act}
                  step={step}
                  onViewDetail={() => step && onActionDetailOpen(act, step)}
                />
              )
            })
          ) : (
            <p className="text-xs text-gray-400">No action results available.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkflowExecutionsPage({ params }: ExecutionsPageProps) {
  const { id } = params

  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null)
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailExecution, setDetailExecution] = useState<WorkflowExecution | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loadingActionIds, setLoadingActionIds] = useState<Set<string>>(new Set())

  // Action-level modal state
  const [detailAction, setDetailAction] = useState<WorkflowActionResponse | null>(null)
  const [detailActionStep, setDetailActionStep] = useState<WorkflowStep | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch workflow info
  // ---------------------------------------------------------------------------

  useEffect(() => {
    void fetch(`/api/admin/workflows/${id}`)
      .then((r) => r.json())
      .then((json: ApiWorkflowResponse) => {
        if (json.success && json.data) setWorkflow(json.data)
      })
      .catch(() => null)
  }, [id])

  // ---------------------------------------------------------------------------
  // Fetch executions
  // ---------------------------------------------------------------------------

  const fetchExecutions = useCallback(async () => {
    setLoading(true)
    setError(null)
    const urlParams = new URLSearchParams({
      skip: String(skip),
      take: String(PAGE_SIZE),
    })
    try {
      const res = await fetch(`/api/admin/workflows/${id}/executions?${urlParams.toString()}`)
      const json: ApiExecutionsResponse = await res.json()
      if (!json.success || !json.data) {
        setError(json.error?.message ?? 'Failed to load executions.')
        setExecutions([])
        setTotal(0)
      } else {
        setExecutions(json.data)
        setTotal(json.pagination?.total ?? json.data.length)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id, skip])

  useEffect(() => {
    void fetchExecutions()
  }, [fetchExecutions])

  // ---------------------------------------------------------------------------
  // Toggle execution row expansion and lazy-load actions
  // ---------------------------------------------------------------------------

  const toggleExpanded = useCallback(async (execution: WorkflowExecution) => {
    const isOpen = expandedIds.has(execution.id)
    if (isOpen) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(execution.id)
        return next
      })
      return
    }

    // Expand immediately (show empty state while loading)
    setExpandedIds((prev) => new Set([...prev, execution.id]))

    // Only fetch actions if not already loaded
    if (!execution.actions) {
      setLoadingActionIds((prev) => new Set([...prev, execution.id]))
      try {
        const res = await fetch(`/api/admin/workflow-executions/${execution.id}/actions`)
        const json = await res.json() as { success: boolean; data?: WorkflowActionResponse[] }
        if (json.success && json.data) {
          setExecutions((prev) =>
            prev.map((ex) =>
              ex.id === execution.id ? { ...ex, actions: json.data } : ex,
            ),
          )
        }
      } catch {
        // Fail silently — row will show "No actions recorded."
      } finally {
        setLoadingActionIds((prev) => {
          const next = new Set(prev)
          next.delete(execution.id)
          return next
        })
      }
    }
  }, [expandedIds])

  // ---------------------------------------------------------------------------
  // Open action-level detail modal
  // ---------------------------------------------------------------------------

  function openActionDetail(action: WorkflowActionResponse, step: WorkflowStep) {
    setDetailAction(action)
    setDetailActionStep(step)
  }

  function closeActionDetail() {
    setDetailAction(null)
    setDetailActionStep(null)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasMore = skip + PAGE_SIZE < total
  const hasPrevious = skip > 0
  const steps = workflow?.steps ?? []

  return (
    <div className="space-y-6" data-testid="workflow-executions-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workflows"
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Back to workflows"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Execution History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {workflow ? `Workflow: ${workflow.name}` : `Workflow ID: ${id}`}
          </p>
        </div>
        <button
          onClick={() => void fetchExecutions()}
          disabled={loading}
          aria-label="Refresh executions"
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Workflow info card */}
      {workflow && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" data-testid="workflow-info-card">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</p>
              <p className="text-sm font-semibold text-gray-800">{workflow.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  workflow.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${workflow.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                {workflow.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trigger</p>
              <p className="text-sm text-gray-700">{workflow.triggerType}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Last Updated</p>
              <p className="text-sm text-gray-700">
                {new Date(workflow.updatedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3">
            <Link
              href={`/admin/workflows/${id}`}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              Edit Workflow
            </Link>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700" data-testid="executions-error">
          {error}
        </div>
      )}

      {/* Executions table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {loading ? 'Loading…' : `${total} execution${total !== 1 ? 's' : ''}`}
          </h2>
        </div>

        {loading && executions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm" data-testid="executions-loading">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-gray-300" />
            Loading executions…
          </div>
        ) : executions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm" data-testid="executions-empty">
            <p className="font-semibold text-gray-500">No executions yet.</p>
            <p className="mt-1 text-xs">This workflow has not been executed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="executions-table">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left w-8" />
                  <th className="px-6 py-3 text-left">Execution ID</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Started At</th>
                  <th className="px-6 py-3 text-left">Completed At</th>
                  <th className="px-6 py-3 text-left">Duration</th>
                  <th className="px-6 py-3 text-left">Result</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {executions.map((ex, idx) => {
                  const statusCfg = STATUS_BADGE[ex.status] ?? { label: ex.status, className: 'bg-gray-100 text-gray-600' }
                  const isExpanded = expandedIds.has(ex.id)
                  const isLoadingActions = loadingActionIds.has(ex.id)

                  return (
                    <React.Fragment key={ex.id}>
                      <tr
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                        data-testid={`execution-row-${ex.id}`}
                      >
                        {/* Expand toggle */}
                        <td className="pl-4 pr-2 py-4">
                          <button
                            type="button"
                            onClick={() => void toggleExpanded(ex)}
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                            aria-expanded={isExpanded}
                            data-testid={`expand-btn-${ex.id}`}
                          >
                            {isLoadingActions ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs text-gray-500 truncate max-w-[140px]">
                          {ex.id}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.className}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-xs whitespace-nowrap">
                          {formatDate(ex.startedAt)}
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-xs whitespace-nowrap">
                          {formatDate(ex.completedAt)}
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-xs">
                          {formatDuration(ex.startedAt, ex.completedAt)}
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs font-mono truncate max-w-[180px]">
                          {ex.errorMessage ? (
                            <span className="text-red-600 truncate">{ex.errorMessage}</span>
                          ) : (
                            truncateJson(ex.results)
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setDetailExecution(ex)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 border border-blue-200 bg-white hover:bg-blue-50 transition-colors"
                            aria-label={`View details for execution ${ex.id}`}
                            data-testid={`view-detail-btn-${ex.id}`}
                          >
                            View Detail
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr data-testid={`expanded-row-tr-${ex.id}`}>
                          <td colSpan={8} className="p-0">
                            <ExpandedExecutionRow
                              execution={ex}
                              steps={steps}
                              workflow={workflow ?? { id, name: id, enabled: false, triggerType: 'MANUAL', updatedAt: '' }}
                              onActionDetailOpen={openActionDetail}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
                disabled={!hasPrevious || loading}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="executions-prev-btn"
              >
                Previous
              </button>
              <button
                onClick={() => setSkip((s) => s + PAGE_SIZE)}
                disabled={!hasMore || loading}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                data-testid="executions-next-btn"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legacy execution-level detail modal */}
      <LegacyDetailModal
        execution={detailExecution}
        onClose={() => setDetailExecution(null)}
      />

      {/* Action-level detail modal */}
      {detailAction && detailActionStep && (
        <ActionDetailModal
          action={detailAction}
          step={detailActionStep}
          isOpen={!!detailAction}
          onClose={closeActionDetail}
        />
      )}
    </div>
  )
}
