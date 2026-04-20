# Production Management UI Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build complete admin and worker UI pages for production batch management, lab control, and demand forecasting with full error handling and real-time data refresh.

**Architecture:** Client-side React components using fetch-based data loading with 30-60s auto-refresh. Each page handles its own API requests, error states, and loading states. Modal dialogs for CRUD operations. Role-based access control enforced by API (UI shows 403 errors gracefully). All pages follow existing supplier page patterns for consistency.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, lucide-react icons, useToast hook for notifications.

---

## File Structure Overview

### New Files (UI Pages)
- `app/(admin)/admin/production/labs/page.tsx` - Lab management dashboard
- `app/(admin)/admin/production/recipes/page.tsx` - Recipe management dashboard  
- `app/(admin)/admin/production/batches/page.tsx` - Batch creation + list
- `app/(admin)/admin/production/forecast/page.tsx` - Demand forecast visualization
- `app/(worker)/worker/dashboard/page.tsx` - Update existing worker dashboard
- `app/(admin)/admin/production/manager/page.tsx` - Manager overview dashboard

### Modified Files
- `app/(admin)/admin/production/dashboard/page.tsx` - Complete implementation (currently skeleton)
- `components/production/BatchForm.tsx` - Complete batch creation form
- `components/production/LabCapacityChart.tsx` - Lab utilization chart
- `components/production/MaterialAlerts.tsx` - Low stock alerts

### API Endpoints (Already Exist)
- `GET /api/admin/production/batches` - List batches
- `POST /api/admin/production/batches` - Create batch with validation
- `PATCH /api/admin/production/batches/[id]` - Update batch status
- `GET /api/admin/production/lab-capacity` - Lab utilization data
- `GET /api/admin/production/forecast` - Demand forecasts
- `GET /api/worker/dashboard` - Worker assigned batches

---

## Task 1: Production Dashboard Page

**Files:**
- Create: `app/(admin)/admin/production/dashboard/page.tsx` (complete implementation)
- Create: `components/production/LabCapacityChart.tsx`
- Create: `components/production/MaterialAlerts.tsx`

The dashboard shows:
- KPI cards: batches today, completed today, labs in use
- Lab utilization chart (capacity vs current load)
- Recent batch timeline
- Material alerts (low stock items)
- Auto-refresh every 30 seconds

### Step 1: Create LabCapacityChart component

**File:** `components/production/LabCapacityChart.tsx`

```typescript
'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface LabCapacityData {
  labId: string
  name: string
  capacity: number
  currentLoad: number
  utilizationPercent: number
}

interface LabCapacityChartProps {
  data: LabCapacityData[]
  isLoading: boolean
}

export default function LabCapacityChart({ data, isLoading }: LabCapacityChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-80 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading lab capacity...</div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-80 flex items-center justify-center text-gray-500">
        No lab data available
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Lab Capacity Utilization</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" stroke="#666" />
          <YAxis stroke="#666" />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
            formatter={(value, name) => {
              if (name === 'currentLoad') return [`${value} active`, 'Current Load']
              if (name === 'capacity') return [`${value} max`, 'Capacity']
              return [value, name]
            }}
          />
          <Legend />
          <Bar dataKey="currentLoad" fill="#3b82f6" name="Current Load" />
          <Bar dataKey="capacity" fill="#e5e7eb" name="Capacity" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### Step 2: Create MaterialAlerts component

**File:** `components/production/MaterialAlerts.tsx`

```typescript
'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'

export interface MaterialAlert {
  materialId: string
  name: string
  type: string
  currentQuantity: number
  minThreshold: number
  unit: string
  labName: string
  daysUntilStockout?: number
}

interface MaterialAlertsProps {
  alerts: MaterialAlert[]
  isLoading: boolean
}

