'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import BatchForm from '@/components/production/BatchForm'
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X,
  FlaskConical,
  CheckCircle2,
  Clock,
  PlayCircle,
  PauseCircle,
  XCircle,
  Eye,
  Trash2,
  ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatchStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'CANCELLED'

interface Lab {
  id: string
  name: string
  type: string
}

interface Batch {
  id: string
  batchNumber: string
  status: BatchStatus
  quantity: number
  plannedStartTime: string
  estimatedCompletionTime: string | null
  actualStartTime: string | null
  actualCompletionTime: string | null
  createdAt: string
  lab: { id: string; name: string; type: string }
  recipe: { id: string; name: string; laborMinutes: number }
  machine: { id: string; name: string } | null
  employee: { id: string; name: string; role: string } | null
}

interface PatchPayload {
  status: BatchStatus
  actualStartTime?: string
  actualCompletionTime?: string
}

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: BatchStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClasses(status: BatchStatus): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800'
    case 'PLANNED':
      return 'bg-yellow-100 text-yellow-800'
    case 'COMPLETED':
      return 'bg-green-100 text-green-800'
    case 'PAUSED':
      return 'bg-orange-100 text-orange-800'
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-600'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

function statusLabel(status: BatchStatus): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'In Progress'
    case 'PLANNED':
      return 'Planned'
    case 'COMPLETED':
      return 'Completed'
    case 'PAUSED':
      return 'Paused'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return status
  }
}

function statusIcon(status: BatchStatus) {
  switch (status) {
    case 'IN_PROGRESS':
      return <PlayCircle className="w-3 h-3" aria-hidden="true" />
    case 'PLANNED':
      return <Clock className="w-3 h-3" aria-hidden="true" />
    case 'COMPLETED':
      return <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
    case 'PAUSED':
      return <PauseCircle className="w-3 h-3" aria-hidden="true" />
    case 'CANCELLED':
      return <XCircle className="w-3 h-3" aria-hidden="true" />
    default:
      return null
  }
}

