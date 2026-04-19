'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/lib/hooks/useToast'
import { PaginationControls } from '@/components/ui/PaginationControls'
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Play,
  Filter,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED'

interface Workflow {
  id: string
  name: string
  description: string | null
  enabled: boolean
  triggerType: TriggerType
  createdBy: string
  executionCount: number
  lastExecuted: string | null
  createdAt: string
  updatedAt: string
}

interface ApiListResponse {
  success: boolean
  data?: { workflows: Workflow[]; total: number }
  pagination?: { page: number; limit: number; total: number }
  error?: { code: string; message: string }
}

interface ApiExecuteResponse {
  success: boolean
  data?: { id: string; status: string }
  error?: { code: string; message: string }
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
      {enabled ? 'Active' : 'Inactive'}
    </span>
  )
}

const TRIGGER_BADGE: Record<TriggerType, { label: string; className: string }> = {
  MANUAL: { label: 'Manual', className: 'bg-blue-100 text-blue-700' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-purple-100 text-purple-700' },
  EVENT_BASED: { label: 'Event Based', className: 'bg-orange-100 text-orange-700' },
}

function TriggerBadge({ type }: { type: TriggerType }) {
  const cfg = TRIGGER_BADGE[type] ?? { label: type, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete modal
// ---------------------------------------------------------------------------

interface DeleteModalProps {
  workflow: Workflow | null
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}

function DeleteModal({ workflow, onConfirm, onCancel, deleting }: DeleteModalProps) {
  if (!workflow) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="delete-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Delete Workflow</h3>
            <p className="text-sm text-gray-500">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Are you sure you want to delete{' '}
          <span className="font-semibold">&ldquo;{workflow.name}&rdquo;</span>? All steps and
          execution history will be permanently removed.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            data-testid="delete-cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            data-testid="delete-confirm-btn"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Execute modal
// ---------------------------------------------------------------------------

interface ExecuteModalProps {
  workflow: Workflow | null
  onConfirm: () => void
  onCancel: () => void
  executing: boolean
  result: string | null
}

function ExecuteModal({ workflow, onConfirm, onCancel, executing, result }: ExecuteModalProps) {
  if (!workflow) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="execute-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Play className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Execute Workflow</h3>
            <p className="text-sm text-gray-500">Run this workflow now</p>
          </div>
        </div>

        {!result ? (
          <>
            <p className="text-sm text-gray-700">
              Execute{' '}
              <span className="font-semibold">&ldquo;{workflow.name}&rdquo;</span> immediately?
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={onCancel}
                disabled={executing}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={executing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                data-testid="execute-confirm-btn"
              >
                {executing && <Loader2 className="w-4 h-4 animate-spin" />}
                {executing ? 'Executing…' : 'Execute Now'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              <p className="font-semibold mb-1">Execution started</p>
              <p className="text-xs font-mono break-all">{result}</p>
            </div>
            <button
              onClick={onCancel}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page constants
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 50
const TRIGGER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Trigger Types' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'EVENT_BASED', label: 'Event Based' },
]

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WorkflowsListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()

  // Filters
  const [isActiveFilter, setIsActiveFilter] = useState<string>(
    searchParams.get('isActive') ?? '',
  )
  const [triggerFilter, setTriggerFilter] = useState<string>(
    searchParams.get('triggerType') ?? '',
  )
  const [page, setPage] = useState(0)

  // Data
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stats (from list data)
  const activeCount = workflows.filter((w) => w.enabled).length
  const totalExecutions = workflows.reduce((sum, w) => sum + w.executionCount, 0)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Execute modal
  const [executeTarget, setExecuteTarget] = useState<Workflow | null>(null)
  const [executing, setExecuting] = useState(false)
  const [executeResult, setExecuteResult] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(PAGE_LIMIT))
    if (isActiveFilter !== '') params.set('isActive', isActiveFilter)
    if (triggerFilter) params.set('triggerType', triggerFilter)

    try {
      const res = await fetch(`/api/admin/workflows?${params.toString()}`)
      const json: ApiListResponse = await res.json()
      if (!json.success || !json.data) {
        setError(json.error?.message ?? 'Failed to load workflows.')
        setWorkflows([])
        setTotal(0)
      } else {
        setWorkflows(json.data.workflows)
        setTotal(json.data.total)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [page, isActiveFilter, triggerFilter])

  useEffect(() => {
    void fetchWorkflows()
  }, [fetchWorkflows])

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/workflows/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        toast.success({ title: 'Workflow deleted', message: `"${deleteTarget.name}" has been removed.` })
        setDeleteTarget(null)
        void fetchWorkflows()
      } else {
        const json = await res.json().catch(() => ({}))
        toast.error({ title: 'Delete failed', message: (json as ApiListResponse).error?.message ?? 'Could not delete workflow.' })
      }
    } catch {
      toast.error({ title: 'Network error', message: 'Could not connect to server.' })
    } finally {
      setDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Execute
  // ---------------------------------------------------------------------------

  async function handleExecuteConfirm() {
    if (!executeTarget) return
    setExecuting(true)
    try {
      const res = await fetch(`/api/admin/workflows/${executeTarget.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json: ApiExecuteResponse = await res.json()
      if (json.success && json.data) {
        setExecuteResult(`Execution ID: ${json.data.id} — Status: ${json.data.status}`)
        toast.success({ title: 'Workflow executed', message: `Execution started for "${executeTarget.name}".` })
        void fetchWorkflows()
      } else {
        toast.error({ title: 'Execution failed', message: json.error?.message ?? 'Could not execute workflow.' })
        setExecuteTarget(null)
      }
    } catch {
      toast.error({ title: 'Network error', message: 'Could not connect to server.' })
      setExecuteTarget(null)
    } finally {
      setExecuting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Filter handlers
  // ---------------------------------------------------------------------------

  function handleFilterChange() {
    setPage(0)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT))

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6" data-testid="workflows-list-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Build and manage automated production workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchWorkflows()}
            disabled={loading}
            aria-label="Refresh workflows"
            className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/workflows/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            data-testid="create-workflow-btn"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Workflows" value={total} subtitle="all workflows" />
        <StatCard title="Active Workflows" value={activeCount} subtitle="currently enabled" />
        <StatCard title="Total Executions" value={totalExecutions} subtitle="across all workflows" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Filter className="w-4 h-4 text-gray-400 self-center" />
          {/* Active filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
            <select
              value={isActiveFilter}
              onChange={(e) => { setIsActiveFilter(e.target.value); handleFilterChange() }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="filter-status"
            >
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          {/* Trigger filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Trigger Type</label>
            <select
              value={triggerFilter}
              onChange={(e) => { setTriggerFilter(e.target.value); handleFilterChange() }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="filter-trigger"
            >
              {TRIGGER_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Clear filters */}
          {(isActiveFilter !== '' || triggerFilter !== '') && (
            <button
              onClick={() => { setIsActiveFilter(''); setTriggerFilter(''); setPage(0) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700" data-testid="list-error">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            {loading ? 'Loading…' : `${total} workflow${total !== 1 ? 's' : ''}`}
          </h2>
        </div>

        {loading && workflows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm" data-testid="loading-state">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-gray-300" />
            Loading workflows…
          </div>
        ) : workflows.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm" data-testid="empty-state">
            <p className="font-semibold text-gray-500">No workflows found.</p>
            <p className="mt-1 text-xs">Try adjusting the filters, or create a new workflow.</p>
            <Link
              href="/admin/workflows/create"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="workflows-table">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Trigger</th>
                  <th className="px-6 py-3 text-left">Created By</th>
                  <th className="px-6 py-3 text-left">Last Updated</th>
                  <th className="px-6 py-3 text-right">Executions</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workflows.map((wf, idx) => (
                  <tr
                    key={wf.id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}
                    data-testid={`workflow-row-${wf.id}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 truncate max-w-xs">{wf.name}</p>
                      {wf.description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{wf.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge enabled={wf.enabled} />
                    </td>
                    <td className="px-6 py-4">
                      <TriggerBadge type={wf.triggerType} />
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs font-mono truncate max-w-[120px]">
                      {wf.createdBy}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(wf.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700 font-semibold">
                      {wf.executionCount}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Executions history */}
                        <Link
                          href={`/admin/workflows/${wf.id}/executions`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          aria-label={`View execution history for ${wf.name}`}
                          title="Execution History"
                          data-testid={`executions-btn-${wf.id}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </Link>
                        {/* Edit */}
                        <button
                          onClick={() => router.push(`/admin/workflows/${wf.id}`)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          aria-label={`Edit workflow ${wf.name}`}
                          title="Edit"
                          data-testid={`edit-btn-${wf.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {/* Execute */}
                        <button
                          onClick={() => { setExecuteTarget(wf); setExecuteResult(null) }}
                          disabled={!wf.enabled}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={`Execute workflow ${wf.name}`}
                          title={wf.enabled ? 'Execute' : 'Workflow is inactive'}
                          data-testid={`execute-btn-${wf.id}`}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(wf)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`Delete workflow ${wf.name}`}
                          title="Delete"
                          data-testid={`delete-btn-${wf.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_LIMIT && (
          <div className="px-6 py-4 border-t border-gray-100">
            <PaginationControls
              hasPrevious={page > 0}
              hasNext={page < totalPages - 1}
              onPrevious={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              currentPage={page + 1}
              totalPages={totalPages}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <DeleteModal
        workflow={deleteTarget}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
        deleting={deleting}
      />
      <ExecuteModal
        workflow={executeTarget}
        onConfirm={() => void handleExecuteConfirm()}
        onCancel={() => { setExecuteTarget(null); setExecuteResult(null) }}
        executing={executing}
        result={executeResult}
      />
    </div>
  )
}
