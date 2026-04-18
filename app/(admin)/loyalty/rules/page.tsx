'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { PointsRule } from '@/components/loyalty/PointsRule'
import { useToast } from '@/lib/hooks/useToast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PointsRuleData {
  id: string
  name: string
  type: string
  pointsPerUnit: number
  applicableCategory: string | null
  minOrderAmount: number | null
  tierRequired: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CreateRuleForm {
  name: string
  type: string
  pointsPerUnit: string
  applicableCategory: string
  minOrderAmount: string
  tierRequired: string
  isActive: boolean
}

const RULE_TYPES = [
  { value: 'BASE_PURCHASE', label: 'Base Purchase' },
  { value: 'CATEGORY_BONUS', label: 'Category Bonus' },
  { value: 'TIER_BONUS', label: 'Tier Bonus' },
  { value: 'REFERRAL', label: 'Referral' },
]

const TIER_OPTIONS = [
  { value: '', label: 'All tiers' },
  { value: 'BRONZE', label: 'Bronze' },
  { value: 'SILVER', label: 'Silver' },
  { value: 'GOLD', label: 'Gold' },
]

const EMPTY_FORM: CreateRuleForm = {
  name: '',
  type: 'BASE_PURCHASE',
  pointsPerUnit: '1',
  applicableCategory: '',
  minOrderAmount: '',
  tierRequired: '',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoyaltyRulesPage() {
  const { success, error: toastError } = useToast()

  const [rules, setRules] = useState<PointsRuleData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateRuleForm>(EMPTY_FORM)
  const [isCreating, setIsCreating] = useState(false)

  const fetchRules = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = filterActive !== 'all' ? `?isActive=${filterActive === 'active'}` : ''
      const res = await fetch(`/api/admin/loyalty/rules${params}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message)
      setRules(data.data)
    } catch (err) {
      toastError({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to load rules.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [filterActive, toastError])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const handleUpdate = (updated: PointsRuleData) => {
    setRules((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r)),
    )
  }

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const points = parseFloat(createForm.pointsPerUnit)
    if (!createForm.name.trim()) {
      toastError({ title: 'Validation', message: 'Rule name is required.' })
      return
    }
    if (isNaN(points) || points <= 0) {
      toastError({ title: 'Validation', message: 'Points per unit must be positive.' })
      return
    }

    setIsCreating(true)
    try {
      const payload: Record<string, unknown> = {
        name: createForm.name.trim(),
        type: createForm.type,
        pointsPerUnit: points,
        isActive: createForm.isActive,
      }

      if (createForm.applicableCategory.trim()) {
        payload.applicableCategory = createForm.applicableCategory.trim()
      }
      if (createForm.minOrderAmount.trim()) {
        const minAmt = parseFloat(createForm.minOrderAmount)
        if (!isNaN(minAmt) && minAmt >= 0) payload.minOrderAmount = minAmt
      }
      if (createForm.tierRequired) {
        payload.tierRequired = createForm.tierRequired
      }

      const res = await fetch('/api/admin/loyalty/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message)

      setRules((prev) => [data.data, ...prev])
      setCreateForm(EMPTY_FORM)
      setIsCreateOpen(false)
      success({ title: 'Rule created', message: `"${data.data.name}" added successfully.` })
    } catch (err) {
      toastError({
        title: 'Create failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Points Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how customers earn loyalty points
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition"
        >
          + New Rule
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
              filterActive === f
                ? 'bg-amber-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Rules table */}
      <div className="rounded-2xl bg-white shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-lg">No rules found.</p>
            <p className="text-sm text-gray-400 mt-1">
              Create your first rule to start awarding loyalty points.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 rounded-lg bg-amber-600 px-5 py-2 text-white hover:bg-amber-700 transition text-sm font-medium"
            >
              Create Rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Pts / Unit
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tier Required
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <PointsRule
                    key={rule.id}
                    rule={rule}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-rule-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 id="create-rule-title" className="text-lg font-bold text-gray-900">
                Create Points Rule
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false)
                  setCreateForm(EMPTY_FORM)
                }}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Base purchase points"
                  className={inputClass}
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className={inputClass}
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Points per unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Points per unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={createForm.pointsPerUnit}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, pointsPerUnit: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>

              {/* Min order amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum order amount (MAD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.minOrderAmount}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      minOrderAmount: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>

              {/* Applicable category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicable category
                </label>
                <input
                  type="text"
                  value={createForm.applicableCategory}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      applicableCategory: e.target.value,
                    }))
                  }
                  placeholder="Optional — leave empty for all categories"
                  className={inputClass}
                />
              </div>

              {/* Tier required */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tier required
                </label>
                <select
                  value={createForm.tierRequired}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      tierRequired: e.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-amber-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-sm text-gray-700">
                  {createForm.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false)
                    setCreateForm(EMPTY_FORM)
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
                >
                  {isCreating ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
