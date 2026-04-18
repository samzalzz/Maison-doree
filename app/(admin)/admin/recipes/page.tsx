'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { useRouter } from 'next/navigation'
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
  GitBranch,
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
  quantity: number
  unit: string
  rawMaterial?: { id: string; name: string; type: string; unit: string } | null
  intermediateProduct?: {
    id: string
    name: string
    type: string
    unit: string
  } | null
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

/** A single ingredient row as managed in local form state. */
interface IngredientRow {
  /** Client-side key used as React key — not sent to the API. */
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

const UNIT_SUGGESTIONS = ['kg', 'g', 'L', 'mL', 'pieces', 'tbsp', 'tsp', 'cups']

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helper: generate a stable client-side key for new ingredient rows
// ---------------------------------------------------------------------------
let _keyCounter = 0
function nextKey() {
  return `ing_${++_keyCounter}_${Date.now()}`
}

// ---------------------------------------------------------------------------
// Helper: resolve the display name for an ingredient in list form
// ---------------------------------------------------------------------------
function ingredientDisplayName(
  ing: RecipeIngredientDetail,
  materials: RawMaterial[],
): string {
  if (ing.rawMaterial) return ing.rawMaterial.name
  if (ing.intermediateProduct) return ing.intermediateProduct.name
  // Fall back to looking up by id in the materials list
  const found = materials.find(
    (m) => m.id === ing.rawMaterialId || m.id === ing.intermediateProductId,
  )
  return found?.name ?? 'Unknown material'
}

// ---------------------------------------------------------------------------
// Ingredient sub-form (inline, inside the recipe modal)
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

  const filteredMaterials = search.trim()
    ? materials.filter(
        (m) =>
          !usedMaterialIds.includes(m.id) &&
          (m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.type.toLowerCase().includes(search.toLowerCase())),
      )
    : materials.filter((m) => !usedMaterialIds.includes(m.id))

  const selectedMaterial = materials.find((m) => m.id === rawMaterialId)

