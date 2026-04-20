'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/hooks/useToast'
import BatchForm from '@/components/production/BatchForm'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  X,
  Eye,
  Plus,
  CheckCircle2,
  Clock,
  Users,
  Activity,
  TrendingUp,
  Loader2,
  ShieldAlert,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatchStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'CANCELLED'
type LabType = 'PREPARATION' | 'ASSEMBLY' | 'FINISHING'
type UserRole = 'ADMIN' | 'MANAGER' | 'WORKER' | 'CUSTOMER' | 'DRIVER'

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
  updatedAt: string
  lab: { id: string; name: string; type: string }
  recipe: { id: string; name: string; laborMinutes: number }
  machine: { id: string; name: string } | null
  employee: { id: string; name: string; role: string } | null
}

interface Lab {
  id: string
  name: string
  type: LabType
  capacity: number
  createdAt: string
  stockSummary: { totalMaterials: number; lowStockCount: number }
  _count: { employees: number; machines: number; batches: number }
}

interface LabCapacity {
  labId: string
  labName: string
  currentBatches: number
  maxCapacity: number
  utilizationPercent: number
}

// ---------------------------------------------------------------------------
// Derived data types built client-side
// ---------------------------------------------------------------------------

interface LabWithBatches {
  lab: Lab
  capacity: LabCapacity | null
  recentBatches: Batch[]
}

interface WorkerMetric {
  id: string
  name: string
  labName: string
  batchesCompletedToday: number
  onTimePercent: number | null
  avgBatchMinutes: number | null
  status: 'Active' | 'Idle' | 'Off-shift'
}

interface Alert {
  id: string
  type: 'delayed' | 'shortage' | 'overdue-start' | 'overlap'
  severity: 'red' | 'orange' | 'yellow'
  message: string
  batchId?: string
  batchNumber?: string
  labId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: BatchStatus): string {
  switch (status) {
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
    case 'PLANNED':     return 'bg-yellow-100 text-yellow-800'
    case 'COMPLETED':   return 'bg-green-100 text-green-800'
    case 'PAUSED':      return 'bg-orange-100 text-orange-800'
    case 'CANCELLED':   return 'bg-gray-100 text-gray-600'
    default:            return 'bg-gray-100 text-gray-600'
  }
}

function labTypeBadge(type: LabType): string {
  switch (type) {
    case 'PREPARATION': return 'bg-purple-100 text-purple-700'
    case 'ASSEMBLY':    return 'bg-blue-100 text-blue-700'
    case 'FINISHING':   return 'bg-amber-100 text-amber-700'
    default:            return 'bg-gray-100 text-gray-600'
  }
}

function utilizationColor(pct: number): string {
  if (pct > 95) return 'bg-red-500'
  if (pct > 80) return 'bg-amber-400'
  return 'bg-green-500'
}

function utilizationIndicator(pct: number): string {
  if (pct > 95) return 'text-red-600'
  if (pct > 80) return 'text-amber-600'
  return 'text-green-600'
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isSameDay(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-3/5 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-2/5 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-4/5" />
    </div>
  )
}

function LabCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-2 bg-gray-200 rounded w-full" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
    </div>
  )
}

