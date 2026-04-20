'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Search,
  FlaskConical,
  Trash2,
  Edit2,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Package,
  Activity,
} from 'lucide-react'
import {
  LabType,
  LabWithCount,
  Machine,
  RawMaterial,
  LabFormData,
} from '@/lib/types-production'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Local type aliases for convenience
type Lab = LabWithCount

type StockMaterial = RawMaterial

type StockEntry = {
  id: string
  labId: string
  materialId: string
  quantity: string | number
  minThreshold: string | number
  lastUpdated: string
  material: StockMaterial
}

const EMPTY_FORM: LabFormData = {
  name: '',
  type: '',
  capacity: '',
}

const LAB_TYPE_LABELS: Record<LabType, string> = {
  PREPARATION: 'Preparation',
  ASSEMBLY: 'Assembly',
  FINISHING: 'Finishing',
}

const LAB_TYPE_COLORS: Record<LabType, string> = {
  PREPARATION: 'bg-blue-50 text-blue-700',
  ASSEMBLY: 'bg-amber-50 text-amber-700',
  FINISHING: 'bg-green-50 text-green-700',
}

const PAGE_SIZE = 10

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(val: string | number): number {
  if (typeof val === 'number') return val
  return parseFloat(val)
}

// ---------------------------------------------------------------------------
// Lab Form Modal (Create + Edit)
// ---------------------------------------------------------------------------

interface LabFormModalProps {
  initial?: Lab | null
  onClose: () => void
  onSaved: () => void
}

