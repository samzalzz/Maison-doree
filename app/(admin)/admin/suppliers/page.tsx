'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Search,
  Truck,
  Trash2,
  Edit2,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Clock,
  Tag,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  leadTimeDays: number
  categories: string[]
  createdAt: string
}

interface SupplierFormData {
  name: string
  email: string
  phone: string
  leadTimeDays: string
  categories: string
}

const EMPTY_FORM: SupplierFormData = {
  name: '',
  email: '',
  phone: '',
  leadTimeDays: '',
  categories: '',
}

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Parse a comma-separated category string into a trimmed, non-empty array. */
function parseCategories(raw: string): string[] {
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Supplier Form Modal (Create + Edit)
// ---------------------------------------------------------------------------

interface SupplierFormModalProps {
  initial?: Supplier | null
  onClose: () => void
  onSaved: () => void
}

function SupplierFormModal({ initial, onClose, onSaved }: SupplierFormModalProps) {
  const { success, error: toastError } = useToast()

  const [form, setForm] = useState<SupplierFormData>(() => {
    if (!initial) return EMPTY_FORM
    return {
      name: initial.name,
      email: initial.email ?? '',
      phone: initial.phone ?? '',
      leadTimeDays: String(initial.leadTimeDays),
      categories: initial.categories.join(', '),
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = Boolean(initial)

  function setField<K extends keyof SupplierFormData>(
    key: K,
    value: SupplierFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}

    if (!form.name.trim()) {
      e.name = 'Supplier name is required.'
    } else if (form.name.trim().length > 100) {
      e.name = 'Supplier name must not exceed 100 characters.'
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = 'Must be a valid email address.'
    }

    if (form.phone.trim() && form.phone.trim().length > 30) {
      e.phone = 'Phone must not exceed 30 characters.'
    }

    const ld = parseInt(form.leadTimeDays, 10)
    if (!form.leadTimeDays || isNaN(ld) || ld < 1 || !Number.isInteger(ld)) {
      e.leadTimeDays = 'Lead time must be a positive whole number of days.'
    }

    const cats = parseCategories(form.categories)
    if (cats.length === 0) {
      e.categories = 'At least one category is required.'
    } else if (cats.some((c) => c.length > 50)) {
      e.categories = 'Each category must not exceed 50 characters.'
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
        name: form.name.trim(),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        leadTimeDays: parseInt(form.leadTimeDays, 10),
        categories: parseCategories(form.categories),
      }

      const url = isEdit
        ? `/api/admin/suppliers/${initial!.id}`
        : '/api/admin/suppliers'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        // Surface Zod field-level errors when available
        const details = json.error?.details
        if (Array.isArray(details)) {
          const fieldErrors: Record<string, string> = {}
          for (const issue of details as { path: string[]; message: string }[]) {
            const field = issue.path[0]
            if (field && !fieldErrors[field]) {
              fieldErrors[field] = issue.message
            }
          }
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors)
          }
        }
        toastError({
          title: isEdit ? 'Update Failed' : 'Create Failed',
          message: json.error?.message ?? 'An error occurred.',
        })
        return
      }

      success({
        title: isEdit ? 'Supplier Updated' : 'Supplier Created',
        message: isEdit
          ? `"${initial!.name}" has been updated.`
          : `Supplier "${form.name.trim()}" created successfully.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2
            id="supplier-modal-title"
            className="text-xl font-bold text-gray-900"
          >
            {isEdit ? `Edit "${initial!.name}"` : 'Add New Supplier'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="supplier-name"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Atlas Farine SARL"
              maxLength={100}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="supplier-email"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="supplier-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contact@supplier.com"
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.email ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.email && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.email}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="supplier-phone"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Phone
              </label>
              <input
                id="supplier-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="+212 600 000 000"
                maxLength={30}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.phone ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.phone && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Lead Time */}
          <div>
            <label
              htmlFor="supplier-lead-time"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Lead Time (days) <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-lead-time"
              type="number"
              value={form.leadTimeDays}
              onChange={(e) => setField('leadTimeDays', e.target.value)}
              placeholder="e.g. 3"
              min="1"
              step="1"
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.leadTimeDays ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.leadTimeDays && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.leadTimeDays}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Average number of days from order to delivery
            </p>
          </div>

          {/* Categories */}
          <div>
            <label
              htmlFor="supplier-categories"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Categories <span className="text-red-500">*</span>
            </label>
            <input
              id="supplier-categories"
              type="text"
              value={form.categories}
              onChange={(e) => setField('categories', e.target.value)}
              placeholder="e.g. Flour, Sugar, Chocolate"
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.categories ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.categories && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.categories}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of material types this supplier provides
            </p>
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
                'Add Supplier'
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

interface DeleteConfirmModalProps {
  supplier: Supplier
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({
  supplier,
  onClose,
  onConfirmed,
}: DeleteConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete supplier.',
        })
        return
      }

      success({
        title: 'Supplier Deleted',
        message: `"${supplier.name}" has been removed.`,
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
      aria-labelledby="delete-supplier-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2
              id="delete-supplier-modal-title"
              className="text-lg font-bold text-gray-900"
            >
              Delete Supplier
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-gray-900">"{supplier.name}"</span>?
              This action cannot be undone. Suppliers with existing purchase
              orders cannot be deleted.
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
              'Delete Supplier'
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

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [displayedSuppliers, setDisplayedSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null)

  const { error: toastError } = useToast()

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ skip: '0', take: '200' })
      if (search.trim()) params.set('category', search.trim())

      const res = await fetch(`/api/admin/suppliers?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load suppliers.',
        })
        return
      }

      const allSuppliers: Supplier[] = json.data ?? []
      setSuppliers(allSuppliers)
      setTotal(json.pagination?.total ?? allSuppliers.length)
      setPage(1)
      setDisplayedSuppliers(allSuppliers.slice(0, PAGE_SIZE))
      setHasMore(allSuppliers.length > PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
  }, [search, toastError])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  const handleLoadMore = () => {
    const nextPage = page + 1
    const nextSlice = suppliers.slice(0, nextPage * PAGE_SIZE)
    setDisplayedSuppliers(nextSlice)
    setPage(nextPage)
    setHasMore(nextSlice.length < suppliers.length)
  }

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditSupplier(null)
    fetchSuppliers()
  }

  const handleDeleted = () => {
    setDeleteSupplier(null)
    fetchSuppliers()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} supplier{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchSuppliers}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh suppliers list"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Search / filter by category */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by category..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Suppliers">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Supplier
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Contact
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Lead Time
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Categories
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Added
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && suppliers.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayedSuppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-gray-500"
                  >
                    <Truck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No suppliers found</p>
                    <p className="text-xs mt-1">
                      {search.trim()
                        ? 'Try a different category filter.'
                        : 'Add your first supplier to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Supplier name */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {supplier.name}
                      </span>
                    </td>

                    {/* Contact: email + phone */}
                    <td className="px-4 py-3">
                      {supplier.email ? (
                        <a
                          href={`mailto:${supplier.email}`}
                          className="block text-amber-700 hover:underline text-xs truncate max-w-[180px]"
                          title={supplier.email}
                        >
                          {supplier.email}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                      {supplier.phone && (
                        <span className="block text-gray-500 text-xs mt-0.5">
                          {supplier.phone}
                        </span>
                      )}
                    </td>

                    {/* Lead time */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {supplier.leadTimeDays}d
                      </span>
                    </td>

                    {/* Categories */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {supplier.categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-0.5 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {cat}
                          </span>
                        ))}
                        {supplier.categories.length > 3 && (
                          <span
                            className="text-xs text-gray-500"
                            title={supplier.categories.slice(3).join(', ')}
                          >
                            +{supplier.categories.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Created date */}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(supplier.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditSupplier(supplier)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit supplier"
                          aria-label={`Edit ${supplier.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSupplier(supplier)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete supplier"
                          aria-label={`Delete ${supplier.name}`}
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
        {hasMore && (
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={handleLoadMore}
              isLoading={false}
              label={`Load More Suppliers (${suppliers.length - displayedSuppliers.length} remaining)`}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <SupplierFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editSupplier && (
        <SupplierFormModal
          initial={editSupplier}
          onClose={() => setEditSupplier(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteSupplier && (
        <DeleteConfirmModal
          supplier={deleteSupplier}
          onClose={() => setDeleteSupplier(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  )
}
