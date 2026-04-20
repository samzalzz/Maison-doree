'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { X, Loader2, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lab {
  id: string
  name: string
  type: string
  capacity: number
}

interface RecipeSummary {
  id: string
  name: string
  laborMinutes: number
  _count: { ingredients: number; batches: number }
}

interface MaterialInfo {
  id: string
  name: string
  type: string
  unit: string
  isIntermediate: boolean
}

interface LabStockEntry {
  materialId: string
  quantity: string | number
  material: MaterialInfo
}

interface RecipeIngredient {
  id: string
  rawMaterialId: string | null
  intermediateProductId: string | null
  quantity: string | number
  unit: string
  rawMaterial: { id: string; name: string; type: string; unit: string } | null
  intermediateProduct: { id: string; name: string; type: string; unit: string } | null
}

interface RecipeDetail {
  id: string
  name: string
  laborMinutes: number
  ingredients: RecipeIngredient[]
}

interface MaterialRequirement {
  materialId: string
  materialName: string
  unit: string
  required: number
  available: number
  sufficient: boolean
}

interface FormValues {
  labId: string
  recipeId: string
  quantity: string
  plannedStartTime: string
}

interface ApiError {
  code: string
  message: string
  details?: {
    shortages?: Array<{ materialId: string; required: number; available: number }>
    activeBatchCount?: number
    maxCapacity?: number
    fieldErrors?: Record<string, string[]>
    formErrors?: string[]
  }
}

