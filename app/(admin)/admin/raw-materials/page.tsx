'use client'

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
  CheckCircle,
  XCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawMaterial {
  id: string
  name: string
  type: string
  unit: string
  isIntermediate: boolean
  productionRecipeId: string | null
  createdAt: string
  updatedAt: string
}

interface Recipe {
  id: string
  name: string
}

interface RawMaterialFormData {
  name: string
  type: string
  unit: string
  isIntermediate: boolean
  productionRecipeId: string
}

const EMPTY_FORM: RawMaterialFormData = {
  name: '',
  type: '',
  unit: '',
  isIntermediate: false,
  productionRecipeId: '',
}

// Common material types for convenience
const MATERIAL_TYPE_SUGGESTIONS = [
  'Flour',
  'Sugar',
  'Fat',
  'Nut',
  'Spice',
  'Syrup',
  'Dairy',
  'Egg',
  'Seed',
  'Dried Fruit',
  'Other',
]

// Common units
const UNIT_SUGGESTIONS = ['kg', 'g', 'L', 'mL', 'pieces', 'tbsp', 'tsp']

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function IntermediateBadge({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
        <CheckCircle className="w-3 h-3" />
        In-house
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" />
      External
    </span>
  )
}

// ---------------------------------------------------------------------------
// Raw Material Form Modal (Create + Edit)
// ---------------------------------------------------------------------------

interface RawMaterialFormModalProps {
  initial?: RawMaterial | null
  recipes: Recipe[]
  onClose: () => void
  onSaved: () => void
}

