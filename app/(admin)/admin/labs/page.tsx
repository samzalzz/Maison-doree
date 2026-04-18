'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  FlaskConical,
  Trash2,
  Edit2,
  X,
  Loader2,
  RefreshCw,
  Users,
  Cpu,
  Layers,
  AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LabType = 'PREPARATION' | 'ASSEMBLY' | 'FINISHING'

interface StockSummary {
  totalMaterials: number
  lowStockCount: number
}

interface LabCount {
  employees: number
  machines: number
  batches: number
}

interface ProductionLab {
  id: string
  name: string
  type: LabType
  capacity: number
  createdAt: string
  updatedAt: string
  stockSummary: StockSummary
  _count: LabCount
}

interface LabFormData {
  name: string
  type: LabType
  capacity: string
}

const LAB_TYPE_OPTIONS: LabType[] = ['PREPARATION', 'ASSEMBLY', 'FINISHING']

const EMPTY_FORM: LabFormData = {
  name: '',
  type: 'PREPARATION',
  capacity: '',
}

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const LAB_TYPE_BADGE: Record<LabType, { label: string; className: string }> = {
  PREPARATION: {
    label: 'Preparation',
    className: 'bg-blue-100 text-blue-700',
  },
  ASSEMBLY: {
    label: 'Assembly',
    className: 'bg-purple-100 text-purple-700',
  },
  FINISHING: {
    label: 'Finishing',
    className: 'bg-green-100 text-green-700',
  },
}

