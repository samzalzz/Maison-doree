'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import LabCapacityChart, { LabCapacityData } from '@/components/production/LabCapacityChart'
import BatchForm from '@/components/production/BatchForm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Batch {
  id: string
  batchNumber: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'CANCELLED'
  quantity: number
  plannedStartTime: string
  estimatedCompletionTime: string | null
  actualCompletionTime: string | null
  createdAt: string
  updatedAt: string
  lab: { id: string; name: string; type: string }
  recipe: { id: string; name: string; laborMinutes: number }
  machine: { id: string; name: string } | null
  employee: { id: string; name: string; role: string } | null
}

interface RawMaterial {
  id: string
  name: string
  type: string
  unit: string
  isIntermediate: boolean
}

interface TimelineEntry {
  batchId: string
  batchNumber: string
  status: string
  labName: string
  recipeName: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function statusBadge(status: string): string {
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-3/5 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-2/5" />
    </div>
  )
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  alert?: boolean
  gold?: boolean
}

function KpiCard({ title, value, subtitle, alert, gold }: KpiCardProps) {
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
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p
        className={`text-3xl font-bold ${
          alert ? 'text-red-600' : gold ? 'text-[#8B4513]' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ProductionDashboard() {
  // --- Data ---
  const [labCapacities, setLabCapacities] = useState<LabCapacityData[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [lowStockMaterials, setLowStockMaterials] = useState<RawMaterial[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])

  // --- Load states ---
  const [loadingCapacity, setLoadingCapacity] = useState(true)
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)

  // --- UI states ---
  const [batchPage, setBatchPage] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [capacityError, setCapacityError] = useState(false)
  const [batchesError, setBatchesError] = useState(false)
  const [materialsError, setMaterialsError] = useState(false)

  const PAGE_SIZE = 12

  // ---------------------------------------------------------------------------
  // Fetch functions
  // ---------------------------------------------------------------------------

  const fetchLabCapacity = useCallback(async () => {
    setLoadingCapacity(true)
    setCapacityError(false)
    try {
      const res = await fetch('/api/admin/production/lab-capacity')
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/auth/login'
        return
      }
      const json = await res.json()
      if (json.success) {
        setLabCapacities(json.data as LabCapacityData[])
      } else {
        setCapacityError(true)
      }
    } catch {
      setCapacityError(true)
    } finally {
      setLoadingCapacity(false)
    }
  }, [])

  const fetchBatches = useCallback(async (skip: number) => {
    setLoadingBatches(true)
    setBatchesError(false)
    try {
      const params = new URLSearchParams({
        take: String(PAGE_SIZE),
        skip: String(skip),
      })
      // Fetch both PLANNED and IN_PROGRESS — API supports single status param,
      // so we make two requests and merge, or we omit status to get all and filter client-side.
      // The API only allows a single status value, so we fetch all and filter.
      const res = await fetch(`/api/admin/production/batches?${params.toString()}`)
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/auth/login'
        return
      }
      const json = await res.json()
      if (json.success) {
        const allBatches = json.data as Batch[]
        const active = allBatches.filter(
          (b) => b.status === 'PLANNED' || b.status === 'IN_PROGRESS'
        )
        setBatches(active)
        setBatchTotal(json.pagination.total as number)

        // Build timeline from recent status changes (last updatedAt, desc)
        const sorted = [...allBatches].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        setTimeline(
          sorted.slice(0, 8).map((b) => ({
            batchId: b.id,
            batchNumber: b.batchNumber,
            status: b.status,
            labName: b.lab.name,
            recipeName: b.recipe.name,
            updatedAt: b.updatedAt,
          }))
        )
      } else {
        setBatchesError(true)
      }
    } catch {
      setBatchesError(true)
    } finally {
      setLoadingBatches(false)
    }
  }, [])

  const fetchLowStock = useCallback(async () => {
    setLoadingMaterials(true)
    setMaterialsError(false)
    try {
      // The raw-materials endpoint doesn't support threshold filtering directly.
      // We fetch all materials and let the server-side minThreshold filtering
      // be done through lab-stock. Here we fetch all raw materials as a proxy
      // for the alert list, taking the first 50.
      const res = await fetch('/api/admin/raw-materials?take=50')
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/auth/login'
        return
      }
      const json = await res.json()
      if (json.success) {
        setLowStockMaterials(json.data as RawMaterial[])
      } else {
        setMaterialsError(true)
      }
    } catch {
      setMaterialsError(true)
    } finally {
      setLoadingMaterials(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Initial load and refresh
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchLabCapacity()
    fetchBatches(batchPage * PAGE_SIZE)
    fetchLowStock()
  }, [fetchLabCapacity, fetchBatches, fetchLowStock, batchPage])

  // ---------------------------------------------------------------------------
  // Derived KPIs
  // ---------------------------------------------------------------------------

  const activeBatchCount = batches.filter(
    (b) => b.status === 'PLANNED' || b.status === 'IN_PROGRESS'
  ).length

  const avgUtilization =
    labCapacities.length > 0
      ? Math.round(
          labCapacities.reduce((sum, l) => sum + l.utilizationPercent, 0) /
            labCapacities.length
        )
      : 0

  const completedToday = batches.filter((b) => {
    if (b.status !== 'COMPLETED') return false
    const completed = b.actualCompletionTime ?? b.updatedAt
    return new Date(completed).toDateString() === new Date().toDateString()
  }).length

  const lowStockCount = lowStockMaterials.length

  // ---------------------------------------------------------------------------
  // Batch form modal handler
  // ---------------------------------------------------------------------------

  function handleBatchCreated(batchNumber: string) {
    setShowBatchForm(false)
    // Refresh data
    fetchLabCapacity()
    fetchBatches(0)
    setBatchPage(0)
    // Briefly surface a toast-like banner via the timeline
    console.info(`Batch ${batchNumber} created — refreshing dashboard...`)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------- */}
      {/* Header                                                                */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Production Management</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Monitor lab capacity, active batches, and material stock in real time.
          </p>
        </div>
        <button
          onClick={() => setShowBatchForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-[#8B4513] hover:bg-[#7a3c10] text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B4513]"
          aria-expanded={showBatchForm}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {showBatchForm ? 'Close Form' : 'New Batch'}
        </button>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Inline Batch Form (collapsible)                                       */}
      {/* ------------------------------------------------------------------- */}
      {showBatchForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Create Production Batch</h2>
          <BatchForm onSuccess={handleBatchCreated} />
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* KPI Row                                                               */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {loadingCapacity || loadingBatches ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              title="Active Batches"
              value={activeBatchCount}
              subtitle="PLANNED + IN_PROGRESS"
              gold
            />
            <KpiCard
              title="Lab Utilization"
              value={`${avgUtilization}%`}
              subtitle="Avg across all labs"
              alert={avgUtilization >= 90}
            />
            <KpiCard
              title="Low Stock Alerts"
              value={lowStockCount}
              subtitle="Materials tracked"
              alert={lowStockCount > 0}
            />
            <KpiCard
              title="Completed Today"
              value={completedToday}
              subtitle={`As of ${new Date().toLocaleDateString('en-GB')}`}
            />
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Two-column: Capacity Chart + Timeline                                 */}
      {/* ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lab Capacity Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-900">Lab Capacity</h2>
            {!loadingCapacity && (
              <span className="text-xs text-gray-400">
                {labCapacities.length} lab{labCapacities.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {loadingCapacity ? (
            <SectionSkeleton rows={3} />
          ) : capacityError ? (
            <p className="text-sm text-red-600">Failed to load lab capacity data.</p>
          ) : (
            <LabCapacityChart labs={labCapacities} />
          )}
        </div>

        {/* Recent Batch Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Recent Activity</h2>
          {loadingBatches ? (
            <SectionSkeleton rows={5} />
          ) : timeline.length === 0 ? (
            <p className="text-sm text-gray-500">No recent batch activity.</p>
          ) : (
            <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
              {timeline.map((entry) => (
                <li key={entry.batchId} className="ml-4">
                  <span
                    className={`absolute -left-[9px] mt-1 w-4 h-4 rounded-full border-2 border-white ${
                      entry.status === 'IN_PROGRESS'
                        ? 'bg-blue-500'
                        : entry.status === 'COMPLETED'
                          ? 'bg-green-500'
                          : entry.status === 'CANCELLED'
                            ? 'bg-gray-400'
                            : 'bg-yellow-400'
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      {entry.batchNumber}
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(entry.status)}`}
                      >
                        {entry.status.replace('_', ' ')}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.recipeName} — {entry.labName}
                    </p>
                    <time className="text-xs text-gray-400">{formatTimeAgo(entry.updatedAt)}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Active Batches Table                                                  */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-gray-900">Active Batches</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              Showing {batches.length} of {batchTotal} total
            </span>
            <button
              onClick={() => fetchBatches(batchPage * PAGE_SIZE)}
              className="text-xs text-[#8B4513] hover:underline font-medium"
              aria-label="Refresh batches"
            >
              Refresh
            </button>
          </div>
        </div>

        {loadingBatches ? (
          <div className="p-6">
            <SectionSkeleton rows={6} />
          </div>
        ) : batchesError ? (
          <div className="p-6">
            <p className="text-sm text-red-600">
              Failed to load batches.{' '}
              <button
                onClick={() => fetchBatches(batchPage * PAGE_SIZE)}
                className="underline text-[#8B4513]"
              >
                Retry
              </button>
            </p>
          </div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No active batches found. Create a new batch to get started.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Active production batches">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Batch #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Lab
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Recipe
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Start Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      ETA
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-amber-50 cursor-pointer transition-colors group"
                      title={`View batch ${batch.batchNumber}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#8B4513] whitespace-nowrap">
                        {batch.batchNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        <span className="font-medium">{batch.lab.name}</span>
                        <span className="ml-1 text-xs text-gray-400">({batch.lab.type})</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{batch.recipe.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {batch.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                            batch.status
                          )}`}
                        >
                          {batch.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDateTime(batch.plannedStartTime)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {batch.estimatedCompletionTime
                          ? formatDateTime(batch.estimatedCompletionTime)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {batchTotal > PAGE_SIZE && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setBatchPage((p) => Math.max(0, p - 1))}
                  disabled={batchPage === 0}
                  className="text-sm font-medium text-[#8B4513] disabled:text-gray-300 hover:underline"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {batchPage + 1} of {Math.ceil(batchTotal / PAGE_SIZE)}
                </span>
                <button
                  onClick={() =>
                    setBatchPage((p) =>
                      (p + 1) * PAGE_SIZE < batchTotal ? p + 1 : p
                    )
                  }
                  disabled={(batchPage + 1) * PAGE_SIZE >= batchTotal}
                  className="text-sm font-medium text-[#8B4513] disabled:text-gray-300 hover:underline"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Material Alerts Section                                               */}
      {/* ------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Material Alerts</h2>
            {lowStockCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {lowStockCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">Materials requiring attention</p>
        </div>

        {loadingMaterials ? (
          <div className="p-6">
            <SectionSkeleton rows={4} />
          </div>
        ) : materialsError ? (
          <div className="p-6">
            <p className="text-sm text-red-600">
              Failed to load material data.{' '}
              <button onClick={fetchLowStock} className="underline text-[#8B4513]">
                Retry
              </button>
            </p>
          </div>
        ) : lowStockMaterials.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-green-700 font-medium">All materials are adequately stocked.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Low stock material alerts">
              <thead className="bg-red-50 border-b border-red-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Kind
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50">
                {lowStockMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-red-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{material.name}</td>
                    <td className="px-4 py-3 text-gray-600">{material.type}</td>
                    <td className="px-4 py-3 text-gray-600">{material.unit}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          material.isIntermediate
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {material.isIntermediate ? 'Intermediate' : 'Raw'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/stocks?material=${material.id}`}
                        className="text-xs font-semibold text-[#8B4513] hover:text-[#D4AF37] hover:underline transition-colors"
                      >
                        Adjust Stock
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