  // Auto-fill unit from the material's default unit when a material is selected
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
    onAdd({
      _key: nextKey(),
      rawMaterialId,
      quantity,
      unit: unit.trim(),
    })
  }

  return (
    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Add Ingredient</p>

      {/* Material search + select */}
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
          size={Math.min(filteredMaterials.length + 1, 5)}
          className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white ${
            errors.rawMaterialId ? 'border-red-400' : 'border-gray-300'
          }`}
        >
          <option value="">Select a material...</option>
          {filteredMaterials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}{' '}
              <span className="text-gray-400">
                ({m.type} · {m.unit})
              </span>
            </option>
          ))}
          {filteredMaterials.length === 0 && (
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
          <p className="text-xs text-red-600 mt-1">{errors.rawMaterialId}</p>
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
            placeholder="0.00"
            min="0"
            step="0.01"
            className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              errors.quantity ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.quantity && (
            <p className="text-xs text-red-600 mt-1">{errors.quantity}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            list="ingredient-unit-suggestions"
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
          <datalist id="ingredient-unit-suggestions">
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {errors.unit && (
            <p className="text-xs text-red-600 mt-1">{errors.unit}</p>
          )}
        </div>
      </div>

      {/* Sub-form actions */}
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
  /** When provided the modal is in edit mode and the form is pre-filled. */
  initial?: Recipe | null
  materials: RawMaterial[]
  onClose: () => void
  onSaved: () => void
}

function RecipeFormModal({
  initial,
  materials,
  onClose,
  onSaved,
}: RecipeFormModalProps) {
  const { success, error: toastError } = useToast()
  const isEdit = Boolean(initial)

  // -------------------------------------------------------------------------
  // Initialise form state — pre-fill when editing
  // -------------------------------------------------------------------------
  const [form, setForm] = useState<RecipeFormData>(() => {
    if (!initial) return EMPTY_FORM

    const ingredients: IngredientRow[] = (initial.ingredients ?? []).map(
      (ing) => ({
        _key: nextKey(),
        rawMaterialId: ing.rawMaterialId ?? ing.intermediateProductId ?? '',
        quantity: String(ing.quantity),
        unit: ing.unit,
      }),
    )

    return {
      name: initial.name,
      description: initial.description ?? '',
      laborMinutes: String(initial.laborMinutes),
      ingredients,
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showIngredientSubForm, setShowIngredientSubForm] = useState(false)

  // -------------------------------------------------------------------------
  // When editing, if the full recipe data (with ingredients) wasn't passed in
  // the list response, fetch the detailed record so we can pre-fill ingredients.
  // -------------------------------------------------------------------------
  const [loadingDetail, setLoadingDetail] = useState(false)
  useEffect(() => {
    if (!initial) return
    // If ingredients data is missing (list response only contains _count), fetch detail
    if (!initial.ingredients || initial.ingredients.length === 0) {
      if ((initial._count?.ingredients ?? 0) === 0) return // truly empty
      setLoadingDetail(true)
      fetch(`/api/admin/recipes/${initial.id}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data?.ingredients) {
            const rows: IngredientRow[] = json.data.ingredients.map(
              (ing: RecipeIngredientDetail) => ({
                _key: nextKey(),
                rawMaterialId:
                  ing.rawMaterialId ?? ing.intermediateProductId ?? '',
                quantity: String(ing.quantity),
                unit: ing.unit,
              }),
            )
            setForm((prev) => ({ ...prev, ingredients: rows }))
          }
        })
        .catch(() => {
          /* non-fatal: form will show empty ingredients */
        })
        .finally(() => setLoadingDetail(false))
    }
  // Run once on mount — we intentionally don't re-run on form changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------------------------
  // Field helpers
  // -------------------------------------------------------------------------

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
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, row],
    }))
    setShowIngredientSubForm(false)
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

  // -------------------------------------------------------------------------
  // Client-side validation
  // -------------------------------------------------------------------------

  const validate = (): boolean => {
    const e: Record<string, string> = {}

    if (!form.name.trim()) e.name = 'Recipe name is required.'
    else if (form.name.trim().length > 100)
      e.name = 'Name must not exceed 100 characters.'

    if (form.description.length > 500)
      e.description = 'Description must not exceed 500 characters.'

    const lm = parseInt(form.laborMinutes, 10)
    if (!form.laborMinutes || isNaN(lm) || lm <= 0)
      e.laborMinutes = 'Labor time must be a positive whole number of minutes.'

    if (form.ingredients.length === 0)
      e.ingredients = 'At least one ingredient is required.'

    // Check for duplicate materials
    const ids = form.ingredients.map((r) => r.rawMaterialId).filter(Boolean)
    const unique = new Set(ids)
    if (unique.size < ids.length)
      e.ingredients = 'Duplicate materials are not allowed in the same recipe.'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

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
        ...(form.description.trim()
          ? { description: form.description.trim() }
          : {}),
        laborMinutes: parseInt(form.laborMinutes, 10),
        ingredients,
      }

      const url = isEdit
        ? `/api/admin/recipes/${initial!.id}`
        : '/api/admin/recipes'
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

  // -------------------------------------------------------------------------
  // Derived display data for ingredient pills
  // -------------------------------------------------------------------------
  const materialMap = new Map(materials.map((m) => [m.id, m]))
  const usedMaterialIds = form.ingredients.map((r) => r.rawMaterialId)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            {isEdit ? `Edit: ${initial!.name}` : 'Create New Recipe'}
          </h2>
          <button
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
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Recipe Name <span className="text-red-500">*</span>
              </label>
              <input
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
                <p className="text-xs text-red-600 mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Description{' '}
                <span className="text-gray-400 font-normal text-xs">
                  (optional)
                </span>
              </label>
              <textarea
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
                <p className="text-xs text-red-600 mt-1">{errors.description}</p>
              )}
            </div>

            {/* Labor Minutes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Labor Time (minutes) <span className="text-red-500">*</span>
              </label>
              <div className="relative max-w-xs">
                <Clock className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
                <input
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
                <p className="text-xs text-red-600 mt-1">{errors.laborMinutes}</p>
              )}
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Ingredients <span className="text-red-500">*</span>
                  {form.ingredients.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      ({form.ingredients.length})
                    </span>
                  )}
                </label>
                {!showIngredientSubForm && (
                  <button
                    type="button"
                    onClick={() => setShowIngredientSubForm(true)}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Ingredient
                  </button>
                )}
              </div>

              {/* Error banner for ingredients */}
              {errors.ingredients && (
                <p className="text-xs text-red-600 mb-2">{errors.ingredients}</p>
              )}

              {/* Ingredient pills */}
              {form.ingredients.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {form.ingredients.map((row) => {
                    const mat = materialMap.get(row.rawMaterialId)
                    const label = mat?.name ?? row.rawMaterialId
                    return (
                      <div
                        key={row._key}
                        className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium px-3 py-1.5 rounded-full"
                      >
                        <Package className="w-3 h-3 text-amber-600 flex-shrink-0" />
                        <span className="font-semibold">{label}</span>
                        <span className="text-amber-600">
                          {row.quantity} {row.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeIngredient(row._key)}
                          className="ml-0.5 text-amber-400 hover:text-red-500 transition-colors"
                          aria-label={`Remove ${label}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                !showIngredientSubForm && (
                  <div className="border-2 border-dashed border-gray-200 rounded-lg py-6 text-center text-gray-400 text-sm mb-3">
                    <Package className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                    No ingredients yet. Add at least one.
                  </div>
                )
              )}

              {/* Ingredient sub-form */}
              {showIngredientSubForm && (
                <IngredientSubForm
                  materials={materials}
                  usedMaterialIds={usedMaterialIds}
                  onAdd={addIngredient}
                  onCancel={() => setShowIngredientSubForm(false)}
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

function DeleteConfirmModal({
  recipe,
  onClose,
  onConfirmed,
}: {
  recipe: Recipe
  onClose: () => void
  onConfirmed: () => void
}) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Recipe</h2>
        <p className="text-gray-600 mb-1">
          Are you sure you want to delete{' '}
          <span className="font-bold text-gray-900">"{recipe.name}"</span>?
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          This action cannot be undone. Deletion will fail if this recipe is
          referenced by active production batches.
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

export default function AdminRecipesPage() {
  const router = useRouter()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Offset-based pagination (matches API: skip / take / hasMore)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [deleteRecipe, setDeleteRecipe] = useState<Recipe | null>(null)

  const { error: toastError } = useToast()

  // ---------------------------------------------------------------------------
  // Fetch raw materials once for the ingredient dropdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    fetch('/api/admin/raw-materials?take=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setMaterials(json.data as RawMaterial[])
        }
      })
      .catch(() => {
        // Non-fatal: ingredient selector will just be empty
      })
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch recipes (stable reset version used on mount + filter changes)
  // ---------------------------------------------------------------------------
  const fetchRecipesReset = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        skip: '0',
        take: String(PAGE_SIZE),
      })

      const res = await fetch(`/api/admin/recipes?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load recipes.',
        })
        return
      }

      setRecipes(json.data as Recipe[])
      setTotal(json.pagination.total)
      setHasMore(json.pagination.hasMore)
      setSkip(PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastError])

  // Load-more variant (appends to existing list)
  const fetchRecipesMore = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        skip: String(skip),
        take: String(PAGE_SIZE),
      })

      const res = await fetch(`/api/admin/recipes?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load recipes.',
        })
        return
      }

      setRecipes((prev) => [...prev, ...(json.data as Recipe[])])
      setTotal(json.pagination.total)
      setHasMore(json.pagination.hasMore)
      setSkip((prev) => prev + PAGE_SIZE)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, toastError])

  // Initial load
  useEffect(() => {
    fetchRecipesReset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Modal callbacks
  // ---------------------------------------------------------------------------

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditRecipe(null)
    fetchRecipesReset()
  }

  const handleDeleted = () => {
    setDeleteRecipe(null)
    fetchRecipesReset()
  }

  // ---------------------------------------------------------------------------
  // Client-side search filter (applied over the fetched page)
  // ---------------------------------------------------------------------------
  const filtered = search.trim()
    ? recipes.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : recipes

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} recipe{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchRecipesReset}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Refresh"
            aria-label="Refresh recipes list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
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
        />
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
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Labor Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ingredients
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && recipes.length === 0 ? (
                // Skeleton rows while loading the first page
                Array.from({ length: 5 }).map((_, i) => (
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
                    <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No recipes found</p>
                    <p className="text-xs mt-1">
                      {search
                        ? 'Try a different search term.'
                        : 'Create your first recipe.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((recipe) => (
                  <tr
                    key={recipe.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {recipe.name}
                      </span>
                    </td>

                    {/* Description (truncated) */}
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
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {recipe.laborMinutes} min
                      </span>
                    </td>

                    {/* Ingredient count */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Package className="w-3 h-3 text-gray-500" />
                        {recipe._count?.ingredients ?? 0}
                        {(recipe._count?.ingredients ?? 0) === 1
                          ? ' ingredient'
                          : ' ingredients'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            router.push(`/admin/recipes/${recipe.id}/workflow`)
                          }
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                          title="Edit workflow"
                          aria-label={`Edit workflow for ${recipe.name}`}
                        >
                          <GitBranch className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditRecipe(recipe)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit recipe"
                          aria-label={`Edit ${recipe.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && !search && (
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={fetchRecipesMore}
              isLoading={isLoading}
              label="Load More Recipes"
            />
          </div>
        )}

        {/* Search note when client filtering is hiding server results */}
        {search && hasMore && (
          <div className="px-4 py-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Showing results from loaded recipes only.{' '}
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