function LabTypeBadge({ type }: { type: LabType }) {
  const { label, className } = LAB_TYPE_BADGE[type]
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${className}`}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Lab Form Modal (Create + Edit)
// ---------------------------------------------------------------------------

interface LabFormModalProps {
  initial?: ProductionLab | null
  onClose: () => void
  onSaved: () => void
}

function LabFormModal({ initial, onClose, onSaved }: LabFormModalProps) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState<LabFormData>(() => {
    if (!initial) return EMPTY_FORM
    return {
      name: initial.name,
      // type is immutable on edit — kept in state but field is read-only
      type: initial.type,
      capacity: String(initial.capacity),
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = Boolean(initial)

  function setField<K extends keyof LabFormData>(
    key: K,
    value: LabFormData[K],
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
      e.name = 'Lab name is required.'
    } else if (form.name.trim().length > 100) {
      e.name = 'Lab name must not exceed 100 characters.'
    }

    if (!isEdit && !LAB_TYPE_OPTIONS.includes(form.type)) {
      e.type = 'Please select a valid lab type.'
    }

    const cap = parseInt(form.capacity, 10)
    if (!form.capacity || isNaN(cap) || cap <= 0 || !Number.isInteger(cap)) {
      e.capacity = 'Capacity must be a positive whole number.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const url = isEdit
        ? `/api/admin/labs/${initial!.id}`
        : '/api/admin/labs'
      const method = isEdit ? 'PATCH' : 'POST'

      // UpdateLabSchema only accepts name + capacity; type is immutable on edit
      const payload = isEdit
        ? {
            name: form.name.trim(),
            capacity: parseInt(form.capacity, 10),
          }
        : {
            name: form.name.trim(),
            type: form.type,
            capacity: parseInt(form.capacity, 10),
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const details = json.error?.details
        if (details?.fieldErrors) {
          const fieldErrors: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(details.fieldErrors)) {
            fieldErrors[field] = (msgs as string[])[0] ?? 'Invalid value.'
          }
          setErrors(fieldErrors)
        }
        toastError({
          title: isEdit ? 'Update Failed' : 'Create Failed',
          message: json.error?.message ?? 'An error occurred.',
        })
        return
      }

      success({
        title: isEdit ? 'Lab Updated' : 'Lab Created',
        message: isEdit
          ? `"${initial!.name}" has been updated.`
          : `Lab "${form.name.trim()}" created successfully.`,
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
      aria-labelledby="lab-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2
            id="lab-modal-title"
            className="text-xl font-bold text-gray-900"
          >
            {isEdit ? `Edit "${initial!.name}"` : 'Create New Lab'}
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
              htmlFor="lab-name"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Lab Name <span className="text-red-500">*</span>
            </label>
            <input
              id="lab-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Pastry Preparation Lab A"
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

          {/* Type — only shown / editable on create; read-only on edit */}
          <div>
            <label
              htmlFor="lab-type"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Lab Type <span className="text-red-500">*</span>
              {isEdit && (
                <span className="ml-1 text-xs text-gray-400 font-normal">
                  (immutable after creation)
                </span>
              )}
            </label>
            {isEdit ? (
              <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <LabTypeBadge type={form.type} />
                <span className="text-sm text-gray-500">
                  Type cannot be changed
                </span>
              </div>
            ) : (
              <>
                <select
                  id="lab-type"
                  value={form.type}
                  onChange={(e) => setField('type', e.target.value as LabType)}
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors.type ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="PREPARATION">Preparation</option>
                  <option value="ASSEMBLY">Assembly</option>
                  <option value="FINISHING">Finishing</option>
                </select>
                {errors.type && (
                  <p className="text-xs text-red-600 mt-1" role="alert">
                    {errors.type}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Capacity */}
          <div>
            <label
              htmlFor="lab-capacity"
              className="block text-sm font-semibold text-gray-700 mb-1"
            >
              Capacity <span className="text-red-500">*</span>
            </label>
            <input
              id="lab-capacity"
              type="number"
              value={form.capacity}
              onChange={(e) => setField('capacity', e.target.value)}
              placeholder="e.g. 10"
              min="1"
              step="1"
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.capacity ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.capacity && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.capacity}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of concurrent production tasks
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
                'Create Lab'
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
  lab: ProductionLab
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({
  lab,
  onClose,
  onConfirmed,
}: DeleteConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/labs/${lab.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete lab.',
        })
        return
      }

      success({
        title: 'Lab Deleted',
        message: `"${lab.name}" has been deleted.`,
      })
      onConfirmed()
    } finally {
      setIsDeleting(false)
    }
  }

  const hasActiveResources =
    lab._count.batches > 0 ||
    lab._count.employees > 0 ||
    lab._count.machines > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2
              id="delete-modal-title"
              className="text-lg font-bold text-gray-900"
            >
              Delete Lab
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-gray-900">"{lab.name}"</span>?
              This action cannot be undone.
            </p>
          </div>
        </div>

        {hasActiveResources && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">This lab has associated data:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              {lab._count.employees > 0 && (
                <li>
                  {lab._count.employees} employee
                  {lab._count.employees !== 1 ? 's' : ''}
                </li>
              )}
              {lab._count.machines > 0 && (
                <li>
                  {lab._count.machines} machine
                  {lab._count.machines !== 1 ? 's' : ''}
                </li>
              )}
              {lab._count.batches > 0 && (
                <li>
                  {lab._count.batches} active batch
                  {lab._count.batches !== 1 ? 'es' : ''}
                </li>
              )}
            </ul>
          </div>
        )}

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
              'Delete Lab'
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

export default function AdminLabsPage() {
  const [labs, setLabs] = useState<ProductionLab[]>([])
  const [displayedLabs, setDisplayedLabs] = useState<ProductionLab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editLab, setEditLab] = useState<ProductionLab | null>(null)
  const [deleteLab, setDeleteLab] = useState<ProductionLab | null>(null)

  const { error: toastError } = useToast()

  const fetchLabs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/labs')
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load production labs.',
        })
        return
      }

      const allLabs: ProductionLab[] = json.data ?? []
      setLabs(allLabs)
      setPage(1)
      setDisplayedLabs(allLabs.slice(0, PAGE_SIZE))
      setHasMore(allLabs.length > PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    fetchLabs()
  }, [fetchLabs])

  const handleLoadMore = () => {
    const nextPage = page + 1
    const nextSlice = labs.slice(0, nextPage * PAGE_SIZE)
    setDisplayedLabs(nextSlice)
    setPage(nextPage)
    setHasMore(nextSlice.length < labs.length)
  }

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditLab(null)
    fetchLabs()
  }

  const handleDeleted = () => {
    setDeleteLab(null)
    fetchLabs()
  }

  // Summary counts
  const totalLabs = labs.length
  const typeCounts = labs.reduce<Record<LabType, number>>(
    (acc, lab) => {
      acc[lab.type] = (acc[lab.type] ?? 0) + 1
      return acc
    },
    { PREPARATION: 0, ASSEMBLY: 0, FINISHING: 0 },
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Production Labs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalLabs} lab{totalLabs !== 1 ? 's' : ''} total
            {totalLabs > 0 && (
              <span className="ml-2 text-gray-400">
                &mdash; {typeCounts.PREPARATION} preparation,{' '}
                {typeCounts.ASSEMBLY} assembly,{' '}
                {typeCounts.FINISHING} finishing
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchLabs}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh labs list"
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
            New Lab
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Production labs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Lab Name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Capacity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Resources
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Stock
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
              {isLoading && labs.length === 0 ? (
                // Skeleton rows during initial load
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayedLabs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-16 text-center text-gray-500"
                  >
                    <FlaskConical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No production labs found</p>
                    <p className="text-xs mt-1">
                      Create your first lab to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                displayedLabs.map((lab) => (
                  <tr
                    key={lab.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {lab.name}
                      </span>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-3">
                      <LabTypeBadge type={lab.type} />
                    </td>

                    {/* Capacity */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {lab.capacity}
                      </span>
                      <span className="text-gray-500 text-xs ml-1">tasks</span>
                    </td>

                    {/* Resources (employees + machines + batches) */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span
                          className="flex items-center gap-1"
                          title="Employees"
                        >
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          {lab._count.employees}
                        </span>
                        <span
                          className="flex items-center gap-1"
                          title="Machines"
                        >
                          <Cpu className="w-3.5 h-3.5 text-gray-400" />
                          {lab._count.machines}
                        </span>
                        <span
                          className="flex items-center gap-1"
                          title="Active batches"
                        >
                          <Layers className="w-3.5 h-3.5 text-gray-400" />
                          {lab._count.batches}
                        </span>
                      </div>
                    </td>

                    {/* Stock summary */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">
                        <span>{lab.stockSummary.totalMaterials} materials</span>
                        {lab.stockSummary.lowStockCount > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            {lab.stockSummary.lowStockCount} low
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditLab(lab)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit lab"
                          aria-label={`Edit ${lab.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteLab(lab)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete lab"
                          aria-label={`Delete ${lab.name}`}
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
              label={`Load More Labs (${labs.length - displayedLabs.length} remaining)`}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <LabFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editLab && (
        <LabFormModal
          initial={editLab}
          onClose={() => setEditLab(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteLab && (
        <DeleteConfirmModal
          lab={deleteLab}
          onClose={() => setDeleteLab(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  )
}