function LabFormModal({ initial, onClose, onSaved }: LabFormModalProps) {
  const { success, error: toastError } = useToast()

  const [form, setForm] = useState<LabFormData>(() => {
    if (!initial) return EMPTY_FORM
    return {
      name: initial.name,
      type: initial.type,
      capacity: String(initial.capacity),
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = Boolean(initial)

  function setField<K extends keyof LabFormData>(key: K, value: LabFormData[K]) {
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

    if (!isEdit && !form.type) {
      e.type = 'Lab type is required.'
    }

    const cap = parseInt(form.capacity, 10)
    if (!form.capacity || isNaN(cap) || cap < 1 || !Number.isInteger(cap)) {
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
      const payload = isEdit
        ? {
            name: form.name.trim(),
            capacity: parseInt(form.capacity, 10),
          }
        : {
            name: form.name.trim(),
            type: form.type as LabType,
            capacity: parseInt(form.capacity, 10),
          }

      const url = isEdit
        ? `/api/admin/labs/${initial!.id}`
        : '/api/admin/labs'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const details = json.error?.details?.fieldErrors
        if (details && typeof details === 'object') {
          const fieldErrors: Record<string, string> = {}
          for (const [field, msgs] of Object.entries(details)) {
            const msgArr = msgs as string[]
            if (msgArr[0] && !fieldErrors[field]) {
              fieldErrors[field] = msgArr[0]
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="lab-modal-title" className="text-xl font-bold text-gray-900">
            {isEdit ? `Edit "${initial!.name}"` : 'Add New Lab'}
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
              placeholder="e.g. Main Preparation Lab"
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

          {/* Type — only for create; type is immutable after creation */}
          {!isEdit && (
            <div>
              <label
                htmlFor="lab-type"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Lab Type <span className="text-red-500">*</span>
              </label>
              <select
                id="lab-type"
                value={form.type}
                onChange={(e) => setField('type', e.target.value as LabType | '')}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white ${
                  errors.type ? 'border-red-400' : 'border-gray-300'
                }`}
              >
                <option value="">Select a type...</option>
                <option value="PREPARATION">Preparation</option>
                <option value="ASSEMBLY">Assembly</option>
                <option value="FINISHING">Finishing</option>
              </select>
              {errors.type && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.type}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Lab type cannot be changed after creation.
              </p>
            </div>
          )}

          {isEdit && (
            <div>
              <p className="block text-sm font-semibold text-gray-700 mb-1">
                Lab Type
              </p>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  LAB_TYPE_COLORS[initial!.type]
                }`}
              >
                {LAB_TYPE_LABELS[initial!.type]}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                Type cannot be changed after creation.
              </p>
            </div>
          )}

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
              Maximum number of concurrent production tasks this lab can handle.
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
                'Add Lab'
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
  lab: Lab
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({ lab, onClose, onConfirmed }: DeleteConfirmModalProps) {
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
        message: `"${lab.name}" has been removed.`,
      })
      onConfirmed()
    } finally {
      setIsDeleting(false)
    }
  }

  const hasBatches = lab._count.batches > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-lab-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2
              id="delete-lab-modal-title"
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

        {hasBatches && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              This lab currently has{' '}
              <span className="font-bold">{lab._count.batches}</span> active
              batch{lab._count.batches !== 1 ? 'es' : ''}. Deleting it may
              affect ongoing production workflows. Ensure all batches are
              completed or reassigned before proceeding.
            </p>
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
// Lab Detail Panel — machines + inventory
// ---------------------------------------------------------------------------

interface LabDetailPanelProps {
  lab: Lab
}

function LabDetailPanel({ lab }: LabDetailPanelProps) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [stock, setStock] = useState<StockEntry[]>([])
  const [isMachinesLoading, setIsMachinesLoading] = useState(true)
  const [isStockLoading, setIsStockLoading] = useState(true)
  const [machinesError, setMachinesError] = useState<string | null>(null)
  const [stockError, setStockError] = useState<string | null>(null)

  const fetchMachines = useCallback(async () => {
    setIsMachinesLoading(true)
    setMachinesError(null)
    try {
      const res = await fetch(`/api/admin/machines?labId=${lab.id}&take=100`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setMachinesError(json.error?.message ?? 'Failed to load machines.')
        return
      }
      setMachines(json.data ?? [])
    } catch {
      setMachinesError('Network error loading machines.')
    } finally {
      setIsMachinesLoading(false)
    }
  }, [lab.id])

  const fetchStock = useCallback(async () => {
    setIsStockLoading(true)
    setStockError(null)
    try {
      const res = await fetch(`/api/admin/lab-stock?labId=${lab.id}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setStockError(json.error?.message ?? 'Failed to load inventory.')
        return
      }
      setStock(json.data ?? [])
    } catch {
      setStockError('Network error loading inventory.')
    } finally {
      setIsStockLoading(false)
    }
  }, [lab.id])

  useEffect(() => {
    fetchMachines()
    fetchStock()
  }, [fetchMachines, fetchStock])

  return (
    <tr>
      <td colSpan={7} className="px-0 pb-0">
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Machines sub-section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-800">
                Machines ({lab._count.machines})
              </h3>
            </div>

            {isMachinesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : machinesError ? (
              <p className="text-xs text-red-600">{machinesError}</p>
            ) : machines.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No machines assigned to this lab.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs" aria-label={`Machines in ${lab.name}`}>
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">
                        Batch Cap.
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">
                        Cycle (min)
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {machines.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{m.name}</td>
                        <td className="px-3 py-2 text-gray-600">{m.type}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{m.batchCapacity}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{m.cycleTimeMinutes}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              m.available
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {m.available ? 'Available' : 'Unavailable'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inventory sub-section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-gray-800">
                Inventory ({lab.stockSummary.totalMaterials} material
                {lab.stockSummary.totalMaterials !== 1 ? 's' : ''})
                {lab.stockSummary.lowStockCount > 0 && (
                  <span className="ml-2 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    {lab.stockSummary.lowStockCount} low
                  </span>
                )}
              </h3>
            </div>

            {isStockLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            ) : stockError ? (
              <p className="text-xs text-red-600">{stockError}</p>
            ) : stock.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No stock recorded for this lab.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs" aria-label={`Inventory in ${lab.name}`}>
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">
                        Min.
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600 uppercase tracking-wider">
                        Level
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {stock.map((s) => {
                      const qty = toNumber(s.quantity)
                      const min = toNumber(s.minThreshold)
                      const isLow = qty <= min
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {s.material.name}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{s.material.type}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-800">
                            {qty.toFixed(2)}{' '}
                            <span className="font-normal text-gray-500">
                              {s.material.unit}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {min.toFixed(2)}{' '}
                            <span className="text-gray-400">{s.material.unit}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isLow
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-green-50 text-green-700'
                              }`}
                            >
                              {isLow ? 'Low' : 'OK'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Lab Row
// ---------------------------------------------------------------------------

interface LabRowProps {
  lab: Lab
  onEdit: (lab: Lab) => void
  onDelete: (lab: Lab) => void
}

function LabRow({ lab, onEdit, onDelete }: LabRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const utilizationPercent =
    lab.capacity > 0 ? Math.min((lab._count.batches / lab.capacity) * 100, 100) : 0

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        {/* Expand toggle */}
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setIsExpanded((p) => !p)}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
            aria-label={isExpanded ? `Collapse ${lab.name}` : `Expand ${lab.name}`}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </td>

        {/* Lab name */}
        <td className="px-4 py-3">
          <span className="font-semibold text-gray-900">{lab.name}</span>
        </td>

        {/* Type badge */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              LAB_TYPE_COLORS[lab.type]
            }`}
          >
            {LAB_TYPE_LABELS[lab.type]}
          </span>
        </td>

        {/* Capacity */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1 min-w-[100px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                {lab._count.batches}/{lab.capacity}
              </span>
              <span
                className={`font-semibold ${
                  utilizationPercent >= 90
                    ? 'text-red-600'
                    : utilizationPercent >= 70
                    ? 'text-amber-600'
                    : 'text-green-600'
                }`}
              >
                {Math.round(utilizationPercent)}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  utilizationPercent >= 90
                    ? 'bg-red-500'
                    : utilizationPercent >= 70
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${utilizationPercent}%` }}
                role="progressbar"
                aria-valuenow={Math.round(utilizationPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${lab.name} utilization`}
              />
            </div>
          </div>
        </td>

        {/* Machines count */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
            <Cpu className="w-3 h-3" />
            {lab._count.machines}
          </span>
        </td>

        {/* Stock summary */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-600">
              {lab.stockSummary.totalMaterials} material
              {lab.stockSummary.totalMaterials !== 1 ? 's' : ''}
            </span>
            {lab.stockSummary.lowStockCount > 0 && (
              <span className="text-xs font-semibold text-red-600">
                {lab.stockSummary.lowStockCount} low stock
              </span>
            )}
          </div>
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => onEdit(lab)}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
              title="Edit lab"
              aria-label={`Edit ${lab.name}`}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(lab)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete lab"
              aria-label={`Delete ${lab.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail panel */}
      {isExpanded && <LabDetailPanel lab={lab} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminLabsPage() {
  const [labs, setLabs] = useState<Lab[]>([])
  const [displayedLabs, setDisplayedLabs] = useState<Lab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editLab, setEditLab] = useState<Lab | null>(null)
  const [deleteLab, setDeleteLab] = useState<Lab | null>(null)

  const { error: toastError } = useToast()

  const fetchLabs = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/labs')
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load labs.',
        })
        return
      }

      const allLabs: Lab[] = json.data ?? []

      // Client-side filter by name
      const filtered = search.trim()
        ? allLabs.filter((l) =>
            l.name.toLowerCase().includes(search.trim().toLowerCase()),
          )
        : allLabs

      setLabs(filtered)
      setTotal(filtered.length)
      setPage(1)
      setDisplayedLabs(filtered.slice(0, PAGE_SIZE))
      setHasMore(filtered.length > PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
  }, [search, toastError])

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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Labs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} lab{total !== 1 ? 's' : ''} total
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
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lab
          </button>
        </div>
      </div>

      {/* Search / filter by name */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by lab name..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Stats strip */}
      {!isLoading && labs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(
            [
              ['PREPARATION', 'Preparation', 'text-blue-700 bg-blue-50'],
              ['ASSEMBLY', 'Assembly', 'text-amber-700 bg-amber-50'],
              ['FINISHING', 'Finishing', 'text-green-700 bg-green-50'],
            ] as [LabType, string, string][]
          ).map(([type, label, cls]) => {
            const count = labs.filter((l) => l.type === type).length
            return (
              <div
                key={type}
                className={`rounded-xl px-4 py-3 flex items-center gap-3 ${cls.split(' ')[1]} border border-opacity-20`}
              >
                <FlaskConical className={`w-5 h-5 ${cls.split(' ')[0]}`} />
                <div>
                  <p className={`text-lg font-bold ${cls.split(' ')[0]}`}>{count}</p>
                  <p className="text-xs text-gray-600">{label}</p>
                </div>
              </div>
            )
          })}
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-purple-50 border border-purple-100">
            <Activity className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-lg font-bold text-purple-700">
                {labs.reduce((sum, l) => sum + l._count.batches, 0)}
              </p>
              <p className="text-xs text-gray-600">Active Batches</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Production Labs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 w-10"
                  aria-label="Expand row"
                />
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
                  Load / Capacity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Machines
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Inventory
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
                // Skeleton rows
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : displayedLabs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                    <FlaskConical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No labs found</p>
                    <p className="text-xs mt-1">
                      {search.trim()
                        ? 'Try a different name filter.'
                        : 'Add your first production lab to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedLabs.map((lab) => (
                  <LabRow
                    key={lab.id}
                    lab={lab}
                    onEdit={setEditLab}
                    onDelete={setDeleteLab}
                  />
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
