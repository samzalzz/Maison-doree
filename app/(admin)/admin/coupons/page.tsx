'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import {
  Plus,
  Search,
  Tag,
  Trash2,
  Edit2,
  BarChart2,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromoCoupon {
  id: string
  code: string
  name: string
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountValue: number
  maxUses: number | null
  usedCount: number
  maxUsesPerCustomer: number
  minOrderAmount: number | null
  applicableCategories: string[]
  validFrom: string
  validUntil: string
  isActive: boolean
  createdAt: string
  _count?: { usages: number }
}

interface CouponFormData {
  code: string
  name: string
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountValue: string
  maxUses: string
  maxUsesPerCustomer: string
  minOrderAmount: string
  applicableCategories: string[]
  validFrom: string
  validUntil: string
  isActive: boolean
}

const CATEGORY_OPTIONS = [
  'PATES',
  'COOKIES',
  'GATEAU',
  'BRIOUATES',
  'CHEBAKIA',
  'AUTRES',
]

const EMPTY_FORM: CouponFormData = {
  code: '',
  name: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxUses: '',
  maxUsesPerCustomer: '1',
  minOrderAmount: '',
  applicableCategories: [],
  validFrom: '',
  validUntil: '',
  isActive: true,
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatusBadge({ coupon }: { coupon: PromoCoupon }) {
  const now = new Date()
  const from = new Date(coupon.validFrom)
  const until = new Date(coupon.validUntil)
  const exhausted =
    coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses

  if (!coupon.isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    )
  }

  if (exhausted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
        Exhausted
      </span>
    )
  }

  if (now < from) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
        Scheduled
      </span>
    )
  }

  if (now > until) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        Expired
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" />
      Active
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Analytics Panel
// ---------------------------------------------------------------------------

interface AnalyticsSummary {
  totalCoupons: number
  activeCoupons: number
  totalRedemptions: number
  totalRevenueImpact: number
}

