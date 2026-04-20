'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useToast } from '@/lib/hooks/useToast'
import { PaginationControls } from '@/components/ui/PaginationControls'
import BatchForm from '@/components/production/BatchForm'
import type { ForecastResponse } from '@/lib/types-production'
import {
  RefreshCw,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

/** Palette used to assign a distinct colour to each recipe in the chart. */
const RECIPE_COLORS = [
  '#8B4513',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
  '#ea580c',
  '#6366f1',
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse {
  success: boolean
  data?: ForecastResponse[]
  error?: { code: string; message: string }
}

/** Shape of each data point fed to recharts. */
interface ChartPoint {
  date: string
  [recipeName: string]: string | number
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

/** Confidence is stored as 0–100 integer in the API. */
function confidenceInfo(confidence: number): {
  label: string
  badgeClass: string
  level: 'high' | 'medium' | 'low' | 'none'
} {
  if (confidence === 0)
    return { label: 'No data', badgeClass: 'bg-gray-100 text-gray-500', level: 'none' }
  if (confidence >= 80)
    return { label: `${confidence}% High`, badgeClass: 'bg-green-100 text-green-700', level: 'high' }
  if (confidence >= 50)
    return {
      label: `${confidence}% Medium`,
      badgeClass: 'bg-yellow-100 text-yellow-700',
      level: 'medium',
    }
  return { label: `${confidence}% Low`, badgeClass: 'bg-red-100 text-red-700', level: 'low' }
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-3/5 mb-4" />
      <div className="h-8 bg-gray-200 rounded w-2/5 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-4/5" />
    </div>
  )
}

function TableSkeleton({ rows = PAGE_SIZE }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-64 flex items-end gap-1 px-4 pb-4 animate-pulse">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-gray-200 rounded-t"
          style={{ height: `${20 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode
  title: string
  value: string | number
  subtitle?: string
  accent?: 'blue' | 'green' | 'amber' | 'brand'
}

function KpiCard({ icon, title, value, subtitle, accent = 'brand' }: KpiCardProps) {
  const accentMap = {
    brand: 'border-l-[#8B4513] text-[#8B4513] bg-amber-50',
    blue: 'border-l-blue-500 text-blue-600 bg-blue-50',
    green: 'border-l-green-500 text-green-700 bg-green-50',
    amber: 'border-l-amber-500 text-amber-700 bg-amber-50',
  }
  const valueColor = {
    brand: 'text-gray-900',
    blue: 'text-blue-700',
    green: 'text-green-700',
    amber: 'text-amber-700',
  }

  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 border-l-4 shadow-sm p-6 flex flex-col gap-2 ${accentMap[accent]}`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-1">{title}</p>
      <p className={`text-3xl font-bold ${valueColor[accent]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Batch Modal — wraps BatchForm with recipe/quantity pre-filled
// ---------------------------------------------------------------------------

interface ScheduleBatchModalProps {
  recipeId: string
  recipeName: string
  quantity: number
  onClose: () => void
  onSuccess: () => void
}

function ScheduleBatchModal({
  recipeId,
  recipeName,
  quantity,
  onClose,
  onSuccess,
}: ScheduleBatchModalProps) {
  const { success: toastSuccess } = useToast()

  function handleSuccess(batchNumber: string) {
    toastSuccess({
      title: 'Batch Scheduled',
      message: `${recipeName} batch #${batchNumber} has been created.`,
    })
    onSuccess()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-batch-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 id="schedule-batch-modal-title" className="text-xl font-bold text-gray-900">
              Schedule Production Batch
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Pre-filled from forecast: {recipeName} &mdash; {quantity} units predicted
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Forecast context banner */}
        <div className="mx-6 mt-4 mb-0 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <span className="font-semibold">Forecast suggestion:</span> Produce{' '}
          <span className="font-bold">{quantity} units</span> of{' '}
          <span className="font-bold">{recipeName}</span>. Select a lab and start time below.
        </div>

        {/* BatchForm renders inside the modal — no outer wrapper needed */}
        <BatchForm onSuccess={handleSuccess} onClose={onClose} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom recharts tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function CustomChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600 truncate max-w-[100px]">{item.name}</span>
          </span>
          <span className="font-bold text-gray-900">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ForecastPage() {
  const { error: toastError } = useToast()

  // --- Data state ---
  const [days, setDays] = useState<7 | 14 | 30>(7)
  const [data, setData] = useState<ForecastResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // --- Pagination state ---
  const [page, setPage] = useState(1)

  // --- Schedule batch modal state ---
  const [schedulingForecast, setSchedulingForecast] = useState<{
    recipeId: string
    recipeName: string
    quantity: number
  } | null>(null)

  // Auto-refresh interval ref
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch forecast data
  // ---------------------------------------------------------------------------

  const fetchForecast = useCallback(
    async (forecastDays: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/production/forecast?days=${forecastDays}`)

        if (res.status === 401 || res.status === 403) {
          window.location.href = '/auth/login'
          return
        }

        const json: ApiResponse = await res.json()

        if (!json.success || !json.data) {
          const msg = json.error?.message ?? 'Failed to load forecast data.'
          setError(msg)
          toastError({ title: 'Forecast Error', message: msg })
          setData([])
        } else {
          setData(json.data)
          setLastRefreshed(new Date())
          setPage(1)
        }
      } catch {
        const msg = 'Network error. Please check your connection and try again.'
        setError(msg)
        toastError({ title: 'Network Error', message: msg })
        setData([])
      } finally {
        setLoading(false)
      }
    },
    [toastError],
  )

  // Initial load + re-fetch when days selector changes
  useEffect(() => {
    fetchForecast(days)
  }, [days, fetchForecast])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchForecast(days)
    }, 60_000)

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [days, fetchForecast])

  // Reset to page 1 when data changes
  useEffect(() => {
    setPage(1)
  }, [data])

  // ---------------------------------------------------------------------------
  // Derived KPIs
  // ---------------------------------------------------------------------------

  const totalUnits = useMemo(
    () => data.reduce((sum, row) => sum + row.predictedQuantity, 0),
    [data],
  )

  const uniqueRecipes = useMemo(
    () => new Set(data.map((row) => row.recipeId)).size,
    [data],
  )

  const highConfidenceCount = useMemo(
    () => data.filter((row) => row.confidence >= 80).length,
    [data],
  )

  // ---------------------------------------------------------------------------
  // Chart data — pivot rows into { date, recipe1: qty, recipe2: qty, ... }
  // ---------------------------------------------------------------------------

  const { chartData, recipeNames, recipeColorMap } = useMemo(() => {
    // Collect unique recipe names in the order they appear
    const recipeNamesSet: string[] = []
    const recipeNamesMap = new Map<string, string>() // recipeId -> name
    for (const row of data) {
      if (!recipeNamesMap.has(row.recipeId)) {
        recipeNamesMap.set(row.recipeId, row.recipe.name)
        recipeNamesSet.push(row.recipe.name)
      }
    }

    // Assign colours
    const recipeColorMap: Record<string, string> = {}
    recipeNamesSet.forEach((name, idx) => {
      recipeColorMap[name] = RECIPE_COLORS[idx % RECIPE_COLORS.length]
    })

    // Group by date
    const byDate = new Map<string, ChartPoint>()
    for (const row of data) {
      // API returns dates as ISO strings over JSON; the type says Date but at runtime it's a string.
      const rawDate = row.date as unknown as string | Date
      const dateKey =
        typeof rawDate === 'string'
          ? rawDate.slice(0, 10)
          : rawDate.toISOString().slice(0, 10)
      const label = formatShortDate(dateKey)

      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { date: label })
      }

      const point = byDate.get(dateKey)!
      point[row.recipe.name] = row.predictedQuantity
    }

    const chartData = Array.from(byDate.values())

    return { chartData, recipeNames: recipeNamesSet, recipeColorMap }
  }, [data])

  // ---------------------------------------------------------------------------
  // Table data — sorted by date asc, paginated
  // ---------------------------------------------------------------------------

  const sortedData = useMemo(
    () =>
      [...data].sort((a, b) => {
        const rawA = a.date as unknown as string | Date
        const rawB = b.date as unknown as string | Date
        const aTime = typeof rawA === 'string' ? new Date(rawA).getTime() : rawA.getTime()
        const bTime = typeof rawB === 'string' ? new Date(rawB).getTime() : rawB.getTime()
        return aTime - bTime
      }),
    [data],
  )

  const totalPages = Math.max(1, Math.ceil(sortedData.length / PAGE_SIZE))
  const pageData = sortedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Forecast</h1>
          <p className="text-sm text-gray-500 mt-1">
            7-day demand predictions by recipe
            {lastRefreshed && (
              <> &middot; refreshed {lastRefreshed.toLocaleTimeString()}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-medium">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-4 py-2 transition-colors ${
                  days === d
                    ? 'bg-[#8B4513] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                aria-pressed={days === d}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchForecast(days)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#8B4513] text-white text-sm font-medium rounded-lg hover:bg-[#7a3c10] disabled:opacity-50 transition-colors"
            aria-label="Refresh forecast data"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error banner                                                         */}
      {/* ------------------------------------------------------------------ */}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-3"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold">Failed to load forecast data</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchForecast(days)}
            className="text-red-700 hover:text-red-900 font-semibold underline text-sm flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && data.length === 0 ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
              title="Total Units Forecasted"
              value={totalUnits.toLocaleString()}
              subtitle={`Across next ${days} days`}
              accent="brand"
            />
            <KpiCard
              icon={<BarChart2 className="w-4 h-4" aria-hidden="true" />}
              title="Recipes with Forecasts"
              value={uniqueRecipes}
              subtitle="Active recipe predictions"
              accent="blue"
            />
            <KpiCard
              icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
              title="High Confidence Forecasts"
              value={highConfidenceCount}
              subtitle="Confidence score above 80%"
              accent="green"
            />
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Forecast Timeline Chart                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
          <h2 className="text-base font-semibold text-gray-800">
            Demand Forecast — Next {days} Days
          </h2>
        </div>

        <div className="p-4">
          {loading && data.length === 0 ? (
            <ChartSkeleton />
          ) : data.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              No forecast data to display.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  {recipeNames.map((name) => (
                    <linearGradient
                      key={name}
                      id={`gradient-${name.replace(/\s+/g, '-')}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={recipeColorMap[name]}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={recipeColorMap[name]}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  iconType="square"
                />
                {recipeNames.map((name) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={recipeColorMap[name]}
                    strokeWidth={2}
                    fill={`url(#gradient-${name.replace(/\s+/g, '-')})`}
                    dot={{ r: 3, strokeWidth: 1.5, fill: recipeColorMap[name] }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Forecast Details Table                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Forecast Details</h2>
          {!loading && sortedData.length > 0 && (
            <span className="text-xs text-gray-400">
              {sortedData.length} prediction{sortedData.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Empty state */}
        {!loading && data.length === 0 && !error && (
          <div className="p-16 text-center">
            <BarChart2
              className="w-12 h-12 text-gray-200 mx-auto mb-4"
              aria-hidden="true"
            />
            <p className="text-base font-medium text-gray-700">No forecasts available</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              Check back after production history builds. Forecasts are generated
              automatically from completed batch data.
            </p>
          </div>
        )}

        {/* Table */}
        {(loading || data.length > 0) && (
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label="Demand forecast details"
            >
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Date', 'Recipe', 'Predicted Qty', 'Confidence', 'Reasoning', 'Action'].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                          col === 'Predicted Qty' || col === 'Action'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading && data.length === 0 ? (
                  <TableSkeleton rows={Math.min(PAGE_SIZE, 8)} />
                ) : (
                  pageData.map((row, idx) => {
                    const rawRowDate = row.date as unknown as string | Date
                    const dateStr =
                      typeof rawRowDate === 'string'
                        ? rawRowDate
                        : rawRowDate.toISOString()
                    const badge = confidenceInfo(row.confidence)

                    return (
                      <tr
                        key={`${row.recipeId}-${dateStr}-${idx}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Date */}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {formatDate(dateStr)}
                        </td>

                        {/* Recipe */}
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.recipe.name}
                        </td>

                        {/* Predicted Qty */}
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          {row.predictedQuantity > 0 ? (
                            row.predictedQuantity.toLocaleString()
                          ) : (
                            <span className="text-gray-400 font-normal">—</span>
                          )}
                        </td>

                        {/* Confidence Badge */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Reasoning */}
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                          {row.reasoning ?? '—'}
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3 text-right">
                          {row.predictedQuantity > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSchedulingForecast({
                                  recipeId: row.recipeId,
                                  recipeName: row.recipe.name,
                                  quantity: row.predictedQuantity,
                                })
                              }
                              className="inline-flex items-center px-3 py-1.5 bg-[#8B4513] text-white text-xs font-semibold rounded-lg hover:bg-[#7a3c10] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#8B4513] whitespace-nowrap"
                            >
                              Schedule Batch
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 italic">No data</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Schedule Batch Modal                                                 */}
      {/* ------------------------------------------------------------------ */}
      {schedulingForecast && (
        <ScheduleBatchModal
          recipeId={schedulingForecast.recipeId}
          recipeName={schedulingForecast.recipeName}
          quantity={schedulingForecast.quantity}
          onClose={() => setSchedulingForecast(null)}
          onSuccess={() => {
            setSchedulingForecast(null)
          }}
        />
      )}
    </div>
  )
}