function TableRowSkeleton({ cols }: { cols: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  alert?: boolean
  gold?: boolean
}

function KpiCard({ title, value, subtitle, icon, alert, gold }: KpiCardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border p-6 flex flex-col gap-2 ${
        alert
          ? 'border-red-300 border-l-4 border-l-red-500'
          : gold
            ? 'border-[#D4AF37] border-l-4 border-l-[#D4AF37]'
            : 'border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        {icon && <span className={`${alert ? 'text-red-500' : gold ? 'text-[#D4AF37]' : 'text-gray-400'}`}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold ${alert ? 'text-red-600' : gold ? 'text-[#8B4513]' : 'text-gray-900'}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
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
      aria-labelledby="batch-detail-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="batch-detail-title" className="text-xl font-bold text-gray-900">
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
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${statusBadge(batch.status)}`}>
              {batch.status.replace('_', ' ')}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Batch Number</dt>
              <dd className="mt-0.5 font-mono font-semibold text-gray-900">{batch.batchNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recipe</dt>
              <dd className="mt-0.5 text-gray-900">{batch.recipe.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lab</dt>
              <dd className="mt-0.5 text-gray-900">{batch.lab.name} ({batch.lab.type})</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quantity</dt>
              <dd className="mt-0.5 text-gray-900">{batch.quantity} units</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Planned Start</dt>
              <dd className="mt-0.5 text-gray-900">{formatDateTime(batch.plannedStartTime)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Est. Completion</dt>
              <dd className="mt-0.5 text-gray-900">{formatDateTime(batch.estimatedCompletionTime)}</dd>
            </div>
            {batch.actualStartTime && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actual Start</dt>
                <dd className="mt-0.5 text-gray-900">{formatDateTime(batch.actualStartTime)}</dd>
              </div>
            )}
            {batch.actualCompletionTime && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actual Completion</dt>
                <dd className="mt-0.5 text-green-700 font-semibold">{formatDateTime(batch.actualCompletionTime)}</dd>
              </div>
            )}
            {batch.machine && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Machine</dt>
                <dd className="mt-0.5 text-gray-900">{batch.machine.name}</dd>
              </div>
            )}
            {batch.employee && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned Worker</dt>
                <dd className="mt-0.5 text-gray-900">{batch.employee.name} — {batch.employee.role}</dd>
              </div>
            )}
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
// Create Batch Modal (wraps BatchForm)
// ---------------------------------------------------------------------------

interface CreateBatchModalProps {
  onClose: () => void
  onSuccess: () => void
}

function CreateBatchModal({ onClose, onSuccess }: CreateBatchModalProps) {
  function handleSuccess(batchNumber: string) {
    onSuccess()
    void batchNumber
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-batch-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="create-batch-title" className="text-xl font-bold text-gray-900">
            Create Production Batch
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
        <div className="p-6">
          <BatchForm onSuccess={handleSuccess} onClose={onClose} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status breakdown bar chart
// ---------------------------------------------------------------------------

interface StatusBreakdownProps {
  batches: Batch[]
}

function StatusBreakdown({ batches }: StatusBreakdownProps) {
  const counts: Record<BatchStatus, number> = {
    PLANNED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    PAUSED: 0,
    CANCELLED: 0,
  }

  for (const b of batches) {
    counts[b.status] = (counts[b.status] ?? 0) + 1
  }

  const data = [
    { name: 'Planned', count: counts.PLANNED, color: '#3B82F6' },
    { name: 'In Progress', count: counts.IN_PROGRESS, color: '#06B6D4' },
    { name: 'Completed', count: counts.COMPLETED, color: '#22C55E' },
    { name: 'Paused', count: counts.PAUSED, color: '#F97316' },
    { name: 'Cancelled', count: counts.CANCELLED, color: '#9CA3AF' },
  ]

  const total = batches.length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Status Breakdown</h3>
        <span className="text-xs text-gray-400">{total} total batch{total !== 1 ? 'es' : ''}</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No batches yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [value as number, 'Batches'] as any}
                contentStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: d.color }} aria-hidden="true" />
                {d.name}: <span className="font-semibold">{d.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline Timeline (simple horizontal, CSS-based)
// ---------------------------------------------------------------------------

interface PipelineTimelineProps {
  batches: Batch[]
  labs: Lab[]
  onBatchClick: (batch: Batch) => void
}

function PipelineTimeline({ batches, labs, onBatchClick }: PipelineTimelineProps) {
  const now = Date.now()
  const windowMs = 6 * 60 * 60 * 1000 // 6-hour window
  const windowStart = now - 60 * 60 * 1000 // 1h before now
  const windowEnd = windowStart + windowMs

  const activeBatches = batches.filter((b) => {
    if (b.status === 'CANCELLED') return false
    const start = new Date(b.plannedStartTime).getTime()
    const end = b.estimatedCompletionTime
      ? new Date(b.estimatedCompletionTime).getTime()
      : start + 2 * 60 * 60 * 1000
    return end >= windowStart && start <= windowEnd
  })

  const labsWithBatches = labs.filter((lab) =>
    activeBatches.some((b) => b.lab.id === lab.id)
  )

  if (labsWithBatches.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        No active batches in the 6-hour window.
      </p>
    )
  }

  const statusColors: Record<BatchStatus, string> = {
    PLANNED:     'bg-yellow-300 border-yellow-500',
    IN_PROGRESS: 'bg-blue-400 border-blue-600',
    COMPLETED:   'bg-green-400 border-green-600',
    PAUSED:      'bg-orange-400 border-orange-600',
    CANCELLED:   'bg-gray-300 border-gray-400',
  }

  const hourLabels = ['-1h', 'Now', '+1h', '+2h', '+3h', '+4h', '+5h']

  return (
    <div>
      {/* Hour labels */}
      <div className="flex mb-1 pl-28">
        {hourLabels.map((label, i) => (
          <div key={i} className="flex-1 text-xs text-gray-400 text-center">{label}</div>
        ))}
      </div>

      {/* Lab rows */}
      <div className="space-y-2">
        {labsWithBatches.map((lab) => {
          const labBatches = activeBatches.filter((b) => b.lab.id === lab.id)
          return (
            <div key={lab.id} className="flex items-center gap-2">
              <div className="w-28 flex-shrink-0 text-xs font-medium text-gray-700 truncate pr-2" title={lab.name}>
                {lab.name}
              </div>
              <div className="relative flex-1 h-8 bg-gray-100 rounded overflow-hidden">
                {/* Now marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                  style={{ left: `${((now - windowStart) / windowMs) * 100}%` }}
                  title="Now"
                />
                {labBatches.map((batch) => {
                  const start = new Date(batch.plannedStartTime).getTime()
                  const end = batch.estimatedCompletionTime
                    ? new Date(batch.estimatedCompletionTime).getTime()
                    : start + 2 * 60 * 60 * 1000
                  const leftPct = Math.max(0, ((start - windowStart) / windowMs) * 100)
                  const widthPct = Math.min(100 - leftPct, ((end - start) / windowMs) * 100)
                  const colorClass = statusColors[batch.status] ?? statusColors.PLANNED

                  return (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => onBatchClick(batch)}
                      className={`absolute top-1 bottom-1 rounded border ${colorClass} opacity-90 hover:opacity-100 transition-opacity`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                      }}
                      title={`${batch.batchNumber} — ${batch.recipe.name} (${batch.status.replace('_', ' ')})`}
                      aria-label={`Batch ${batch.batchNumber}: ${batch.recipe.name}`}
                    >
                      <span className="sr-only">{batch.batchNumber}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {(Object.entries(statusColors) as [BatchStatus, string][]).map(([status, cls]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-3 h-3 rounded-sm inline-block border ${cls}`} aria-hidden="true" />
            {status.replace('_', ' ')}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alerts section
// ---------------------------------------------------------------------------

interface AlertItemProps {
  alert: Alert
  onViewBatch?: (batchId: string) => void
}

function AlertItem({ alert, onViewBatch }: AlertItemProps) {
  const severityStyles: Record<Alert['severity'], string> = {
    red:    'bg-red-50 border-red-300 text-red-800',
    orange: 'bg-orange-50 border-orange-300 text-orange-800',
    yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  }
  const iconColor: Record<Alert['severity'], string> = {
    red:    'text-red-500',
    orange: 'text-orange-500',
    yellow: 'text-yellow-500',
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${severityStyles[alert.severity]}`} role="alert">
      <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor[alert.severity]}`} aria-hidden="true" />
      <p className="text-sm flex-1">{alert.message}</p>
      {alert.batchId && onViewBatch && (
        <button
          type="button"
          onClick={() => onViewBatch(alert.batchId!)}
          className="text-xs font-semibold underline flex-shrink-0"
        >
          View Batch
        </button>
      )}
      {alert.type === 'shortage' && alert.labId && (
        <Link
          href="/admin/purchase-orders"
          className="text-xs font-semibold underline flex-shrink-0"
        >
          Create PO
        </Link>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ManagerDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { error: toastError, warning: toastWarning } = useToast()

  // --- Data state ---
  const [batches, setBatches] = useState<Batch[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [labCapacities, setLabCapacities] = useState<LabCapacity[]>([])

  // --- Loading state ---
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [loadingLabs, setLoadingLabs] = useState(true)
  const [loadingCapacity, setLoadingCapacity] = useState(true)

  // --- Error state ---
  const [batchError, setBatchError] = useState(false)
  const [labError, setLabError] = useState(false)

  // --- UI state ---
  const [detailModal, setDetailModal] = useState<Batch | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForLabId, setCreateForLabId] = useState<string | undefined>(undefined)
  const [lastRefreshed, setLastRefreshed] = useState<number>(Date.now())

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [sessionStatus, router])

  const userRole = session?.user?.role as UserRole | undefined
  const isAuthorized = userRole === 'MANAGER' || userRole === 'ADMIN'

  // ---------------------------------------------------------------------------
  // Fetch functions
  // ---------------------------------------------------------------------------

  const fetchBatches = useCallback(async () => {
    setBatchError(false)
    try {
      const res = await fetch('/api/admin/production/batches?take=100&skip=0')
      if (!res.ok) {
        setBatchError(true)
        return
      }
      const json = await res.json()
      if (json.success) {
        // Fetch up to 200 to have comprehensive data
        if (json.pagination?.total > 100) {
          const res2 = await fetch(`/api/admin/production/batches?take=200&skip=0`)
          const json2 = await res2.json()
          if (json2.success) {
            setBatches(json2.data as Batch[])
            return
          }
        }
        setBatches(json.data as Batch[])
      } else {
        setBatchError(true)
      }
    } catch {
      setBatchError(true)
      toastError({ title: 'Error', message: 'Failed to load batches.' })
    } finally {
      setLoadingBatches(false)
    }
  }, [toastError])

  const fetchLabs = useCallback(async () => {
    setLabError(false)
    try {
      const res = await fetch('/api/admin/labs')
      if (!res.ok) {
        setLabError(true)
        return
      }
      const json = await res.json()
      if (json.success) {
        setLabs(json.data as Lab[])
      } else {
        setLabError(true)
      }
    } catch {
      setLabError(true)
    } finally {
      setLoadingLabs(false)
    }
  }, [])

  const fetchCapacity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/production/lab-capacity')
      if (!res.ok) return
      const json = await res.json()
      if (json.success) {
        setLabCapacities(json.data as LabCapacity[])
      }
    } catch {
      // Non-critical, silently fail
    } finally {
      setLoadingCapacity(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setLoadingBatches(true)
    setLoadingCapacity(true)
    await Promise.all([fetchBatches(), fetchLabs(), fetchCapacity()])
    setLastRefreshed(Date.now())
  }, [fetchBatches, fetchLabs, fetchCapacity])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      void Promise.all([fetchBatches(), fetchCapacity()])
      setLastRefreshed(Date.now())
    }, 60_000)
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [fetchBatches, fetchCapacity])

  // ---------------------------------------------------------------------------
  // Loading / auth guard states
  // ---------------------------------------------------------------------------

  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B4513]" aria-label="Loading..." />
      </div>
    )
  }

  if (sessionStatus === 'authenticated' && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center p-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-2">
          This dashboard is restricted to <strong>Manager</strong> and <strong>Admin</strong> roles only.
        </p>
        <p className="text-sm text-red-600 font-medium mb-6">
          Your current role: <span className="font-bold">{userRole ?? 'Unknown'}</span>
        </p>
        <Link
          href="/worker/dashboard"
          className="px-5 py-2.5 bg-[#8B4513] text-white rounded-lg text-sm font-semibold hover:bg-[#7a3c10] transition-colors"
        >
          Go to Worker Dashboard
        </Link>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Derived / computed data
  // ---------------------------------------------------------------------------

  const isLoading = loadingBatches || loadingLabs || loadingCapacity

  // Build capacity map
  const capacityMap = new Map<string, LabCapacity>(
    labCapacities.map((c) => [c.labId, c])
  )

  // Lab with batches view
  const labsWithBatches: LabWithBatches[] = labs.map((lab) => {
    const labBatches = batches.filter((b) => b.lab.id === lab.id)
    const sorted = [...labBatches].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    return {
      lab,
      capacity: capacityMap.get(lab.id) ?? null,
      recentBatches: sorted.slice(0, 3),
    }
  })

  // Total active labs (at least 1 PLANNED or IN_PROGRESS batch)
  const activeLabCount = labsWithBatches.filter((l) =>
    l.recentBatches.some((b) => b.status === 'PLANNED' || b.status === 'IN_PROGRESS') ||
    (l.capacity?.currentBatches ?? 0) > 0
  ).length

  // On-time completion rate
  const completedBatches = batches.filter(
    (b) => b.status === 'COMPLETED' && b.actualCompletionTime && b.estimatedCompletionTime
  )
  const onTimeBatches = completedBatches.filter(
    (b) => new Date(b.actualCompletionTime!).getTime() <= new Date(b.estimatedCompletionTime!).getTime()
  )
  const onTimeRate = completedBatches.length > 0
    ? Math.round((onTimeBatches.length / completedBatches.length) * 100)
    : null

  // Production efficiency (actual / planned time ratio)
  const batchesWithDurations = completedBatches.filter(
    (b) => b.actualStartTime && b.actualCompletionTime && b.plannedStartTime && b.estimatedCompletionTime
  )
  let efficiencyScore: number | null = null
  if (batchesWithDurations.length > 0) {
    let totalRatio = 0
    for (const b of batchesWithDurations) {
      const actualMins = (new Date(b.actualCompletionTime!).getTime() - new Date(b.actualStartTime!).getTime()) / 60_000
      const plannedMins = (new Date(b.estimatedCompletionTime!).getTime() - new Date(b.plannedStartTime!).getTime()) / 60_000
      if (plannedMins > 0) totalRatio += actualMins / plannedMins
    }
    efficiencyScore = parseFloat((totalRatio / batchesWithDurations.length).toFixed(2))
  }

  // Worker metrics (derived from batch employee data)
  const employeeMap = new Map<string, {
    id: string; name: string; labName: string;
    completedToday: Batch[]; allCompleted: Batch[]
    inProgress: Batch[]
  }>()

  for (const b of batches) {
    if (!b.employee) continue
    const emp = b.employee
    if (!employeeMap.has(emp.id)) {
      employeeMap.set(emp.id, {
        id: emp.id, name: emp.name, labName: b.lab.name,
        completedToday: [], allCompleted: [], inProgress: [],
      })
    }
    const entry = employeeMap.get(emp.id)!
    if (b.status === 'COMPLETED') {
      entry.allCompleted.push(b)
      if (b.actualCompletionTime && isSameDay(b.actualCompletionTime)) {
        entry.completedToday.push(b)
      }
    }
    if (b.status === 'IN_PROGRESS') {
      entry.inProgress.push(b)
    }
  }

  const workerMetrics: WorkerMetric[] = Array.from(employeeMap.values()).map((emp) => {
    const completed = emp.allCompleted.filter(
      (b) => b.estimatedCompletionTime && b.actualCompletionTime
    )
    const onTime = completed.filter(
      (b) => new Date(b.actualCompletionTime!).getTime() <= new Date(b.estimatedCompletionTime!).getTime()
    )
    const onTimePercent = completed.length > 0
      ? Math.round((onTime.length / completed.length) * 100)
      : null

    const withDuration = emp.allCompleted.filter(
      (b) => b.actualStartTime && b.actualCompletionTime
    )
    let avgBatchMinutes: number | null = null
    if (withDuration.length > 0) {
      const total = withDuration.reduce((sum, b) => {
        return sum + (new Date(b.actualCompletionTime!).getTime() - new Date(b.actualStartTime!).getTime()) / 60_000
      }, 0)
      avgBatchMinutes = total / withDuration.length
    }

    const workerStatus: WorkerMetric['status'] = emp.inProgress.length > 0
      ? 'Active'
      : emp.completedToday.length > 0
        ? 'Idle'
        : 'Off-shift'

    return {
      id: emp.id,
      name: emp.name,
      labName: emp.labName,
      batchesCompletedToday: emp.completedToday.length,
      onTimePercent,
      avgBatchMinutes,
      status: workerStatus,
    }
  })

  // Build alerts
  const alerts: Alert[] = []
  const now = Date.now()

  // Delayed batches: IN_PROGRESS past estimated completion
  for (const b of batches) {
    if (b.status === 'IN_PROGRESS' && b.estimatedCompletionTime) {
      const etaMs = new Date(b.estimatedCompletionTime).getTime()
      if (now > etaMs) {
        const delayMs = now - etaMs
        const delayH = Math.floor(delayMs / 3_600_000)
        const delayM = Math.floor((delayMs % 3_600_000) / 60_000)
        const delayStr = delayH > 0 ? `${delayH}h ${delayM}m` : `${delayM}m`
        alerts.push({
          id: `delayed-${b.id}`,
          type: 'delayed',
          severity: 'red',
          message: `Batch ${b.batchNumber} (${b.recipe.name}) in ${b.lab.name} — Delayed by ${delayStr}`,
          batchId: b.id,
          batchNumber: b.batchNumber,
        })
      }
    }
  }

  // Overdue start: PLANNED batches past their planned start
  for (const b of batches) {
    if (b.status === 'PLANNED' && b.plannedStartTime) {
      const startMs = new Date(b.plannedStartTime).getTime()
      if (now > startMs) {
        const overdueMs = now - startMs
        const overdueM = Math.floor(overdueMs / 60_000)
        const overdueH = Math.floor(overdueMs / 3_600_000)
        const label = overdueH > 0 ? `${overdueH}h ${overdueM % 60}m` : `${overdueM}m`
        alerts.push({
          id: `overdue-${b.id}`,
          type: 'overdue-start',
          severity: 'orange',
          message: `Batch ${b.batchNumber} (${b.recipe.name}) in ${b.lab.name} should have started ${label} ago`,
          batchId: b.id,
          batchNumber: b.batchNumber,
        })
      }
    }
  }

  // Material shortage alerts from labs
  for (const lab of labs) {
    if (lab.stockSummary.lowStockCount > 0) {
      alerts.push({
        id: `shortage-${lab.id}`,
        type: 'shortage',
        severity: 'yellow',
        message: `${lab.name} has ${lab.stockSummary.lowStockCount} material${lab.stockSummary.lowStockCount !== 1 ? 's' : ''} at or below minimum threshold`,
        labId: lab.id,
      })
    }
  }

  // Waste / rework quality metric
  const totalBatches = batches.length
  const cancelledBatches = batches.filter((b) => b.status === 'CANCELLED').length
  const wastePercent = totalBatches > 0
    ? parseFloat(((cancelledBatches / totalBatches) * 100).toFixed(1))
    : 0

  // Completed today count
  const completedToday = batches.filter(
    (b) => b.status === 'COMPLETED' && b.actualCompletionTime && isSameDay(b.actualCompletionTime)
  ).length

  // Worker count from batches (unique employees with IN_PROGRESS)
  const activeWorkerCount = new Set(
    batches
      .filter((b) => b.status === 'IN_PROGRESS' && b.employee)
      .map((b) => b.employee!.id)
  ).size

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleViewBatch(batchId: string) {
    const found = batches.find((b) => b.id === batchId)
    if (found) setDetailModal(found)
  }

  function handleOpenCreateForLab(labId: string) {
    setCreateForLabId(labId)
    setShowCreateModal(true)
  }

  function handleBatchCreated() {
    setShowCreateModal(false)
    setCreateForLabId(undefined)
    void refreshAll()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* -------------------------------------------------------------------
          Header
      ------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
            {/* Role badge */}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                userRole === 'ADMIN'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {userRole === 'ADMIN' ? 'Admin' : 'Manager'}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Team metrics, lab oversight, and production alerts.
            <span className="ml-2 text-xs text-gray-400">
              Auto-refreshes every 60s &middot; Last: {new Date(lastRefreshed).toLocaleTimeString()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            aria-label="Refresh all data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => { setCreateForLabId(undefined); setShowCreateModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B4513] text-white rounded-lg text-sm font-semibold hover:bg-[#7a3c10] transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Batch
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          KPI Cards
      ------------------------------------------------------------------- */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {isLoading ? (
            <>
              <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
            </>
          ) : (
            <>
              <KpiCard
                title="Active Labs"
                value={activeLabCount}
                subtitle="Labs with batches in progress"
                icon={<Activity className="w-5 h-5" />}
                gold
              />
              <KpiCard
                title="Active Workers"
                value={activeWorkerCount}
                subtitle="Currently on an IN_PROGRESS batch"
                icon={<Users className="w-5 h-5" />}
              />
              <KpiCard
                title="On-Time Rate"
                value={onTimeRate !== null ? `${onTimeRate}%` : '—'}
                subtitle={`${onTimeBatches.length} / ${completedBatches.length} completed on time`}
                icon={<CheckCircle2 className="w-5 h-5" />}
                alert={onTimeRate !== null && onTimeRate < 70}
              />
              <KpiCard
                title="Efficiency Score"
                value={efficiencyScore !== null ? `${efficiencyScore}x` : '—'}
                subtitle="Actual / planned time ratio (target ≤ 1.0)"
                icon={<TrendingUp className="w-5 h-5" />}
                alert={efficiencyScore !== null && efficiencyScore > 1.2}
                gold={efficiencyScore !== null && efficiencyScore <= 1.0}
              />
            </>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------------------
          Alerts section
      ------------------------------------------------------------------- */}
      {alerts.length > 0 && (
        <section aria-label="Production alerts">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-gray-900">Alerts &amp; Issues</h2>
              <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            </div>
            <div className="p-5 space-y-3">
              {alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onViewBatch={handleViewBatch}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------------
          Lab Activity Overview
      ------------------------------------------------------------------- */}
      <section aria-label="Lab activity overview">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lab Activity</h2>
        {loadingLabs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <LabCardSkeleton /><LabCardSkeleton /><LabCardSkeleton />
          </div>
        ) : labError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            Failed to load lab data.
            <button onClick={() => void fetchLabs()} className="underline font-medium ml-1">Retry</button>
          </div>
        ) : labs.length === 0 ? (
          <p className="text-sm text-gray-500">No labs configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {labsWithBatches.map(({ lab, capacity, recentBatches }) => {
              const current = capacity?.currentBatches ?? 0
              const max = lab.capacity
              const pct = max > 0 ? Math.round((current / max) * 100) : 0

              return (
                <article
                  key={lab.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4"
                  aria-label={`Lab ${lab.name}`}
                >
                  {/* Lab header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{lab.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${labTypeBadge(lab.type)}`}>
                        {lab.type}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${utilizationIndicator(pct)}`}>
                      {pct}%
                    </span>
                  </div>

                  {/* Utilization bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Utilization</span>
                      <span>{current}/{max} batches</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${utilizationColor(pct)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${pct}% capacity used`}
                      />
                    </div>
                  </div>

                  {/* Recent batches */}
                  {recentBatches.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Batches</p>
                      <ul className="space-y-1.5">
                        {recentBatches.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => setDetailModal(b)}
                              className="font-mono font-semibold text-[#8B4513] hover:underline truncate"
                              title={b.batchNumber}
                            >
                              {b.batchNumber}
                            </button>
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium ${statusBadge(b.status)}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50">
                    <Link
                      href="/admin/production/labs"
                      className="flex-1 text-center text-xs font-semibold text-gray-600 hover:text-[#8B4513] border border-gray-200 rounded-lg py-1.5 hover:border-[#8B4513] transition-colors"
                    >
                      View Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateForLab(lab.id)}
                      className="flex-1 text-center text-xs font-semibold text-white bg-[#8B4513] hover:bg-[#7a3c10] rounded-lg py-1.5 transition-colors"
                    >
                      Create Batch
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------------
          Two-column: Pipeline + Status breakdown
      ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pipeline timeline */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Batch Pipeline Timeline</h2>
            <p className="text-xs text-gray-400">Click a block to view batch details</p>
          </div>
          {loadingBatches || loadingLabs ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
            </div>
          ) : (
            <PipelineTimeline
              batches={batches}
              labs={labs}
              onBatchClick={setDetailModal}
            />
          )}
        </div>

        {/* Status breakdown chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {loadingBatches ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-32 bg-gray-100 rounded" />
            </div>
          ) : (
            <StatusBreakdown batches={batches} />
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------
          Team Performance Table
      ------------------------------------------------------------------- */}
      <section aria-label="Team performance">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-gray-900">Team Performance</h2>
            </div>
            <p className="text-xs text-gray-400">{workerMetrics.length} workers tracked</p>
          </div>
          {loadingBatches ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                  <TableRowSkeleton cols={6} />
                </tbody>
              </table>
            </div>
          ) : workerMetrics.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No worker metrics available. Assign employees to batches to track performance.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Team performance metrics">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Worker', 'Lab', 'Completed Today', 'On-Time %', 'Avg Batch Time', 'Status'].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {workerMetrics.map((worker) => (
                    <tr
                      key={worker.id}
                      className="hover:bg-amber-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{worker.name}</td>
                      <td className="px-4 py-3 text-gray-600">{worker.labName}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">
                        {worker.batchesCompletedToday}
                      </td>
                      <td className="px-4 py-3">
                        {worker.onTimePercent !== null ? (
                          <span
                            className={`font-semibold ${
                              worker.onTimePercent >= 90
                                ? 'text-green-600'
                                : worker.onTimePercent >= 70
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {worker.onTimePercent}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {worker.avgBatchMinutes !== null
                          ? formatDuration(worker.avgBatchMinutes)
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            worker.status === 'Active'
                              ? 'bg-green-100 text-green-700'
                              : worker.status === 'Idle'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full inline-block ${
                              worker.status === 'Active'
                                ? 'bg-green-500'
                                : worker.status === 'Idle'
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-400'
                            }`}
                            aria-hidden="true"
                          />
                          {worker.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------------------
          Quality Metrics
      ------------------------------------------------------------------- */}
      <section aria-label="Quality metrics">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Waste / Rework Rate</p>
            <p className={`text-3xl font-bold ${wastePercent > 10 ? 'text-red-600' : 'text-gray-900'}`}>
              {wastePercent}%
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {cancelledBatches} cancelled / {totalBatches} total batches
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Completed Today</p>
            <p className="text-3xl font-bold text-green-600">{completedToday}</p>
            <p className="text-xs text-gray-400 mt-1">
              As of {new Date().toLocaleDateString('en-GB')}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Cycle Time vs Estimate</p>
            <p className={`text-3xl font-bold ${
              efficiencyScore === null
                ? 'text-gray-400'
                : efficiencyScore <= 1.0
                  ? 'text-green-600'
                  : efficiencyScore <= 1.2
                    ? 'text-amber-600'
                    : 'text-red-600'
            }`}>
              {efficiencyScore !== null ? `${efficiencyScore}x` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {efficiencyScore !== null
                ? efficiencyScore <= 1.0
                  ? 'On or ahead of schedule'
                  : 'Above planned time'
                : 'No completed batches with timing data'}
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------
          Recent Batch Activity (scrollable timeline)
      ------------------------------------------------------------------- */}
      <section aria-label="Recent batch activity">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Recent Batch Activity</h2>
          </div>
          {loadingBatches ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No batch activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Recent batch activity">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Batch #', 'Lab', 'Recipe', 'Status', 'Updated', 'Action'].map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...batches]
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    .slice(0, 15)
                    .map((batch) => (
                      <tr key={batch.id} className="hover:bg-amber-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-[#8B4513] bg-amber-50 px-2 py-0.5 rounded">
                            {batch.batchNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{batch.lab.name}</td>
                        <td className="px-4 py-3 text-gray-700 truncate max-w-[160px]" title={batch.recipe.name}>
                          {batch.recipe.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(batch.status)}`}>
                            {batch.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {timeAgo(batch.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailModal(batch)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            aria-label={`View details for batch ${batch.batchNumber}`}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------------------
          Quick links footer
      ------------------------------------------------------------------- */}
      <div className="flex flex-wrap gap-3 pb-4">
        <Link
          href="/admin/production/batches"
          className="text-sm font-medium text-[#8B4513] hover:underline flex items-center gap-1"
        >
          <Clock className="w-4 h-4" aria-hidden="true" />
          All Batches
        </Link>
        <Link
          href="/admin/production/labs"
          className="text-sm font-medium text-[#8B4513] hover:underline flex items-center gap-1"
        >
          <Activity className="w-4 h-4" aria-hidden="true" />
          Manage Labs
        </Link>
        <Link
          href="/admin/production/dashboard"
          className="text-sm font-medium text-[#8B4513] hover:underline flex items-center gap-1"
        >
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          Production Dashboard
        </Link>
        <Link
          href="/admin/purchase-orders"
          className="text-sm font-medium text-[#8B4513] hover:underline flex items-center gap-1"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Purchase Orders
        </Link>
      </div>

      {/* -------------------------------------------------------------------
          Modals
      ------------------------------------------------------------------- */}
      {detailModal && (
        <BatchDetailModal
          batch={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}

      {showCreateModal && (
        <CreateBatchModal
          onClose={() => { setShowCreateModal(false); setCreateForLabId(undefined) }}
          onSuccess={handleBatchCreated}
        />
      )}
    </div>
  )
}
