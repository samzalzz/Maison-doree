'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ForecastResponse } from '@/lib/types-production'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse {
  success: boolean
  data?: ForecastResponse[]
  error?: { code: string; message: string }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function confidenceBadge(confidence: number): { label: string; className: string } {
  if (confidence === 0) return { label: 'No data', className: 'bg-gray-100 text-gray-500' }
  if (confidence < 50) return { label: `${confidence}% Low`, className: 'bg-red-100 text-red-700' }
  if (confidence < 80)
    return { label: `${confidence}% Medium`, className: 'bg-yellow-100 text-yellow-700' }
  return { label: `${confidence}% High`, className: 'bg-green-100 text-green-700' }
}

// ---------------------------------------------------------------------------
// Derived insight helpers
// ---------------------------------------------------------------------------

interface RecipeSummary {
  id: string
  name: string
  predicted: number
  avg7: number
  avg30: number
  confidence: number
}

function buildRecipeSummaries(data: ForecastResponse[]): RecipeSummary[] {
  const map = new Map<string, RecipeSummary>()
  for (const row of data) {
    if (!map.has(row.recipeId)) {
      map.set(row.recipeId, {
        id: row.recipeId,
        name: row.recipe.name,
        predicted: row.predictedQuantity,
        avg7: row.sevenDayAverage ?? 0,
        avg30: row.thirtyDayAverage ?? 0,
        confidence: row.confidence,
      })
    }
  }
  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForecastPage() {
  const [days, setDays] = useState<7 | 14 | 30>(7)
  const [data, setData] = useState<ForecastResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // ------------------------------------------------------------------
  // Fetch
  // ------------------------------------------------------------------

  const fetchForecast = useCallback(
    async (forecastDays: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/production/forecast?days=${forecastDays}`)
        const json: ApiResponse = await res.json()
        if (!json.success || !json.data) {
          setError(json.error?.message ?? 'Failed to load forecast data.')
          setData([])
        } else {
          setData(json.data)
          setLastRefreshed(new Date())
        }
      } catch {
        setError('Network error. Please try again.')
        setData([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    fetchForecast(days)
  }, [days, fetchForecast])

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------

  const summaries = buildRecipeSummaries(data)

  const trendingUp = summaries.filter(
    (s) => s.confidence > 0 && s.avg7 > 0 && s.avg30 > 0 && s.avg7 > s.avg30,
  )
  const trendingDown = summaries.filter(
    (s) => s.confidence > 0 && s.avg7 > 0 && s.avg30 > 0 && s.avg7 < s.avg30,
  )
  const highDemand = summaries.filter((s) => s.confidence >= 90 && s.predicted >= 30)

  const suggestionItems = summaries
    .filter((s) => s.confidence > 0 && s.predicted > 0)
    .sort((a, b) => b.predicted - a.predicted)

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const avgCell = (val: number | null | undefined) =>
    val != null ? val : <span className="text-gray-300">—</span>

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demand Forecasting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Rolling-average predictions based on completed production batches
            {lastRefreshed && (
              <> &middot; refreshed {lastRefreshed.toLocaleTimeString()}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-medium">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 transition-colors ${
                  days === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchForecast(days)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            ) : null}
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>

          <Link
            href="/admin/production/dashboard"
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error banner                                                         */}
      {/* ------------------------------------------------------------------ */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Forecast table                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Forecast — Next {days} Days
          </h2>
        </div>

        {loading && data.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Loading forecasts…
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No forecast data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Recipe</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-right">7-Day Avg</th>
                  <th className="px-6 py-3 text-right">14-Day Avg</th>
                  <th className="px-6 py-3 text-right">30-Day Avg</th>
                  <th className="px-6 py-3 text-right">Predicted</th>
                  <th className="px-6 py-3 text-left">Confidence</th>
                  <th className="px-6 py-3 text-left">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, idx) => {
                  const badge = confidenceBadge(row.confidence)
                  return (
                    <tr
                      key={`${row.recipeId}-${String(row.date)}`}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    >
                      <td className="px-6 py-3 font-medium text-gray-800">
                        {row.recipe.name}
                      </td>
                      <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">
                        {avgCell(row.sevenDayAverage)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">
                        {avgCell(row.fourteenDayAverage)}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">
                        {avgCell(row.thirtyDayAverage)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">
                        {row.predictedQuantity}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs max-w-xs truncate">
                        {row.reasoning ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Insights section                                                     */}
      {/* ------------------------------------------------------------------ */}
      {!loading && summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Trending Up */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Trending Up
            </h3>
            {trendingUp.length === 0 ? (
              <p className="text-xs text-gray-400">No recipes trending up.</p>
            ) : (
              <ul className="space-y-2">
                {trendingUp.map((r) => (
                  <li key={r.id} className="flex justify-between text-sm">
                    <span className="text-gray-800 font-medium">{r.name}</span>
                    <span className="text-green-600 font-semibold">
                      {r.avg7} vs {r.avg30}/day
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Trending Down */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              Trending Down
            </h3>
            {trendingDown.length === 0 ? (
              <p className="text-xs text-gray-400">No recipes trending down.</p>
            ) : (
              <ul className="space-y-2">
                {trendingDown.map((r) => (
                  <li key={r.id} className="flex justify-between text-sm">
                    <span className="text-gray-800 font-medium">{r.name}</span>
                    <span className="text-red-600 font-semibold">
                      {r.avg7} vs {r.avg30}/day
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* High Demand */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              High Demand (90%+ confidence, 30+/day)
            </h3>
            {highDemand.length === 0 ? (
              <p className="text-xs text-gray-400">No high-demand recipes.</p>
            ) : (
              <ul className="space-y-2">
                {highDemand.map((r) => (
                  <li key={r.id} className="flex justify-between text-sm">
                    <span className="text-gray-800 font-medium">{r.name}</span>
                    <span className="text-blue-600 font-semibold">{r.predicted}/day</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Suggestion box                                                       */}
      {/* ------------------------------------------------------------------ */}
      {!loading && suggestionItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            Production Recommendation
          </h3>
          <p className="text-sm text-blue-700">
            Based on forecasts, recommend producing:{' '}
            {suggestionItems
              .map((r) => `${r.name}: ${r.predicted}/day`)
              .join(', ')}
            .
          </p>
        </div>
      )}
    </div>
  )
}