function RawMaterialFormModal({
  initial,
  recipes,
  onClose,
  onSaved,
}: RawMaterialFormModalProps) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState<RawMaterialFormData>(() => {
    if (!initial) return EMPTY_FORM
    return {
      name: initial.name,
      type: initial.type,
      unit: initial.unit,
      isIntermediate: initial.isIntermediate,
      productionRecipeId: initial.productionRecipeId ?? '',
    }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = Boolean(initial)

  function setField<K extends keyof RawMaterialFormData>(
    key: K,
    value: RawMaterialFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleIntermediateToggle(checked: boolean) {
    setForm((prev) => ({
      ...prev,
      isIntermediate: checked,
      // Clear recipe selection when un-checking
      productionRecipeId: checked ? prev.productionRecipeId : '',
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.isIntermediate
      delete next.productionRecipeId
      return next
    })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}

    if (!form.name.trim()) e.name = 'Material name is required.'
    else if (form.name.trim().length > 100)
      e.name = 'Name must not exceed 100 characters.'

    if (!form.type.trim()) e.type = 'Material type is required.'
    else if (form.type.trim().length > 50)
      e.type = 'Type must not exceed 50 characters.'

    if (!form.unit.trim()) e.unit = 'Unit of measurement is required.'
    else if (form.unit.trim().length > 20)
      e.unit = 'Unit must not exceed 20 characters.'

    if (form.isIntermediate && !form.productionRecipeId) {
      e.productionRecipeId =
        'A production recipe is required for in-house materials.'
    }
    if (!form.isIntermediate && form.productionRecipeId) {
      e.productionRecipeId =
        'Recipe should only be set for in-house (intermediate) materials.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type.trim(),
        unit: form.unit.trim(),
        isIntermediate: form.isIntermediate,
      }

      if (form.isIntermediate && form.productionRecipeId) {
        payload.productionRecipeId = form.productionRecipeId
      }

      const url = isEdit
        ? `/api/admin/raw-materials/${initial!.id}`
        : '/api/admin/raw-materials'
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
        title: isEdit ? 'Material Updated' : 'Material Created',
        message: isEdit
          ? `${initial!.name} has been updated.`
          : `${form.name.trim()} created successfully.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-600" />
            {isEdit ? `Edit: ${initial!.name}` : 'Add Raw Material'}
          </h2>
          <button
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
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Almond Flour"
              maxLength={100}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Type + Unit side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="type-suggestions"
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                placeholder="e.g. Flour"
                maxLength={50}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.type ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <datalist id="type-suggestions">
                {MATERIAL_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              {errors.type && (
                <p className="text-xs text-red-600 mt-1">{errors.type}</p>
              )}
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Unit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="unit-suggestions"
                value={form.unit}
                onChange={(e) => setField('unit', e.target.value)}
                placeholder="e.g. kg"
                maxLength={20}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.unit ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
              {errors.unit && (
                <p className="text-xs text-red-600 mt-1">{errors.unit}</p>
              )}
            </div>
          </div>

          {/* isIntermediate toggle */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
            <input
              type="checkbox"
              id="isIntermediate"
              checked={form.isIntermediate}
              onChange={(e) => handleIntermediateToggle(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-600"
            />
            <div>
              <label
                htmlFor="isIntermediate"
                className="text-sm font-semibold text-gray-700 cursor-pointer"
              >
                In-house intermediate material
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Check this if the material is produced in your own lab rather
                than purchased from a supplier.
              </p>
            </div>
          </div>

          {/* Production Recipe (only shown when isIntermediate is true) */}
          {form.isIntermediate && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Production Recipe <span className="text-red-500">*</span>
              </label>
              {recipes.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No recipes found. Create a recipe first before assigning it
                  here.
                </p>
              ) : (
                <select
                  value={form.productionRecipeId}
                  onChange={(e) =>
                    setField('productionRecipeId', e.target.value)
                  }
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors.productionRecipeId
                      ? 'border-red-400'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a recipe…</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              {errors.productionRecipeId && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.productionRecipeId}
                </p>
              )}
            </div>
          )}

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
                'Add Material'
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
  material,
  onClose,
  onConfirmed,
}: {
  material: RawMaterial
  onClose: () => void
  onConfirmed: () => void
}) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/raw-materials/${material.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete material.',
        })
        return
      }

      success({
        title: 'Material Deleted',
        message: `${material.name} has been removed.`,
      })
      onConfirmed()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Delete Raw Material
        </h2>
        <p className="text-gray-600 mb-1">
          Are you sure you want to delete{' '}
          <span className="font-bold text-gray-900">{material.name}</span>?
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          This action cannot be undone. Deletion will fail if this material is
          referenced by any recipe ingredients.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
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

export default function AdminRawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterIntermediate, setFilterIntermediate] = useState<
    'all' | 'true' | 'false'
  >('all')

  // Offset-based pagination (matches the API: skip / take / hasMore)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 25

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editMaterial, setEditMaterial] = useState<RawMaterial | null>(null)
  const [deleteMaterial, setDeleteMaterial] = useState<RawMaterial | null>(null)

  const { error: toastError } = useToast()

  // ---------------------------------------------------------------------------
  // Fetch recipes once for the recipe select dropdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/admin/recipes?take=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setRecipes(
            (json.data as { id: string; name: string }[]).map((r) => ({
              id: r.id,
              name: r.name,
            })),
          )
        }
      })
      .catch(() => {
        // Non-fatal: recipe dropdown will just be empty
      })
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch materials
  // ---------------------------------------------------------------------------
  const fetchMaterials = useCallback(
    async (reset = false) => {
      setIsLoading(true)
      const nextSkip = reset ? 0 : skip
      try {
        const params = new URLSearchParams({
          skip: String(nextSkip),
          take: String(PAGE_SIZE),
        })

        if (filterIntermediate !== 'all') {
          params.set('isIntermediate', filterIntermediate)
        }

        const res = await fetch(
          `/api/admin/raw-materials?${params.toString()}`,
        )
        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Load Failed',
            message: json.error?.message ?? 'Failed to load raw materials.',
          })
          return
        }

        setMaterials((prev) =>
          reset
            ? (json.data as RawMaterial[])
            : [...prev, ...(json.data as RawMaterial[])],
        )
        setTotal(json.pagination.total)
        setHasMore(json.pagination.hasMore)
        if (reset) setSkip(PAGE_SIZE)
        else setSkip(nextSkip + PAGE_SIZE)
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterIntermediate, skip, toastError],
  )

  // Initial load + re-fetch when filters change
  useEffect(() => {
    setSkip(0)
    setMaterials([])
    // Reset skip before fetching — pass true to signal a full reset
    fetchMaterialsReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterIntermediate])

  // Separate stable reference for a clean-reset fetch so we don't
  // depend on `skip` being correct inside the effect above.
  const fetchMaterialsReset = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        skip: '0',
        take: String(PAGE_SIZE),
      })
      if (filterIntermediate !== 'all') {
        params.set('isIntermediate', filterIntermediate)
      }

      const res = await fetch(`/api/admin/raw-materials?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load raw materials.',
        })
        return
      }

      setMaterials(json.data as RawMaterial[])
      setTotal(json.pagination.total)
      setHasMore(json.pagination.hasMore)
      setSkip(PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterIntermediate, toastError])

  // Run once on mount
  useEffect(() => {
    fetchMaterialsReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditMaterial(null)
    fetchMaterialsReset()
  }

  const handleDeleted = () => {
    setDeleteMaterial(null)
    fetchMaterialsReset()
  }

  // Client-side search filter (applied over the fetched page)
  const filtered = search.trim()
    ? materials.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.type.toLowerCase().includes(search.toLowerCase()),
      )
    : materials

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Raw Materials</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} material{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchMaterialsReset}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Refresh"
            aria-label="Refresh materials list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        </div>
      </div>

      {/* Toolbar: search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or type…"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <select
          value={filterIntermediate}
          onChange={(e) =>
            setFilterIntermediate(e.target.value as 'all' | 'true' | 'false')
          }
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          aria-label="Filter by material source"
        >
          <option value="all">All materials</option>
          <option value="false">External only</option>
          <option value="true">In-house only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && materials.length === 0 ? (
                // Skeleton rows while loading the first page
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <FlaskConical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No materials found</p>
                    <p className="text-xs mt-1">
                      {search
                        ? 'Try a different search term.'
                        : 'Add your first raw material.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((material) => (
                  <tr
                    key={material.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {material.name}
                      </span>
                      {material.productionRecipeId && (
                        <span className="block text-xs text-gray-400 mt-0.5 font-mono">
                          Recipe linked
                        </span>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                        {material.type}
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {material.unit}
                    </td>

                    {/* Source badge */}
                    <td className="px-4 py-3">
                      <IntermediateBadge value={material.isIntermediate} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditMaterial(material)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit material"
                          aria-label={`Edit ${material.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteMaterial(material)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete material"
                          aria-label={`Delete ${material.name}`}
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
        {hasMore && !search && (
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={() => fetchMaterials(false)}
              isLoading={isLoading}
              label="Load More Materials"
            />
          </div>
        )}

        {/* Search note when client filtering is hiding server results */}
        {search && hasMore && (
          <div className="px-4 py-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Showing results from loaded materials only.{' '}
              <button
                onClick={() => setSearch('')}
                className="text-amber-600 font-medium hover:underline"
              >
                Clear search
              </button>{' '}
              to load more.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <RawMaterialFormModal
          recipes={recipes}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editMaterial && (
        <RawMaterialFormModal
          initial={editMaterial}
          recipes={recipes}
          onClose={() => setEditMaterial(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteMaterial && (
        <DeleteConfirmModal
          material={deleteMaterial}
          onClose={() => setDeleteMaterial(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  )
}
