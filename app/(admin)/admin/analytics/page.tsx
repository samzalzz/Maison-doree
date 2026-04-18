'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Truck,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { KPICard } from '@/components/admin/analytics/KPICard'
import { LineChart } from '@/components/admin/analytics/LineChart'
import { BarChart } from '@/components/admin/analytics/BarChart'
import { PieChart } from '@/components/admin/analytics/PieChart'
import type {
  DailyRevenue,
  OrderTrend,
  TopProduct,
  CustomerMetrics,
  DeliveryMetrics,
} from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatePreset = '7d' | '30d' | 'custom'

interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

interface AnalyticsData {
  revenue: DailyRevenue[]
  orders: OrderTrend[]
  products: TopProduct[]
  customers: CustomerMetrics | null
  delivery: DeliveryMetrics | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subtractDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() - days)
  return result
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('fr-MA')} MAD`
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Sum an array of revenue entries
function totalRevenue(data: DailyRevenue[]): number {
  return data.reduce((sum, d) => sum + d.revenue, 0)
}

// Sum an array of order trend entries
function totalOrders(data: OrderTrend[]): number {
  return data.reduce((sum, d) => sum + d.count, 0)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsDashboard() {
  const today = new Date()

  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customRange, setCustomRange] = useState<DateRange>({
    from: toISODate(subtractDays(today, 30)),
    to: toISODate(today),
  })

  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData>({
    revenue: [],
    orders: [],
    products: [],
    customers: null,
    delivery: null,
  })

  // Resolve effective date range from preset
  const effectiveRange: DateRange = (() => {
    if (preset === '7d') {
      return {
        from: toISODate(subtractDays(today, 7)),
        to: toISODate(today),
      }
    }
    if (preset === '30d') {
      return {
        from: toISODate(subtractDays(today, 30)),
        to: toISODate(today),
      }
    }
    return customRange
  })()

  // ------------------------------------------------------------------
  // Fetch all analytics in parallel
  // ------------------------------------------------------------------
  const fetchAnalytics = useCallback(async (range: DateRange) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        from: new Date(range.from).toISOString(),
        to: new Date(`${range.to}T23:59:59`).toISOString(),
      })

      const [revenueRes, ordersRes, productsRes, customersRes, deliveryRes] =
        await Promise.all([
          fetch(`/api/admin/analytics/revenue?${params}`),
          fetch(`/api/admin/analytics/orders?${params}`),
          fetch(`/api/admin/analytics/products?${params}&limit=8`),
          fetch('/api/admin/analytics/customers'),
          fetch(`/api/admin/analytics/delivery?${params}`),
        ])

      const [revenue, orders, products, customers, delivery] =
        await Promise.all([
          revenueRes.json(),
          ordersRes.json(),
          productsRes.json(),
          customersRes.json(),
          deliveryRes.json(),
        ])

      setData({
        revenue: revenue.success ? (revenue.data as DailyRevenue[]) : [],
        orders: orders.success ? (orders.data as OrderTrend[]) : [],
        products: products.success ? (products.data as TopProduct[]) : [],
        customers: customers.success
          ? (customers.data as CustomerMetrics)
          : null,
        delivery: delivery.success
          ? (delivery.data as DeliveryMetrics)
          : null,
      })
    } catch (err) {
      console.error('[AnalyticsDashboard] fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refetch when effective range changes
  useEffect(() => {
    void fetchAnalytics(effectiveRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customRange.from, customRange.to])

  // ------------------------------------------------------------------
  // Derived KPI values
  // ------------------------------------------------------------------
  const kpiRevenue = totalRevenue(data.revenue)
  const kpiOrders = totalOrders(data.orders)
  const kpiCustomers = data.customers?.total ?? 0
  const kpiOnTime = data.delivery?.onTimePercent ?? 0
  const kpiAvgTime = data.delivery?.avgTimeMinutes ?? 0
  const kpiChurn = data.customers?.churn ?? 0

  // ------------------------------------------------------------------
  // Chart data shapes
  // ------------------------------------------------------------------

  // Revenue line chart — map date → revenue
  const revenueLineData = data.revenue.map((d) => ({
    date: d.date.slice(5), // "MM-DD" for brevity
    revenue: d.revenue,
  }))

  // Orders line chart
  const ordersLineData = data.orders.map((d) => ({
    date: d.date.slice(5),
    orders: d.count,
  }))

  // Top products bar chart
  const topProductsData = data.products.map((p) => ({
    name: p.name.length > 16 ? `${p.name.slice(0, 14)}…` : p.name,
    revenue: Math.round(p.revenue),
    quantity: p.quantity,
  }))

  // Order status pseudo-pie — we only have totals here; use the order trend
  // to build a simple comparison of active vs total for a status overview
  const customerPieData = data.customers
    ? [
        { name: 'Nouveaux (30j)', value: data.customers.newThisMonth },
        {
          name: 'Fidèles',
          value: Math.max(
            0,
            data.customers.total -
              data.customers.newThisMonth -
              data.customers.churn,
          ),
        },
        { name: 'Churned', value: data.customers.churn },
      ].filter((d) => d.value > 0)
    : []

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ---- Page Header ----------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Apercu des performances commerciales et opérationnelles
          </p>
        </div>

        {/* Date range controls */}
        <div className="flex flex-wrap items-center gap-2">
          {(['7d', '30d', 'custom'] as DatePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p
                  ? 'bg-amber-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-400'
              }`}
            >
              {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : 'Personnalisé'}
            </button>
          ))}

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customRange.from}
                max={customRange.to}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, from: e.target.value }))
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-gray-400 text-sm">—</span>
              <input
                type="date"
                value={customRange.to}
                min={customRange.from}
                max={toISODate(today)}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, to: e.target.value }))
                }
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* ---- KPI Cards ------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          label="Chiffre d'affaires"
          value={formatCurrency(kpiRevenue)}
          icon={<TrendingUp size={20} />}
          isLoading={isLoading}
        />
        <KPICard
          label="Commandes"
          value={kpiOrders}
          icon={<ShoppingCart size={20} />}
          isLoading={isLoading}
        />
        <KPICard
          label="Clients total"
          value={kpiCustomers}
          subLabel={`+${data.customers?.newThisMonth ?? 0} ce mois`}
          icon={<Users size={20} />}
          isLoading={isLoading}
        />
        <KPICard
          label="Livraisons à temps"
          value={`${kpiOnTime}%`}
          icon={<Truck size={20} />}
          isLoading={isLoading}
        />
        <KPICard
          label="Temps moy. livraison"
          value={formatMinutes(kpiAvgTime)}
          icon={<Clock size={20} />}
          isLoading={isLoading}
        />
        <KPICard
          label="Clients churned"
          value={kpiChurn}
          subLabel="Inactifs 30 derniers jours"
          icon={<RotateCcw size={20} />}
          isLoading={isLoading}
        />
      </div>

      {/* ---- Charts Row 1: Revenue + Orders -------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Tendance du chiffre d&apos;affaires
          </h2>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Chargement...
            </div>
          ) : revenueLineData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée pour cette période
            </div>
          ) : (
            <LineChart
              data={revenueLineData}
              lines={[{ dataKey: 'revenue', label: 'CA (MAD)', color: '#d97706' }]}
              yTickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tooltipFormatter={(v, n) => [formatCurrency(v), n]}
              height={300}
            />
          )}
        </div>

        {/* Orders Trend */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Tendance des commandes
          </h2>
          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Chargement...
            </div>
          ) : ordersLineData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée pour cette période
            </div>
          ) : (
            <LineChart
              data={ordersLineData}
              lines={[{ dataKey: 'orders', label: 'Commandes', color: '#2563eb' }]}
              yTickFormatter={(v) => String(v)}
              height={300}
            />
          )}
        </div>
      </div>

      {/* ---- Charts Row 2: Top Products + Customer Cohorts ------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Produits les plus vendus
          </h2>
          {isLoading ? (
            <div className="h-[320px] flex items-center justify-center text-gray-400 text-sm">
              Chargement...
            </div>
          ) : topProductsData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée pour cette période
            </div>
          ) : (
            <BarChart
              data={topProductsData}
              bars={[{ dataKey: 'revenue', label: 'CA (MAD)', color: '#d97706' }]}
              layout="vertical"
              height={320}
              yTickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tooltipFormatter={(v, n) => [formatCurrency(v), n]}
            />
          )}
        </div>

        {/* Customer Cohorts Pie */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Cohortes clients
          </h2>
          {isLoading ? (
            <div className="h-[320px] flex items-center justify-center text-gray-400 text-sm">
              Chargement...
            </div>
          ) : customerPieData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-gray-400 text-sm">
              Aucune donnée disponible
            </div>
          ) : (
            <>
              <PieChart
                data={customerPieData}
                height={260}
                innerRadius="40%"
                tooltipFormatter={(v, n) => [v.toLocaleString(), n]}
              />
              {/* Stats table under the pie */}
              {data.customers && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-700 font-medium">Répétiteurs</p>
                    <p className="text-lg font-bold text-amber-900">
                      {data.customers.repeat}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-50 px-3 py-2">
                    <p className="text-xs text-blue-700 font-medium">Nouveaux (30j)</p>
                    <p className="text-lg font-bold text-blue-900">
                      {data.customers.newThisMonth}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ---- Delivery Metrics Summary Row ----------------------- */}
      {!isLoading && data.delivery && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Métriques de livraison — période sélectionnée
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {data.delivery.onTimePercent}%
              </p>
              <p className="text-sm text-gray-500 mt-1">Livraisons à temps</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">
                {formatMinutes(data.delivery.avgTimeMinutes)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Durée moyenne</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {data.customers?.repeat ?? 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">Clients fidèles</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">
                {data.customers?.churn ?? 0}
              </p>
              <p className="text-sm text-gray-500 mt-1">Clients churned</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