export default function MaterialAlerts({ alerts, isLoading }: MaterialAlertsProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Alerts</h3>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Alerts</h3>
        <p className="text-sm text-gray-500">All materials above minimum thresholds</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Material Alerts</h3>
      <div className="space-y-3">
        {alerts.map(alert => (
          <div key={`${alert.materialId}-${alert.labName}`} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-900">
                {alert.name} <span className="text-xs font-normal">({alert.type})</span>
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                {alert.labName}: {alert.currentQuantity}{alert.unit} / {alert.minThreshold}{alert.unit} min
              </p>
              {alert.daysUntilStockout && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ Stock depleted in ~{alert.daysUntilStockout} days
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 3: Implement complete Production Dashboard

**File:** `app/(admin)/admin/production/dashboard/page.tsx` (replace existing skeleton)

```typescript
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useToast } from '@/lib/hooks/useToast'
import { useRouter } from 'next/navigation'
import LabCapacityChart, { LabCapacityData } from '@/components/production/LabCapacityChart'
import MaterialAlerts, { MaterialAlert } from '@/components/production/MaterialAlerts'
import { Activity, AlertTriangle, Clock, Zap, RefreshCw, Loader2, TrendingUp } from 'lucide-react'

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
  lab: { id: string; name: string }
  recipe: { id: string; name: string }
  machine: { id: string; name: string } | null
}

interface KPICard {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
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

function statusColor(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'PLANNED': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200'
    case 'PAUSED': return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'CANCELLED': return 'bg-gray-50 text-gray-700 border-gray-200'
    default: return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function ProductionDashboard() {
  const router = useRouter()
  const { error: toastError } = useToast()

  const [batches, setBatches] = useState<Batch[]>([])
  const [labs, setLabs] = useState<LabCapacityData[]>([])
  const [alerts, setAlerts] = useState<MaterialAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true)
    try {
      // Fetch batches
      const batchRes = await fetch('/api/admin/production/batches?limit=50')
      if (!batchRes.ok) throw new Error('Failed to fetch batches')
      const batchJson = await batchRes.json()
      if (!batchJson.success) throw new Error(batchJson.error?.message)
      setBatches(batchJson.data || [])

      // Fetch lab capacity
      const labRes = await fetch('/api/admin/production/lab-capacity')
      if (!labRes.ok) throw new Error('Failed to fetch lab capacity')
      const labJson = await labRes.json()
      if (!labJson.success) throw new Error(labJson.error?.message)
      setLabs(labJson.data || [])

      // TODO: Fetch material alerts (when API is ready)
      setAlerts([])

      setLastRefresh(new Date())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard'
      toastError({
        title: 'Load Failed',
        message: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData])

  // Calculate KPIs
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const batchesToday = batches.filter(b => {
    const created = new Date(b.createdAt)
    created.setHours(0, 0, 0, 0)
    return created.getTime() === today.getTime()
  }).length

  const completedToday = batches.filter(b => {
    if (b.status !== 'COMPLETED' || !b.actualCompletionTime) return false
    const completed = new Date(b.actualCompletionTime)
    completed.setHours(0, 0, 0, 0)
    return completed.getTime() === today.getTime()
  }).length

  const inProgress = batches.filter(b => b.status === 'IN_PROGRESS').length
  const labsActive = labs.filter(l => l.currentLoad > 0).length

  const kpis: KPICard[] = [
    {
      title: 'Batches Today',
      value: batchesToday,
      icon: <Activity className="w-5 h-5" />,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Completed Today',
      value: completedToday,
      icon: <Zap className="w-5 h-5" />,
      color: 'text-green-600 bg-green-50',
    },
    {
      title: 'In Progress',
      value: inProgress,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      title: 'Active Labs',
      value: `${labsActive}/${labs.length}`,
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-purple-600 bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Production Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString('en-US')}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600">{kpi.title}</h3>
              <div className={`p-2 rounded-lg ${kpi.color}`}>
                {kpi.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Lab Capacity Chart */}
      <LabCapacityChart data={labs} isLoading={isLoading} />

      {/* Material Alerts */}
      <MaterialAlerts alerts={alerts} isLoading={isLoading} />

      {/* Recent Batches Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Batches</h3>
          <Link
            href="/admin/production/batches"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            View all →
          </Link>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))
          ) : batches.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No batches found</p>
          ) : (
            batches.slice(0, 5).map(batch => (
              <div
                key={batch.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${statusColor(batch.status)}`}
              >
                <div className="flex-1">
                  <p className="font-medium">{batch.batchNumber}</p>
                  <p className="text-xs opacity-75 mt-0.5">
                    {batch.recipe.name} — {batch.lab.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{batch.quantity} units</p>
                  <p className="text-xs opacity-75 mt-0.5">{formatTimeAgo(batch.updatedAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/production/batches"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-amber-200 transition-all"
        >
          <h4 className="font-semibold text-gray-900">Create Batch</h4>
          <p className="text-xs text-gray-600 mt-1">Schedule production</p>
        </Link>
        <Link
          href="/admin/production/labs"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-amber-200 transition-all"
        >
          <h4 className="font-semibold text-gray-900">Manage Labs</h4>
          <p className="text-xs text-gray-600 mt-1">View inventory & machines</p>
        </Link>
        <Link
          href="/admin/production/recipes"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-amber-200 transition-all"
        >
          <h4 className="font-semibold text-gray-900">Recipes</h4>
          <p className="text-xs text-gray-600 mt-1">Manage ingredient lists</p>
        </Link>
        <Link
          href="/admin/production/forecast"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-amber-200 transition-all"
        >
          <h4 className="font-semibold text-gray-900">Forecast</h4>
          <p className="text-xs text-gray-600 mt-1">Demand predictions</p>
        </Link>
      </div>
    </div>
  )
}
```

### Step 4: Test Production Dashboard in Coolify

Run: `npm run dev`

Navigate to: `http://localhost:3000/admin/production/dashboard`

Expected:
- ✓ Page loads without errors
- ✓ KPI cards display with correct data
- ✓ Lab capacity chart renders
- ✓ Recent batches list appears
- ✓ Refresh button triggers data reload
- ✓ No 500 errors in console

### Step 5: Commit

```bash
git add -A
git commit -m "feat: complete production dashboard with KPIs, lab capacity chart, and material alerts (Task 1)"
```

---

## Task 2: Labs Management Page

**Files:**
- Create: `app/(admin)/admin/production/labs/page.tsx` (with CRUD modals)

Lab management allows admins to:
- View all labs with type, capacity, and current inventory
- Create new labs
- Edit lab details
- View machines in each lab
- Check stock levels by material

### Steps 1-5: Implement Labs Management Page

**File:** `app/(admin)/admin/production/labs/page.tsx`

[Full implementation with create/edit modals, machine list, inventory table, following supplier.page.tsx patterns]

### Step 6: Test and Commit

Test in browser: `/admin/production/labs`

Expected:
- ✓ All 3 seeded labs display
- ✓ Machines visible per lab
- ✓ Inventory table shows stock levels
- ✓ Create lab modal works
- ✓ Edit saves correctly
- ✓ No console errors

```bash
git commit -m "feat: implement labs management with CRUD and inventory view (Task 2)"
```

---

## Task 3: Recipes Management Page

**Files:**
- Create: `app/(admin)/admin/production/recipes/page.tsx` (with CRUD modals)

Recipe management allows admins to:
- View all recipes with ingredient lists and labor time
- Create recipes with ingredient selection
- Edit recipes
- Delete recipes
- View which batches use each recipe

### Steps 1-5: Implement Recipes Page

**File:** `app/(admin)/admin/production/recipes/page.tsx`

[Full implementation with recipe form showing ingredients dropdown, labor time input]

### Step 6: Test and Commit

Test: `/admin/production/recipes`

Expected:
- ✓ All 3 seeded recipes display
- ✓ Ingredients list visible per recipe
- ✓ Create/edit forms work
- ✓ Form validates labor minutes is positive
- ✓ Delete confirmation appears

```bash
git commit -m "feat: implement recipes management with ingredient editing (Task 3)"
```

---

## Task 4: Production Batches Page (Complex)

**Files:**
- Create: `app/(admin)/admin/production/batches/page.tsx` (with complex form)
- Create/Update: `components/production/BatchForm.tsx` (batch creation with validation)

Batch creation is the most complex page due to:
1. Recipe selection → auto-populate ingredients
2. Calculate required quantities × batch quantity
3. Fetch current lab stock for selected lab
4. Validate all materials are in stock with sufficient quantity
5. Display validation errors with suggestions (use supplier catalog for low stock)
6. On success: decrement stock atomically, create batch

Batch list page shows:
- Status filtering (PLANNED, IN_PROGRESS, COMPLETED)
- Lab filtering
- Batch timeline with status indicators
- Ability to update batch status (drag-drop or select dropdown)
- Delete completed batches

### Steps 1-8: Implement Batch Creation Form Component

**File:** `components/production/BatchForm.tsx`

```typescript
'use client'

import React, { useState, useEffect } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface Recipe {
  id: string
  name: string
  laborMinutes: number
  ingredients: Array<{
    id: string
    rawMaterialId: string
    rawMaterial: { id: string; name: string; type: string; unit: string }
    quantity: number
    unit: string
  }>
}

interface Lab {
  id: string
  name: string
  type: string
  stock: Array<{
    materialId: string
    material: { id: string; name: string; unit: string }
    quantity: number
  }>
}

interface BatchFormProps {
  onClose: () => void
  onSuccess: () => void
}

export default function BatchForm({ onClose, onSuccess }: BatchFormProps) {
  const { success, error: toastError } = useToast()

  const [labs, setLabs] = useState<Lab[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedLab, setSelectedLab] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [plannedStartTime, setPlannedStartTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Fetch labs and recipes
  useEffect(() => {
    async function loadData() {
      try {
        const [labRes, recipeRes] = await Promise.all([
          fetch('/api/admin/production/labs'),
          fetch('/api/admin/production/recipes'),
        ])

        if (!labRes.ok || !recipeRes.ok) throw new Error('Failed to load data')

        const labJson = await labRes.json()
        const recipeJson = await recipeRes.json()

        if (!labJson.success || !recipeJson.success) {
          throw new Error('Invalid response format')
        }

        setLabs(labJson.data || [])
        setRecipes(recipeJson.data || [])
      } catch (err) {
        toastError({
          title: 'Load Failed',
          message: err instanceof Error ? err.message : 'Failed to load form data',
        })
      } finally {
        setIsLoadingData(false)
      }
    }

    loadData()
  }, [toastError])

  const currentLab = labs.find(l => l.id === selectedLab)
  const ingredientsNeeded = selectedRecipe
    ? selectedRecipe.ingredients.map(ing => ({
        ...ing,
        requiredQty: ing.quantity * parseInt(quantity || '0'),
      }))
    : []

  // Check material availability
  const materialIssues = ingredientsNeeded
    .map(ing => {
      const available = currentLab?.stock.find(s => s.materialId === ing.rawMaterialId)?.quantity || 0
      const required = ing.requiredQty
      if (available < required) {
        return {
          material: ing.rawMaterial.name,
          available,
          required,
          short: required - available,
          unit: ing.unit,
        }
      }
      return null
    })
    .filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: Record<string, string> = {}

    if (!selectedLab) errors.lab = 'Lab is required'
    if (!selectedRecipe) errors.recipe = 'Recipe is required'
    if (!quantity || parseInt(quantity) < 1) errors.quantity = 'Quantity must be at least 1'
    if (!plannedStartTime) errors.plannedStartTime = 'Start time is required'
    if (materialIssues.length > 0) {
      errors.materials = `Insufficient stock for ${materialIssues.length} material(s)`
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labId: selectedLab,
          recipeId: selectedRecipe!.id,
          quantity: parseInt(quantity),
          plannedStartTime: new Date(plannedStartTime).toISOString(),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const details = json.error?.details
        if (Array.isArray(details)) {
          const fieldErrors: Record<string, string> = {}
          for (const issue of details as { path: string[]; message: string }[]) {
            const field = issue.path[0]
            if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
          }
          if (Object.keys(fieldErrors).length > 0) setValidationErrors(fieldErrors)
        }
        toastError({
          title: 'Create Failed',
          message: json.error?.message ?? 'Failed to create batch',
        })
        return
      }

      success({
        title: 'Batch Created',
        message: `${selectedRecipe!.name} batch scheduled successfully`,
      })
      onSuccess()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 text-center">
          <div className="animate-pulse">Loading form data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create Production Batch</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* Lab Selection */}
          <div>
            <label htmlFor="lab" className="block text-sm font-semibold text-gray-700 mb-1">
              Lab <span className="text-red-500">*</span>
            </label>
            <select
              id="lab"
              value={selectedLab}
              onChange={e => {
                setSelectedLab(e.target.value)
                setValidationErrors(prev => {
                  const next = { ...prev }
                  delete next.lab
                  return next
                })
              }}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                validationErrors.lab ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Select a lab</option>
              {labs.map(lab => (
                <option key={lab.id} value={lab.id}>
                  {lab.name} ({lab.type})
                </option>
              ))}
            </select>
            {validationErrors.lab && (
              <p className="text-xs text-red-600 mt-1">{validationErrors.lab}</p>
            )}
          </div>

          {/* Recipe Selection */}
          <div>
            <label htmlFor="recipe" className="block text-sm font-semibold text-gray-700 mb-1">
              Recipe <span className="text-red-500">*</span>
            </label>
            <select
              id="recipe"
              value={selectedRecipe?.id || ''}
              onChange={e => {
                const recipe = recipes.find(r => r.id === e.target.value)
                setSelectedRecipe(recipe || null)
                setValidationErrors(prev => {
                  const next = { ...prev }
                  delete next.recipe
                  return next
                })
              }}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                validationErrors.recipe ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Select a recipe</option>
              {recipes.map(recipe => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name} ({recipe.laborMinutes}m)
                </option>
              ))}
            </select>
            {validationErrors.recipe && (
              <p className="text-xs text-red-600 mt-1">{validationErrors.recipe}</p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="quantity" className="block text-sm font-semibold text-gray-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <input
              id="quantity"
              type="number"
              value={quantity}
              onChange={e => {
                setQuantity(e.target.value)
                setValidationErrors(prev => {
                  const next = { ...prev }
                  delete next.quantity
                  return next
                })
              }}
              min="1"
              step="1"
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                validationErrors.quantity ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {validationErrors.quantity && (
              <p className="text-xs text-red-600 mt-1">{validationErrors.quantity}</p>
            )}
          </div>

          {/* Planned Start Time */}
          <div>
            <label htmlFor="startTime" className="block text-sm font-semibold text-gray-700 mb-1">
              Planned Start Time <span className="text-red-500">*</span>
            </label>
            <input
              id="startTime"
              type="datetime-local"
              value={plannedStartTime}
              onChange={e => {
                setPlannedStartTime(e.target.value)
                setValidationErrors(prev => {
                  const next = { ...prev }
                  delete next.plannedStartTime
                  return next
                })
              }}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                validationErrors.plannedStartTime ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {validationErrors.plannedStartTime && (
              <p className="text-xs text-red-600 mt-1">{validationErrors.plannedStartTime}</p>
            )}
          </div>

          {/* Material Requirements */}
          {selectedRecipe && currentLab && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-3">Required Materials</p>
              <div className="space-y-2">
                {ingredientsNeeded.map(ing => {
                  const available = currentLab.stock.find(
                    s => s.materialId === ing.rawMaterialId
                  )?.quantity || 0
                  const isShort = available < ing.requiredQty
                  return (
                    <div
                      key={ing.id}
                      className={`text-xs p-2 rounded flex items-center justify-between ${
                        isShort ? 'bg-red-50 text-red-700' : 'bg-white text-gray-700'
                      }`}
                    >
                      <span>{ing.rawMaterial.name}</span>
                      <span className="font-mono">
                        {available.toFixed(2)}/{ing.requiredQty.toFixed(2)} {ing.unit}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Material Issues Alert */}
          {materialIssues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">Insufficient Materials</p>
                  <ul className="text-xs text-red-700 mt-2 space-y-1">
                    {materialIssues.map(issue => (
                      <li key={issue.material}>
                        <strong>{issue.material}:</strong> Short {issue.short.toFixed(2)} {issue.unit} (have{' '}
                        {issue.available.toFixed(2)}, need {issue.required.toFixed(2)})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* General Validation Error */}
          {validationErrors.materials && !materialIssues.length && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {validationErrors.materials}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || materialIssues.length > 0}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Batch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

### Step 9-15: Implement Batches List Page

**File:** `app/(admin)/admin/production/batches/page.tsx`

[Full implementation with create button, status filtering, batch list table, status update buttons]

### Step 16: Test Batch Creation

Test: `/admin/production/batches` → Create Batch

Expected:
- ✓ Form loads labs and recipes
- ✓ Selecting recipe shows required materials
- ✓ Shows available stock vs required
- ✓ Blocks creation if materials insufficient
- ✓ On success: batch appears in list
- ✓ Stock is decremented in lab inventory

### Step 17: Commit

```bash
git commit -m "feat: implement batch creation with validation and batch list management (Task 4)"
```

---

## Task 5: Demand Forecast Page

**Files:**
- Create: `app/(admin)/admin/production/forecast/page.tsx`

Forecast page shows:
- 7-day demand predictions by recipe
- Confidence levels (high/medium/low)
- Historical consumption (if available)
- Suggested batch creation (button to pre-populate create batch form)
- Timeline chart of predictions

Note: Actual forecasting algorithm is Phase 2. This page is a UI skeleton ready for Phase 2 API integration.

[Implementation with chart showing predictions, confidence levels, action buttons]

---

## Task 6: Worker Dashboard Improvement

**Files:**
- Update: `app/(worker)/worker/dashboard/page.tsx` (expand existing)

Currently shows assigned batches. Add:
- Batch completion form (mark as complete with quantity produced)
- Time tracking (clock in/out)
- Performance stats (batches completed, average time)
- Upcoming batches (next 3 scheduled)

---

## Task 7: Manager Dashboard

**Files:**
- Create: `app/(admin)/admin/production/manager/page.tsx`

Manager dashboard shows:
- All lab activity (not just their lab)
- Team metrics (worker productivity)
- Quality metrics (batches completed on time vs late)
- Batch pipeline (PLANNED → IN_PROGRESS → COMPLETED)
- Alerts for issues (delayed batches, material shortages)

---

## Testing Checklist

- [ ] All 7 pages load without 500 errors
- [ ] API responses handle correctly (display errors gracefully)
- [ ] Forms validate input and show field-level errors
- [ ] Loading states display while fetching
- [ ] Modals open/close smoothly
- [ ] Data refreshes on submit (modals close, lists update)
- [ ] Role-based access (visit as WORKER/MANAGER/ADMIN)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Icons render correctly
- [ ] Colors match amber/blue/green design
- [ ] Auto-refresh works (dashboards update every 30s)
- [ ] Error messages are user-friendly

---

## Commits Summary

- Task 1: `feat: complete production dashboard with KPIs, lab capacity chart, and material alerts`
- Task 2: `feat: implement labs management with CRUD and inventory view`
- Task 3: `feat: implement recipes management with ingredient editing`
- Task 4: `feat: implement batch creation with validation and batch list management`
- Task 5: `feat: implement demand forecast page (Phase 2 skeleton)`
- Task 6: `feat: expand worker dashboard with completion tracking`
- Task 7: `feat: implement manager dashboard with team metrics`

---

## Success Criteria

✅ All 7 pages built and tested against Coolify database
✅ All forms validate input correctly
✅ API errors handled gracefully
✅ Loading/skeleton states visible
✅ Auto-refresh on all dashboards
✅ Modals work smoothly
✅ Data updates reflected immediately after actions
✅ No console errors
✅ Responsive layout
✅ Code committed to feature branch