function AnalyticsPanel({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [from] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString()
  })
  const [to] = useState(() => new Date().toISOString())

  useEffect(() => {
    fetch(`/api/admin/coupons/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data.summary)
      })
      .finally(() => setLoading(false))
  }, [from, to])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-amber-600" />
          Coupon Analytics (Last 30 Days)
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{data.totalCoupons}</p>
              <p className="text-sm text-gray-600 mt-1">Total Coupons</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{data.activeCoupons}</p>
              <p className="text-sm text-gray-600 mt-1">Active Coupons</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{data.totalRedemptions}</p>
              <p className="text-sm text-gray-600 mt-1">Total Redemptions</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">
                {data.totalRevenueImpact.toFixed(2)} MAD
              </p>
              <p className="text-sm text-gray-600 mt-1">Revenue Impact</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No analytics data available.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Coupon Form Modal
// ---------------------------------------------------------------------------

interface CouponFormModalProps {
  initial?: PromoCoupon | null
  onClose: () => void
  onSaved: () => void
}

function CouponFormModal({ initial, onClose, onSaved }: CouponFormModalProps) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState<CouponFormData>(() => {
    if (!initial) return EMPTY_FORM
    // Pre-fill for editing
    const toLocalDateInput = (iso: string) => {
      const d = new Date(iso)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return {
      code: initial.code,
      name: initial.name,
      discountType: initial.discountType,
      discountValue: String(initial.discountValue),
      maxUses: initial.maxUses !== null ? String(initial.maxUses) : '',
      maxUsesPerCustomer: String(initial.maxUsesPerCustomer),
      minOrderAmount:
        initial.minOrderAmount !== null ? String(initial.minOrderAmount) : '',
      applicableCategories: initial.applicableCategories,
      validFrom: toLocalDateInput(initial.validFrom),
      validUntil: toLocalDateInput(initial.validUntil),
      isActive: initial.isActive,
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = Boolean(initial)

  function setField<K extends keyof CouponFormData>(
    key: K,
    value: CouponFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function toggleCategory(cat: string) {
    setForm((prev) => {
      const already = prev.applicableCategories.includes(cat)
      return {
        ...prev,
        applicableCategories: already
          ? prev.applicableCategories.filter((c) => c !== cat)
          : [...prev.applicableCategories, cat],
      }
    })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}

    if (!isEdit) {
      if (!form.code || form.code.length < 8 || form.code.length > 12) {
        e.code = 'Code must be 8–12 uppercase alphanumeric characters.'
      } else if (!/^[A-Z0-9]+$/.test(form.code)) {
        e.code = 'Code must contain only uppercase letters and digits.'
      }
    }

    if (!form.name.trim()) e.name = 'Name is required.'

    const dv = parseFloat(form.discountValue)
    if (isNaN(dv) || dv <= 0) {
      e.discountValue = 'Discount value must be positive.'
    } else if (form.discountType === 'PERCENTAGE' && dv > 100) {
      e.discountValue = 'Percentage cannot exceed 100.'
    }

    if (!form.validFrom) e.validFrom = 'Start date is required.'
    if (!form.validUntil) e.validUntil = 'End date is required.'
    if (
      form.validFrom &&
      form.validUntil &&
      new Date(form.validUntil) <= new Date(form.validFrom)
    ) {
      e.validUntil = 'End date must be after start date.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const payload = {
        ...(isEdit ? {} : { code: form.code }),
        name: form.name.trim(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses, 10) : null,
        maxUsesPerCustomer: parseInt(form.maxUsesPerCustomer || '1', 10),
        minOrderAmount: form.minOrderAmount
          ? parseFloat(form.minOrderAmount)
          : null,
        applicableCategories: form.applicableCategories,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: new Date(form.validUntil).toISOString(),
        isActive: form.isActive,
      }

      const url = isEdit
        ? `/api/admin/coupons/${initial!.id}`
        : '/api/admin/coupons'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: isEdit ? 'Update Failed' : 'Create Failed',
          message: json.error?.message ?? 'An error occurred.',
        })
        return
      }

      success({
        title: isEdit ? 'Coupon Updated' : 'Coupon Created',
        message: isEdit
          ? `${initial!.code} has been updated.`
          : `Coupon ${form.code} created successfully.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? `Edit ${initial!.code}` : 'Create New Coupon'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Code (only on create) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Coupon Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) =>
                  setField(
                    'code',
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  )
                }
                placeholder="SPRING20"
                maxLength={12}
                className={`w-full px-4 py-2 border rounded-lg font-mono tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.code ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.code && (
                <p className="text-xs text-red-600 mt-1">{errors.code}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                8–12 uppercase alphanumeric characters
              </p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Spring 2026 Discount"
              maxLength={100}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Discount Type & Value */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Discount Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setField(
                    'discountType',
                    e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT',
                  )
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (MAD)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Discount Value <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setField('discountValue', e.target.value)}
                  placeholder={form.discountType === 'PERCENTAGE' ? '20' : '50'}
                  min="0"
                  max={form.discountType === 'PERCENTAGE' ? '100' : undefined}
                  step="0.01"
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors.discountValue ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                <span className="absolute right-3 inset-y-0 flex items-center text-gray-500 text-sm pointer-events-none">
                  {form.discountType === 'PERCENTAGE' ? '%' : 'MAD'}
                </span>
              </div>
              {errors.discountValue && (
                <p className="text-xs text-red-600 mt-1">{errors.discountValue}</p>
              )}
            </div>
          </div>

          {/* Validity Window */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Valid From <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.validFrom}
                onChange={(e) => setField('validFrom', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.validFrom ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.validFrom && (
                <p className="text-xs text-red-600 mt-1">{errors.validFrom}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Valid Until <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.validUntil}
                onChange={(e) => setField('validUntil', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.validUntil ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.validUntil && (
                <p className="text-xs text-red-600 mt-1">{errors.validUntil}</p>
              )}
            </div>
          </div>

          {/* Usage Limits */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Max Total Uses
              </label>
              <input
                type="number"
                value={form.maxUses}
                onChange={(e) => setField('maxUses', e.target.value)}
                placeholder="Unlimited"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Per Customer
              </label>
              <input
                type="number"
                value={form.maxUsesPerCustomer}
                onChange={(e) => setField('maxUsesPerCustomer', e.target.value)}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Min Order (MAD)
              </label>
              <input
                type="number"
                value={form.minOrderAmount}
                onChange={(e) => setField('minOrderAmount', e.target.value)}
                placeholder="None"
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Category Restrictions */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Applicable Categories{' '}
              <span className="text-gray-400 font-normal text-xs">
                (leave empty for all)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const active = form.applicableCategories.includes(cat)
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      active
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <label
              htmlFor="isActive"
              className="text-sm font-semibold text-gray-700 cursor-pointer"
            >
              Active (coupon can be used immediately)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Coupon'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  coupon,
  onClose,
  onConfirmed,
}: {
  coupon: PromoCoupon
  onClose: () => void
  onConfirmed: () => void
}) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete coupon.',
        })
        return
      }

      success({ title: 'Coupon Deactivated', message: `${coupon.code} has been deactivated.` })
      onConfirmed()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Deactivate Coupon</h2>
        <p className="text-gray-600 mb-4">
          Are you sure you want to deactivate{' '}
          <span className="font-bold text-gray-900">{coupon.code}</span>? This
          will prevent any further use. Existing usage records are preserved.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deactivating...
              </>
            ) : (
              'Deactivate'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<PromoCoupon[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [total, setTotal] = useState(0)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editCoupon, setEditCoupon] = useState<PromoCoupon | null>(null)
  const [deleteCoupon, setDeleteCoupon] = useState<PromoCoupon | null>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const { error: toastError } = useToast()

  const fetchCoupons = useCallback(
    async (reset = false) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: '25' })
        if (search) params.set('search', search)
        if (!reset && nextCursor) params.set('cursor', nextCursor)

        const res = await fetch(`/api/admin/coupons?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Load Failed',
            message: json.error?.message ?? 'Failed to load coupons.',
          })
          return
        }

        setCoupons((prev) =>
          reset ? json.data : [...prev, ...json.data],
        )
        setNextCursor(json.pagination.nextCursor)
        setHasNextPage(json.pagination.hasNextPage)
        setTotal(json.pagination.total)
      } finally {
        setIsLoading(false)
      }
    },
    [search, nextCursor, toastError],
  )

  // Initial load and search-triggered reload
  useEffect(() => {
    setNextCursor(null)
    fetchCoupons(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditCoupon(null)
    fetchCoupons(true)
  }

  const handleDeleted = () => {
    setDeleteCoupon(null)
    fetchCoupons(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promo Coupons</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} coupon{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowAnalytics(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => fetchCoupons(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Coupon
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          placeholder="Search by code..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Validity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && coupons.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : coupons.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No coupons found</p>
                    <p className="text-xs mt-1">
                      {search
                        ? 'Try a different search term.'
                        : 'Create your first coupon.'}
                    </p>
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Code */}
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs tracking-widest">
                        {coupon.code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 text-gray-700">{coupon.name}</td>

                    {/* Discount */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-amber-700">
                        {coupon.discountType === 'PERCENTAGE'
                          ? `${coupon.discountValue}%`
                          : `${Number(coupon.discountValue).toFixed(2)} MAD`}
                      </span>
                      {coupon.minOrderAmount && (
                        <span className="block text-xs text-gray-500">
                          Min: {Number(coupon.minOrderAmount).toFixed(0)} MAD
                        </span>
                      )}
                    </td>

                    {/* Validity */}
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div>{formatDate(coupon.validFrom)}</div>
                      <div className="text-gray-400">
                        to {formatDate(coupon.validUntil)}
                      </div>
                    </td>

                    {/* Usage */}
                    <td className="px-4 py-3">
                      <span className="text-gray-900 font-medium">
                        {coupon.usedCount}
                      </span>
                      {coupon.maxUses !== null && (
                        <span className="text-gray-400">
                          /{coupon.maxUses}
                        </span>
                      )}
                      {coupon.applicableCategories.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {coupon.applicableCategories.slice(0, 2).join(', ')}
                          {coupon.applicableCategories.length > 2 && ' ...'}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge coupon={coupon} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditCoupon(coupon)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteCoupon(coupon)}
                          disabled={!coupon.isActive}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasNextPage && (
          <div className="px-4 py-3 border-t border-gray-200 text-center">
            <button
              onClick={() => fetchCoupons(false)}
              disabled={isLoading}
              className="text-sm text-amber-600 font-medium hover:text-amber-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : (
                'Load more'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CouponFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editCoupon && (
        <CouponFormModal
          initial={editCoupon}
          onClose={() => setEditCoupon(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteCoupon && (
        <DeleteConfirmModal
          coupon={deleteCoupon}
          onClose={() => setDeleteCoupon(null)}
          onConfirmed={handleDeleted}
        />
      )}

      {showAnalytics && (
        <AnalyticsPanel onClose={() => setShowAnalytics(false)} />
      )}
    </div>
  )
}