export interface BatchFormProps {
  onSuccess?: (batchNumber: string, recipeName: string) => void
  onClose?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMinDatetime(): string {
  const d = new Date(Date.now() + 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toNumber(val: string | number): number {
  if (typeof val === 'number') return val
  return parseFloat(val)
}

function formatApiError(error: ApiError): string {
  switch (error.code) {
    case 'INSUFFICIENT_MATERIALS': {
      const shortages = error.details?.shortages ?? []
      if (shortages.length > 0) {
        const lines = shortages
          .map(
            (s) =>
              `Material ${s.materialId}: needs ${s.required}, only ${s.available} available`,
          )
          .join('\n')
        return `${error.message}\n${lines}`
      }
      return error.message
    }
    case 'NO_CAPACITY': {
      const { activeBatchCount, maxCapacity } = error.details ?? {}
      return `${error.message} (${activeBatchCount ?? '?'}/${maxCapacity ?? '?'} slots used)`
    }
    case 'VALIDATION_ERROR': {
      const fieldErrors = error.details?.fieldErrors ?? {}
      const formErrors = error.details?.formErrors ?? []
      const lines = [
        ...formErrors,
        ...Object.entries(fieldErrors).flatMap(([field, msgs]) =>
          msgs.map((m) => `${field}: ${m}`),
        ),
      ]
      return lines.length > 0 ? lines.join('\n') : error.message
    }
    default:
      return error.message
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BatchForm({ onSuccess, onClose }: BatchFormProps) {
  const { success: toastSuccess, error: toastError } = useToast()

  // --- Data state ---
  const [labs, setLabs] = useState<Lab[]>([])
  const [recipes, setRecipes] = useState<RecipeSummary[]>([])
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetail | null>(null)
  const [labStock, setLabStock] = useState<LabStockEntry[]>([])
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([])

  // --- Load state ---
  const [loadingLabs, setLoadingLabs] = useState(true)
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [loadingRecipeDetail, setLoadingRecipeDetail] = useState(false)
  const [loadingStock, setLoadingStock] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // --- Form state ---
  const [values, setValues] = useState<FormValues>({
    labId: '',
    recipeId: '',
    quantity: '',
    plannedStartTime: '',
  })

  // --- Feedback state ---
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch labs on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setLoadingLabs(true)

    fetch('/api/admin/labs')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setLabs(json.data as Lab[])
      })
      .catch(() => {
        if (!cancelled) setLabs([])
      })
      .finally(() => {
        if (!cancelled) setLoadingLabs(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch recipes on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setLoadingRecipes(true)

    fetch('/api/admin/recipes?take=100')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setRecipes(json.data as RecipeSummary[])
      })
      .catch(() => {
        if (!cancelled) setRecipes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipes(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch lab stock when lab changes
  // ---------------------------------------------------------------------------
  const fetchLabStock = useCallback((labId: string) => {
    if (!labId) {
      setLabStock([])
      return
    }

    let cancelled = false
    setLoadingStock(true)

    fetch(`/api/admin/lab-stock?labId=${labId}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setLabStock(json.data as LabStockEntry[])
        else setLabStock([])
      })
      .catch(() => {
        if (!cancelled) setLabStock([])
      })
      .finally(() => {
        if (!cancelled) setLoadingStock(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch recipe detail (with ingredients) when recipe changes
  // ---------------------------------------------------------------------------
  const fetchRecipeDetail = useCallback((recipeId: string) => {
    if (!recipeId) {
      setRecipeDetail(null)
      return
    }

    let cancelled = false
    setLoadingRecipeDetail(true)

    fetch(`/api/admin/recipes/${recipeId}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) setRecipeDetail(json.data as RecipeDetail)
        else setRecipeDetail(null)
      })
      .catch(() => {
        if (!cancelled) setRecipeDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipeDetail(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Recalculate material requirements whenever recipe, quantity, or stock changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!recipeDetail || !values.quantity) {
      setMaterialRequirements([])
      return
    }

    const qty = parseInt(values.quantity, 10)
    if (isNaN(qty) || qty < 1) {
      setMaterialRequirements([])
      return
    }

    const stockMap = new Map(labStock.map((s) => [s.materialId, toNumber(s.quantity)]))

    const requirements: MaterialRequirement[] = recipeDetail.ingredients.map((ing) => {
      const materialId = (ing.rawMaterialId ?? ing.intermediateProductId) as string
      const material = ing.rawMaterial ?? ing.intermediateProduct
      const materialName = material?.name ?? materialId
      const unit = material?.unit ?? ing.unit
      const required = toNumber(ing.quantity) * qty
      const available = stockMap.get(materialId) ?? 0
      const sufficient = available >= required

      return { materialId, materialName, unit, required, available, sufficient }
    })

    setMaterialRequirements(requirements)
  }, [recipeDetail, values.quantity, labStock])

  // ---------------------------------------------------------------------------
  // Handle field changes
  // ---------------------------------------------------------------------------
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target

    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    setApiError(null)

    if (name === 'labId') {
      setValues((prev) => ({ ...prev, labId: value, recipeId: '' }))
      setRecipeDetail(null)
      setMaterialRequirements([])
      fetchLabStock(value)
    } else if (name === 'recipeId') {
      setValues((prev) => ({ ...prev, recipeId: value }))
      fetchRecipeDetail(value)
    } else {
      setValues((prev) => ({ ...prev, [name]: value }))
    }
  }

  // ---------------------------------------------------------------------------
  // Client-side validation
  // ---------------------------------------------------------------------------
  function validate(): boolean {
    const errors: Partial<Record<keyof FormValues, string>> = {}

    if (!values.labId) errors.labId = 'Please select a lab.'
    if (!values.recipeId) errors.recipeId = 'Please select a recipe.'

    const qty = parseInt(values.quantity, 10)
    if (!values.quantity || isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
      errors.quantity = 'Quantity must be a positive whole number.'
    }

    if (!values.plannedStartTime) {
      errors.plannedStartTime = 'Start time is required.'
    } else if (new Date(values.plannedStartTime) <= new Date()) {
      errors.plannedStartTime = 'Start time must be in the future.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)

    if (!validate()) return

    setSubmitting(true)

    const payload = {
      labId: values.labId,
      recipeId: values.recipeId,
      quantity: parseInt(values.quantity, 10),
      plannedStartTime: new Date(values.plannedStartTime).toISOString(),
    }

    try {
      const res = await fetch('/api/admin/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const err = json.error as ApiError
        setApiError(formatApiError(err))
        return
      }

      const batchNumber = json.data?.batchNumber ?? 'N/A'
      const recipeName =
        recipes.find((r) => r.id === values.recipeId)?.name ?? 'Unknown Recipe'

      toastSuccess({
        title: 'Batch Created',
        message: `${recipeName} batch scheduled (#${batchNumber})`,
      })

      onSuccess?.(batchNumber, recipeName)
    } catch {
      toastError({
        title: 'Network Error',
        message: 'Failed to connect. Please check your connection and try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const hasShortages = materialRequirements.some((r) => !r.sufficient)
  const showMaterials =
    values.recipeId &&
    values.labId &&
    values.quantity &&
    parseInt(values.quantity, 10) >= 1 &&
    (loadingRecipeDetail || loadingStock || materialRequirements.length > 0)
  const canSubmit = !submitting && !loadingLabs && !hasShortages
  const minDatetime = getMinDatetime()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-form-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2
            id="batch-form-modal-title"
            className="text-xl font-bold text-gray-900"
          >
            Create Production Batch
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5" aria-label="Create production batch">
          {/* API error */}
          {apiError && (
            <div
              role="alert"
              className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-wrap">{apiError}</span>
              </div>
            </div>
          )}

          {/* Row: Lab + Recipe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lab Selection */}
            <div>
              <label
                htmlFor="batch-labId"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Lab <span className="text-red-500">*</span>
              </label>
              <select
                id="batch-labId"
                name="labId"
                value={values.labId}
                onChange={handleChange}
                disabled={loadingLabs}
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] ${
                  fieldErrors.labId ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                } disabled:bg-gray-100`}
              >
                <option value="">
                  {loadingLabs ? 'Loading labs...' : 'Select a lab'}
                </option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name} ({lab.type})
                  </option>
                ))}
              </select>
              {fieldErrors.labId && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.labId}
                </p>
              )}
            </div>

            {/* Recipe Selection */}
            <div>
              <label
                htmlFor="batch-recipeId"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Recipe <span className="text-red-500">*</span>
              </label>
              <select
                id="batch-recipeId"
                name="recipeId"
                value={values.recipeId}
                onChange={handleChange}
                disabled={loadingRecipes}
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] ${
                  fieldErrors.recipeId ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                } disabled:bg-gray-100`}
              >
                <option value="">
                  {loadingRecipes ? 'Loading recipes...' : 'Select a recipe'}
                </option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name} ({recipe._count.ingredients} ingredients)
                  </option>
                ))}
              </select>
              {fieldErrors.recipeId && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.recipeId}
                </p>
              )}
            </div>
          </div>

          {/* Row: Quantity + Planned Start Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label
                htmlFor="batch-quantity"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Quantity (units) <span className="text-red-500">*</span>
              </label>
              <input
                id="batch-quantity"
                type="number"
                name="quantity"
                value={values.quantity}
                onChange={handleChange}
                min={1}
                step={1}
                placeholder="e.g. 50"
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] ${
                  fieldErrors.quantity ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.quantity && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.quantity}
                </p>
              )}
            </div>

            {/* Planned Start Time */}
            <div>
              <label
                htmlFor="batch-plannedStartTime"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Planned Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="batch-plannedStartTime"
                type="datetime-local"
                name="plannedStartTime"
                value={values.plannedStartTime}
                onChange={handleChange}
                min={minDatetime}
                required
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] ${
                  fieldErrors.plannedStartTime
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-gray-300'
                }`}
              />
              {fieldErrors.plannedStartTime && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {fieldErrors.plannedStartTime}
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Material Requirements */}
          {showMaterials && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Material Requirements
              </h3>

              {loadingRecipeDetail || loadingStock ? (
                <div className="space-y-2 animate-pulse">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 rounded" />
                  ))}
                </div>
              ) : materialRequirements.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No ingredients found for this recipe.
                </p>
              ) : (
                <>
                  {/* Shortage alert */}
                  {hasShortages && (
                    <div
                      role="alert"
                      className="mb-3 bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                        <div>
                          <p className="font-semibold">Insufficient Materials</p>
                          <p className="text-xs mt-0.5">
                            The following materials are short in the selected lab.
                            Transfer stock before scheduling this batch.
                          </p>
                          <ul className="mt-1 space-y-0.5 text-xs list-disc list-inside">
                            {materialRequirements
                              .filter((r) => !r.sufficient)
                              .map((r) => (
                                <li key={r.materialId}>
                                  <span className="font-medium">{r.materialName}</span>:{' '}
                                  need {r.required} {r.unit}, have {r.available} {r.unit}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Requirements table */}
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm" aria-label="Material requirements">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            scope="col"
                            className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                          >
                            Material
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide"
                          >
                            Required
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide"
                          >
                            Available
                          </th>
                          <th
                            scope="col"
                            className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide"
                          >
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {materialRequirements.map((req) => (
                          <tr
                            key={req.materialId}
                            className={req.sufficient ? '' : 'bg-red-50'}
                          >
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {req.materialName}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {req.required} {req.unit}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-semibold ${
                                req.sufficient ? 'text-green-700' : 'text-red-700'
                              }`}
                            >
                              {req.available} {req.unit}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {req.sufficient ? (
                                <span className="inline-flex items-center gap-1 text-green-700">
                                  <CheckCircle className="w-4 h-4" aria-hidden="true" />
                                  <span className="sr-only">Sufficient</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                                  <span className="sr-only">Insufficient</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              title={
                hasShortages
                  ? 'Cannot submit: insufficient materials in the selected lab'
                  : undefined
              }
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#8B4513] hover:bg-[#7a3c10] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B4513]"
            >
              {submitting && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              {submitting ? 'Creating Batch...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
