'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  Edit2,
  X,
  Loader2,
  RefreshCw,
  Clock,
  Package,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
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
}

interface RecipeIngredientDetail {
  id: string
  recipeId: string
  rawMaterialId: string | null
  intermediateProductId: string | null
  quantity: number | string
  unit: string
  rawMaterial?: { id: string; name: string; type: string; unit: string } | null
  intermediateProduct?: { id: string; name: string; type: string; unit: string } | null
}

interface Recipe {
  id: string
  name: string
  description: string | null
  laborMinutes: number
  createdAt: string
  updatedAt: string
  _count?: { ingredients: number; batches: number }
  ingredients?: RecipeIngredientDetail[]
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface IngredientRow {
  /** Client-side key for React reconciliation — not sent to the API. */
  _key: string
  rawMaterialId: string
  quantity: string
  unit: string
}

interface RecipeFormData {
  name: string
  description: string
  laborMinutes: string
  ingredients: IngredientRow[]
}

const EMPTY_FORM: RecipeFormData = {
  name: '',
  description: '',
  laborMinutes: '',
  ingredients: [],
}

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _keyCounter = 0
function nextKey(): string {
  return `ing_${++_keyCounter}_${Date.now()}`
}

function formatLaborTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function resolveIngredientName(ing: RecipeIngredientDetail): string {
  if (ing.rawMaterial?.name) return ing.rawMaterial.name
  if (ing.intermediateProduct?.name) return ing.intermediateProduct.name
  return 'Unknown material'
}

// ---------------------------------------------------------------------------
// Inline ingredient add sub-form
// ---------------------------------------------------------------------------

interface IngredientSubFormProps {
  materials: RawMaterial[]
  usedMaterialIds: string[]
  onAdd: (row: IngredientRow) => void
  onCancel: () => void
}

function IngredientSubForm({
  materials,
  usedMaterialIds,
  onAdd,
  onCancel,
}: IngredientSubFormProps) {
  const [rawMaterialId, setRawMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const available = search.trim()
    ? materials.filter(
        (m) =>
          !usedMaterialIds.includes(m.id) &&
          (m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.type.toLowerCase().includes(search.toLowerCase())),
      )
    : materials.filter((m) => !usedMaterialIds.includes(m.id))

  const selectedMaterial = materials.find((m) => m.id === rawMaterialId)

  const handleMaterialSelect = (id: string) => {
    setRawMaterialId(id)
    const mat = materials.find((m) => m.id === id)
    if (mat && !unit) setUnit(mat.unit)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.rawMaterialId
      return next
    })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!rawMaterialId) e.rawMaterialId = 'Please select a material.'
    const qty = parseFloat(quantity)
    if (!quantity || isNaN(qty) || qty <= 0)
      e.quantity = 'Quantity must be a positive number.'
    if (!unit.trim()) e.unit = 'Unit is required.'
    else if (unit.trim().length > 20)
      e.unit = 'Unit must not exceed 20 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = () => {
    if (!validate()) return
    onAdd({ _key: nextKey(), rawMaterialId, quantity, unit: unit.trim() })
  }

  return (
    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Add Ingredient</p>

      {/* Material search */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Material <span className="text-red-500">*</span>
        </label>
        <div className="relative mb-1">
          <Search className="absolute left-2.5 inset-y-0 my-auto w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials..."
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
        </div>
        <select
          value={rawMaterialId}
          onChange={(e) => handleMaterialSelect(e.target.value)}
          size={Math.min(available.length + 1, 5)}
          className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white ${
            errors.rawMaterialId ? 'border-red-400' : 'border-gray-300'
          }`}
        >
          <option value="">Select a material...</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.type} · {m.unit})
            </option>
          ))}
          {available.length === 0 && (
            <option value="" disabled>
              No materials match
            </option>
          )}
        </select>
        {selectedMaterial && (
          <p className="text-xs text-amber-700 mt-1">
            Default unit: <span className="font-medium">{selectedMaterial.unit}</span>
          </p>
        )}
        {errors.rawMaterialId && (
          <p className="text-xs text-red-600 mt-1" role="alert">
            {errors.rawMaterialId}
          </p>
        )}
      </div>

      {/* Quantity + Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value)
              setErrors((prev) => {
                const next = { ...prev }
                delete next.quantity
                return next
              })
            }}
            placeholder="e.g. 2.5"
            min="0.001"
            step="0.001"
            className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.quantity ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.quantity && (
            <p className="text-xs text-red-600 mt-1" role="alert">
              {errors.quantity}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            list="prod-ing-unit-suggestions"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value)
              setErrors((prev) => {
                const next = { ...prev }
                delete next.unit
                return next
              })
            }}
            placeholder="kg"
            maxLength={20}
            className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.unit ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          <datalist id="prod-ing-unit-suggestions">
            {['kg', 'g', 'L', 'mL', 'pieces', 'tbsp', 'tsp', 'cups'].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {errors.unit && (
            <p className="text-xs text-red-600 mt-1" role="alert">
              {errors.unit}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="flex-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recipe Form Modal (Create + Edit)
// ---------------------------------------------------------------------------

interface RecipeFormModalProps {
  initial?: Recipe | null
  materials: RawMaterial[]
  onClose: () => void
  onSaved: () => void
}

function RecipeFormModal({ initial, materials, onClose, onSaved }: RecipeFormModalProps) {
  const { success, error: toastError } = useToast()
  const isEdit = Boolean(initial)

  const [form, setForm] = useState<RecipeFormData>(() => {
    if (!initial) return EMPTY_FORM
    const ingredients: IngredientRow[] = (initial.ingredients ?? []).map((ing) => ({
      _key: nextKey(),
      rawMaterialId: ing.rawMaterialId ?? ing.intermediateProductId ?? '',
      quantity: String(ing.quantity),
      unit: ing.unit,
    }))
    return {
      name: initial.name,
      description: initial.description ?? '',
      laborMinutes: String(initial.laborMinutes),
      ingredients,
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSubForm, setShowSubForm] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Fetch full ingredient details when editing and ingredients aren't loaded yet
  useEffect(() => {
    if (!initial) return
    if (initial.ingredients && initial.ingredients.length > 0) return
    if ((initial._count?.ingredients ?? 0) === 0) return

    setLoadingDetail(true)
    fetch(`/api/admin/recipes/${initial.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.ingredients) {
          const rows: IngredientRow[] = json.data.ingredients.map(
            (ing: RecipeIngredientDetail) => ({
              _key: nextKey(),
              rawMaterialId: ing.rawMaterialId ?? ing.intermediateProductId ?? '',
              quantity: String(ing.quantity),
              unit: ing.unit,
            }),
          )
          setForm((prev) => ({ ...prev, ingredients: rows }))
        }
      })
      .catch(() => {
        // Non-fatal — form shows empty ingredients; user can re-add
      })
      .finally(() => setLoadingDetail(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setField<K extends keyof Omit<RecipeFormData, 'ingredients'>>(
    key: K,
    value: RecipeFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function addIngredient(row: IngredientRow) {
    setForm((prev) => ({ ...prev, ingredients: [...prev.ingredients, row] }))
    setShowSubForm(false)
    setErrors((prev) => {
      const next = { ...prev }
      delete next.ingredients
      return next
    })
  }

  function removeIngredient(key: string) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((r) => r._key !== key),
    }))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}

    if (!form.name.trim()) e.name = 'Recipe name is required.'
    else if (form.name.trim().length > 100) e.name = 'Name must not exceed 100 characters.'

    if (form.description.length > 500)
      e.description = 'Description must not exceed 500 characters.'

    const lm = parseInt(form.laborMinutes, 10)
    if (!form.laborMinutes || isNaN(lm) || lm <= 0 || !Number.isInteger(lm))
      e.laborMinutes = 'Labor time must be a positive whole number of minutes.'

    if (form.ingredients.length === 0)
      e.ingredients = 'At least one ingredient is required.'

    const ids = form.ingredients.map((r) => r.rawMaterialId).filter(Boolean)
    if (new Set(ids).size < ids.length)
      e.ingredients = 'Duplicate materials are not allowed in the same recipe.'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const ingredients = form.ingredients.map((row) => ({
        rawMaterialId: row.rawMaterialId,
        quantity: parseFloat(row.quantity),
        unit: row.unit,
      }))

      const payload = {
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        laborMinutes: parseInt(form.laborMinutes, 10),
        ingredients,
      }

      const url = isEdit ? `/api/admin/recipes/${initial!.id}` : '/api/admin/recipes'
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
        title: isEdit ? 'Recipe Updated' : 'Recipe Created',
        message: isEdit
          ? `"${initial!.name}" has been updated.`
          : `"${form.name.trim()}" created successfully.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const materialMap = new Map(materials.map((m) => [m.id, m]))
  const usedMaterialIds = form.ingredients.map((r) => r.rawMaterialId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2
            id="recipe-modal-title"
            className="text-xl font-bold text-gray-900 flex items-center gap-2"
          >
            <BookOpen className="w-5 h-5 text-amber-600" />
            {isEdit ? `Edit: ${initial!.name}` : 'Create New Recipe'}
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

        {loadingDetail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading ingredient details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label
                htmlFor="recipe-name"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Recipe Name <span className="text-red-500">*</span>
              </label>
              <input
                id="recipe-name"
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Almond Briouate"
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

            {/* Description */}
            <div>
              <label
                htmlFor="recipe-description"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Description{' '}
                <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <textarea
                id="recipe-description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Brief description of this recipe..."
                maxLength={500}
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none ${
                  errors.description ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {form.description.length}/500
              </p>
              {errors.description && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Labor Minutes */}
            <div>
              <label
                htmlFor="recipe-labor"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Labor Time (minutes) <span className="text-red-500">*</span>
              </label>
              <div className="relative max-w-xs">
                <Clock className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="recipe-labor"
                  type="number"
                  value={form.laborMinutes}
                  onChange={(e) => setField('laborMinutes', e.target.value)}
                  placeholder="60"
                  min="1"
                  step="1"
                  className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors.laborMinutes ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.laborMinutes && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.laborMinutes}
                </p>
              )}
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Ingredients <span className="text-red-500">*</span>
                  {form.ingredients.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({form.ingredients.length} added)
                    </span>
                  )}
                </label>
                {!showSubForm && (
                  <button
                    type="button"
                    onClick={() => setShowSubForm(true)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Ingredient
                  </button>
                )}
              </div>

              {errors.ingredients && (
                <p className="text-xs text-red-600 mb-2" role="alert">
                  {errors.ingredients}
                </p>
              )}

              {/* Added ingredient pills */}
              {form.ingredients.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {form.ingredients.map((row) => {
                    const mat = materialMap.get(row.rawMaterialId)
                    const label = mat?.name ?? row.rawMaterialId
                    return (
                      <div
                        key={row._key}
                        className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-900 truncate">
                            {label}
                          </span>
                          <span className="text-xs text-amber-700 font-medium whitespace-nowrap">
                            {row.quantity} {row.unit}
                          </span>
                          {mat && (
                            <span className="text-xs text-gray-400 hidden sm:inline">
                              ({mat.type})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeIngredient(row._key)}
                          className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                          aria-label={`Remove ${label}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {form.ingredients.length === 0 && !showSubForm && (
                <div className="border-2 border-dashed border-gray-200 rounded-lg py-8 text-center text-gray-400 text-sm mb-3">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No ingredients yet. Add at least one ingredient.
                </div>
              )}

              {/* Inline sub-form */}
              {showSubForm && (
                <IngredientSubForm
                  materials={materials}
                  usedMaterialIds={usedMaterialIds}
                  onAdd={addIngredient}
                  onCancel={() => setShowSubForm(false)}
                />
              )}
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
                disabled={isSaving || loadingDetail}
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
                  'Create Recipe'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  recipe: Recipe
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({ recipe, onClose, onConfirmed }: DeleteConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const batchCount = recipe._count?.batches ?? 0

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/recipes/${recipe.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete recipe.',
        })
        return
      }

      success({
        title: 'Recipe Deleted',
        message: `"${recipe.name}" has been removed.`,
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
      aria-labelledby="delete-recipe-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2
              id="delete-recipe-modal-title"
              className="text-lg font-bold text-gray-900"
            >
              Delete Recipe
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-gray-900">"{recipe.name}"</span>?
              This action cannot be undone.
            </p>
          </div>
        </div>

        {batchCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              This recipe is used by {batchCount} production batch
              {batchCount !== 1 ? 'es' : ''}.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Active (planned, in-progress, or paused) batches must be completed
              or cancelled before this recipe can be deleted.
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
              'Delete Recipe'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Expanded row: full ingredient list
// ---------------------------------------------------------------------------

interface ExpandedIngredientListProps {
  recipeId: string
  colSpan: number
}

function ExpandedIngredientList({ recipeId, colSpan }: ExpandedIngredientListProps) {
  const [ingredients, setIngredients] = useState<RecipeIngredientDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/admin/recipes/${recipeId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data?.ingredients)) {
          setIngredients(json.data.ingredients)
        } else {
          setError(json.error?.message ?? 'Failed to load ingredients.')
        }
      })
      .catch(() => setError('Network error while loading ingredients.'))
      .finally(() => setIsLoading(false))
  }, [recipeId])

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0">
        <div className="bg-blue-50 border-t border-b border-blue-100 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              Loading ingredients...
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : ingredients.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No ingredients recorded for this recipe.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3">
                Ingredients ({ingredients.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ingredients.map((ing) => {
                  const name = resolveIngredientName(ing)
                  const qty = typeof ing.quantity === 'number'
                    ? ing.quantity
                    : parseFloat(String(ing.quantity))
                  const isIntermediate = Boolean(ing.intermediateProductId)
                  return (
                    <div
                      key={ing.id}
                      className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2"
                    >
                      <Package
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isIntermediate ? 'text-violet-500' : 'text-amber-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)} {ing.unit}
                          {isIntermediate && (
                            <span className="ml-1.5 text-violet-600 font-medium">
                              (intermediate)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProductionRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [displayedRecipes, setDisplayedRecipes] = useState<Recipe[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [deleteRecipe, setDeleteRecipe] = useState<Recipe | null>(null)

  const { error: toastError } = useToast()

  // ---------------------------------------------------------------------------
  // Fetch raw materials (for ingredient dropdown in form)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/admin/raw-materials?take=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setMaterials(json.data as RawMaterial[])
      })
      .catch(() => {
        // Non-fatal: ingredient selector will be empty
      })
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch recipes (all at once into memory, then paginate client-side)
  // ---------------------------------------------------------------------------
  const fetchRecipes = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/recipes?skip=0&take=200')
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load recipes.',
        })
        return
      }

      const all: Recipe[] = json.data ?? []
      setRecipes(all)
      setTotal(json.pagination?.total ?? all.length)
      setPage(1)
      setDisplayedRecipes(all.slice(0, PAGE_SIZE))
      setHasMore(all.length > PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
  }, [toastError])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  // ---------------------------------------------------------------------------
  // Search filter (client-side over loaded recipes)
  // ---------------------------------------------------------------------------
  const filtered = search.trim()
    ? recipes.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : displayedRecipes

  const handleLoadMore = () => {
    if (search.trim()) return // load-more is hidden when filtering
    const nextPage = page + 1
    const nextSlice = recipes.slice(0, nextPage * PAGE_SIZE)
    setDisplayedRecipes(nextSlice)
    setPage(nextPage)
    setHasMore(nextSlice.length < recipes.length)
  }

  // ---------------------------------------------------------------------------
  // Modal callbacks
  // ---------------------------------------------------------------------------
  const handleSaved = () => {
    setShowCreateModal(false)
    setEditRecipe(null)
    fetchRecipes()
  }

  const handleDeleted = () => {
    setDeleteRecipe(null)
    fetchRecipes()
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const TABLE_COLS = 5

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Recipes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} recipe{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchRecipes}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh recipes list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Recipe
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or description..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          aria-label="Search recipes"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 inset-y-0 my-auto text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Recipes">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-8"
                />
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Labor Time
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Ingredients
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
              {isLoading && recipes.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: TABLE_COLS + 1 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={TABLE_COLS + 1}
                    className="px-4 py-16 text-center text-gray-500"
                  >
                    <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No recipes found</p>
                    <p className="text-xs mt-1">
                      {search.trim()
                        ? 'Try a different search term.'
                        : 'Create your first recipe to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((recipe) => {
                  const isExpanded = expandedId === recipe.id
                  const ingredientCount = recipe._count?.ingredients ?? 0

                  return (
                    <React.Fragment key={recipe.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        {/* Expand toggle */}
                        <td className="px-4 py-3 w-8">
                          <button
                            type="button"
                            onClick={() => toggleExpand(recipe.id)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            aria-label={
                              isExpanded
                                ? `Collapse ${recipe.name} ingredients`
                                : `Expand ${recipe.name} ingredients`
                            }
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">
                            {recipe.name}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 max-w-xs">
                          {recipe.description ? (
                            <span
                              className="text-gray-600 text-xs line-clamp-2"
                              title={recipe.description}
                            >
                              {recipe.description}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs italic">
                              No description
                            </span>
                          )}
                        </td>

                        {/* Labor time */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {formatLaborTime(recipe.laborMinutes)}
                          </span>
                        </td>

                        {/* Ingredient count */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <Package className="w-3 h-3 text-amber-500" />
                            {ingredientCount}{' '}
                            {ingredientCount === 1 ? 'ingredient' : 'ingredients'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditRecipe(recipe)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="Edit recipe"
                              aria-label={`Edit ${recipe.name}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteRecipe(recipe)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete recipe"
                              aria-label={`Delete ${recipe.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded ingredient details row */}
                      {isExpanded && (
                        <ExpandedIngredientList
                          recipeId={recipe.id}
                          colSpan={TABLE_COLS + 1}
                        />
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load more (only shown when not filtering) */}
        {hasMore && !search.trim() && (
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={handleLoadMore}
              isLoading={false}
              label={`Load More Recipes (${recipes.length - displayedRecipes.length} remaining)`}
            />
          </div>
        )}

        {/* Search scope note */}
        {search.trim() && hasMore && (
          <div className="px-4 py-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Searching within loaded recipes only.{' '}
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-amber-600 font-medium hover:underline"
              >
                Clear search
              </button>{' '}
              to see all.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <RecipeFormModal
          materials={materials}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editRecipe && (
        <RecipeFormModal
          initial={editRecipe}
          materials={materials}
          onClose={() => setEditRecipe(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteRecipe && (
        <DeleteConfirmModal
          recipe={deleteRecipe}
          onClose={() => setDeleteRecipe(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  )
}