/** Returns the list of valid next statuses from a given current status. */
function getNextStatuses(current: BatchStatus): BatchStatus[] {
  switch (current) {
    case 'PLANNED':
      return ['IN_PROGRESS', 'PAUSED', 'CANCELLED']
    case 'IN_PROGRESS':
      return ['COMPLETED', 'PAUSED', 'CANCELLED']
    case 'PAUSED':
      return ['IN_PROGRESS', 'CANCELLED']
    case 'COMPLETED':
    case 'CANCELLED':
      return []
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Status Update Modal
// ---------------------------------------------------------------------------

interface StatusUpdateModalProps {
  batch: Batch
  targetStatus: BatchStatus
  onClose: () => void
  onConfirmed: () => void
}

function StatusUpdateModal({
  batch,
  targetStatus,
  onClose,
  onConfirmed,
}: StatusUpdateModalProps) {
  const { success, error: toastError } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [actualQty, setActualQty] = useState('')
  const [notes, setNotes] = useState('')

  const needsCompletion = targetStatus === 'COMPLETED'

  async function handleConfirm() {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const payload: PatchPayload = { status: targetStatus }

      if (targetStatus === 'IN_PROGRESS') {
        payload.actualStartTime = now
      }
      if (targetStatus === 'COMPLETED') {
        payload.actualCompletionTime = now
      }

      const res = await fetch(`/api/admin/production/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Update Failed',
          message: json.error?.message ?? 'Failed to update batch status.',
        })
        return
      }

      success({
        title: 'Status Updated',
        message: `Batch ${batch.batchNumber} moved to ${statusLabel(targetStatus)}.`,
      })
      onConfirmed()
    } finally {
      setIsSaving(false)
    }
  }

  const transitionLabel = `${statusLabel(batch.status)} → ${statusLabel(targetStatus)}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <h2 id="status-modal-title" className="text-lg font-bold text-gray-900">
              Update Batch Status
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Batch{' '}
              <span className="font-semibold text-gray-900">{batch.batchNumber}</span>{' '}
              &mdash; {batch.recipe.name}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              Transition:{' '}
              <span className="font-medium text-gray-800">{transitionLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional: actual quantity for COMPLETED */}
        {needsCompletion && (
          <div className="mb-4">
            <label
              htmlFor="actual-qty"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Actual Quantity Produced{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="actual-qty"
              type="number"
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
              min={0}
              step={1}
              placeholder={`Planned: ${batch.quantity}`}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513]"
            />
          </div>
        )}

        {/* Notes */}
        <div className="mb-5">
          <label
            htmlFor="status-notes"
            className="block text-sm font-semibold text-gray-700 mb-1"
          >
            Notes{' '}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="status-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Paused due to equipment maintenance..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              targetStatus === 'CANCELLED'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#8B4513] hover:bg-[#7a3c10]'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              `Confirm: ${statusLabel(targetStatus)}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirm Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  batch: Batch
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({ batch, onClose, onConfirmed }: DeleteConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/production/batches/${batch.id}`, {
        method: 'DELETE',
      })

      // Gracefully handle cases where DELETE is not implemented (405)
      if (res.status === 405) {
        toastError({
          title: 'Not Supported',
          message: 'Batch deletion is not enabled. Use CANCELLED status instead.',
        })
        return
      }

      const json = await res.json().catch(() => ({ success: false }))

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete batch.',
        })
        return
      }

      success({
        title: 'Batch Deleted',
        message: `Batch ${batch.batchNumber} has been removed.`,
      })
      onConfirmed()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-batch-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2
              id="delete-batch-modal-title"
              className="text-lg font-bold text-gray-900"
            >
              Delete Batch
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Are you sure you want to delete batch{' '}
              <span className="font-bold text-gray-900">{batch.batchNumber}</span>{' '}
              ({batch.recipe.name})? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Batch'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Batch Detail Modal
// ---------------------------------------------------------------------------

interface BatchDetailModalProps {
  batch: Batch
  onClose: () => void
}

function BatchDetailModal({ batch, onClose }: BatchDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-detail-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="batch-detail-modal-title" className="text-xl font-bold text-gray-900">
            Batch Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${statusBadgeClasses(batch.status)}`}
            >
              {statusIcon(batch.status)}
              {statusLabel(batch.status)}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Batch Number
              </dt>
              <dd className="mt-0.5 font-mono font-semibold text-gray-900">
                {batch.batchNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Recipe
              </dt>
              <dd className="mt-0.5 text-gray-900">{batch.recipe.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Lab
              </dt>
              <dd className="mt-0.5 text-gray-900">
                {batch.lab.name} ({batch.lab.type})
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Quantity
              </dt>
              <dd className="mt-0.5 text-gray-900">{batch.quantity} units</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Planned Start
              </dt>
              <dd className="mt-0.5 text-gray-900">
                {formatDateTime(batch.plannedStartTime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Est. Completion
              </dt>
              <dd className="mt-0.5 text-gray-900">
                {formatDateTime(batch.estimatedCompletionTime)}
              </dd>
            </div>
            {batch.actualStartTime && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actual Start
                </dt>
                <dd className="mt-0.5 text-gray-900">
                  {formatDateTime(batch.actualStartTime)}
                </dd>
              </div>
            )}
            {batch.actualCompletionTime && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Actual Completion
                </dt>
                <dd className="mt-0.5 text-green-700 font-semibold">
                  {formatDateTime(batch.actualCompletionTime)}
                </dd>
              </div>
            )}
            {batch.machine && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Machine
                </dt>
                <dd className="mt-0.5 text-gray-900">{batch.machine.name}</dd>
              </div>
            )}
            {batch.employee && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Assigned Employee
                </dt>
                <dd className="mt-0.5 text-gray-900">
                  {batch.employee.name} — {batch.employee.role}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Created
              </dt>
              <dd className="mt-0.5 text-gray-600">{formatDateTime(batch.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProductionBatchesPage() {
  const { error: toastError } = useToast()

  // --- Data ---
  const [batches, setBatches] = useState<Batch[]>([])
  const [allBatches, setAllBatches] = useState<Batch[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  // --- Load state ---
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // --- Filters ---
  const [statusFilter, setStatusFilter] = useState<BatchStatus | ''>('')
  const [labFilter, setLabFilter] = useState('')
  const [search, setSearch] = useState('')

  // --- Modals ---
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [statusUpdateModal, setStatusUpdateModal] = useState<{
    batch: Batch
    targetStatus: BatchStatus
  } | null>(null)
  const [deleteModal, setDeleteModal] = useState<Batch | null>(null)
  const [detailModal, setDetailModal] = useState<Batch | null>(null)

  // Auto-refresh interval ref
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch labs for filter dropdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/admin/labs')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setLabs(json.data as Lab[])
      })
      .catch(() => setLabs([]))
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch batches
  // ---------------------------------------------------------------------------
  const fetchBatches = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({ skip: '0', take: '200' })
      if (statusFilter) params.set('status', statusFilter)
      if (labFilter) params.set('labId', labFilter)

      const res = await fetch(`/api/admin/production/batches?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error?.message ?? 'Failed to load batches.'
        setLoadError(msg)
        toastError({ title: 'Load Failed', message: msg })
        return
      }

      const data: Batch[] = json.data ?? []
      setAllBatches(data)
      setTotal(json.pagination?.total ?? data.length)
      setPage(1)
      setBatches(data.slice(0, PAGE_SIZE))
      setHasMore(data.length > PAGE_SIZE)
    } catch {
      const msg = 'Network error. Could not load production batches.'
      setLoadError(msg)
      toastError({ title: 'Network Error', message: msg })
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, labFilter, toastError])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchBatches()
    }, 60_000)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [fetchBatches])

  // ---------------------------------------------------------------------------
  // Client-side search filter (batch number)
  // ---------------------------------------------------------------------------
  const filteredBatches = search.trim()
    ? batches.filter((b) =>
        b.batchNumber.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : batches

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------
  function handleLoadMore() {
    const nextPage = page + 1
    const nextSlice = allBatches.slice(0, nextPage * PAGE_SIZE)
    setBatches(nextSlice)
    setPage(nextPage)
    setHasMore(nextSlice.length < allBatches.length)
  }

  // ---------------------------------------------------------------------------
  // Callbacks after modal actions
  // ---------------------------------------------------------------------------
  function handleBatchCreated() {
    setShowCreateModal(false)
    fetchBatches()
  }

  function handleStatusUpdated() {
    setStatusUpdateModal(null)
    fetchBatches()
  }

  function handleDeleted() {
    setDeleteModal(null)
    fetchBatches()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Batches</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} batch{total !== 1 ? 'es' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchBatches}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh batches"
            aria-label="Refresh batches list"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B4513] text-white rounded-lg text-sm font-semibold hover:bg-[#7a3c10] transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create Batch
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Batch number search */}
        <div className="relative flex-1 max-w-xs">
          <Search
            className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch number..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513]"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BatchStatus | '')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-white"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Lab filter */}
        <select
          value={labFilter}
          onChange={(e) => setLabFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] bg-white"
          aria-label="Filter by lab"
        >
          <option value="">All Labs</option>
          {labs.map((lab) => (
            <option key={lab.id} value={lab.id}>
              {lab.name}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(statusFilter || labFilter || search) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('')
              setLabFilter('')
              setSearch('')
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      {/* Load error */}
      {loadError && !isLoading && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Production batches">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  'Batch Number',
                  'Recipe',
                  'Lab',
                  'Quantity',
                  'Status',
                  'Planned Start',
                  'Completion',
                  'Actions',
                ].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                      col === 'Actions' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && allBatches.length === 0 ? (
                <SkeletonRows count={5} />
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-16 text-center text-gray-500"
                  >
                    <FlaskConical
                      className="w-10 h-10 text-gray-300 mx-auto mb-3"
                      aria-hidden="true"
                    />
                    <p className="font-medium">No batches found</p>
                    <p className="text-xs mt-1">
                      {statusFilter || labFilter || search
                        ? 'Try adjusting your filters.'
                        : 'Create your first production batch to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const nextStatuses = getNextStatuses(batch.status)
                  const isTerminal =
                    batch.status === 'COMPLETED' || batch.status === 'CANCELLED'

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Batch Number */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                          {batch.batchNumber}
                        </span>
                      </td>

                      {/* Recipe */}
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {batch.recipe.name}
                      </td>

                      {/* Lab */}
                      <td className="px-4 py-3 text-gray-600">
                        {batch.lab.name}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3 text-gray-700">
                        {batch.quantity}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClasses(batch.status)}`}
                        >
                          {statusIcon(batch.status)}
                          {statusLabel(batch.status)}
                        </span>
                      </td>

                      {/* Planned Start */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDateTime(batch.plannedStartTime)}
                      </td>

                      {/* Actual Completion */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {batch.actualCompletionTime ? (
                          <span className="text-green-700 font-semibold">
                            {formatDateTime(batch.actualCompletionTime)}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {formatDateTime(batch.estimatedCompletionTime)}
                            {batch.estimatedCompletionTime && (
                              <span className="ml-1 text-gray-400">(est.)</span>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Status transitions */}
                          {nextStatuses.length > 0 && (
                            <div className="relative group">
                              <button
                                type="button"
                                className="p-1.5 text-gray-400 hover:text-[#8B4513] hover:bg-amber-50 rounded transition-colors text-xs font-semibold flex items-center gap-0.5"
                                aria-label={`Update status for ${batch.batchNumber}`}
                                title="Update status"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              {/* Dropdown */}
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40 hidden group-hover:block">
                                {nextStatuses.map((ns) => (
                                  <button
                                    key={ns}
                                    type="button"
                                    onClick={() =>
                                      setStatusUpdateModal({ batch, targetStatus: ns })
                                    }
                                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 flex items-center gap-2 ${
                                      ns === 'CANCELLED'
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {statusIcon(ns)}
                                    {statusLabel(ns)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => setDetailModal(batch)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                            aria-label={`View details for ${batch.batchNumber}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Delete (only for terminal or planned) */}
                          {(isTerminal || batch.status === 'PLANNED') && (
                            <button
                              type="button"
                              onClick={() => setDeleteModal(batch)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete batch"
                              aria-label={`Delete batch ${batch.batchNumber}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && !search.trim() && (
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={handleLoadMore}
              isLoading={false}
              label={`Load More Batches (${allBatches.length - batches.length} remaining)`}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <BatchForm
          onSuccess={handleBatchCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {statusUpdateModal && (
        <StatusUpdateModal
          batch={statusUpdateModal.batch}
          targetStatus={statusUpdateModal.targetStatus}
          onClose={() => setStatusUpdateModal(null)}
          onConfirmed={handleStatusUpdated}
        />
      )}

      {deleteModal && (
        <DeleteConfirmModal
          batch={deleteModal}
          onClose={() => setDeleteModal(null)}
          onConfirmed={handleDeleted}
        />
      )}

      {detailModal && (
        <BatchDetailModal
          batch={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  )
}
