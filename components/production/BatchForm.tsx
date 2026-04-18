'use client'

import React, { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lab {
  id: string
  name: string
  type: string
  capacity: number
}

interface Recipe {
  id: string
  name: string
  laborMinutes: number
  _count: { ingredients: number; batches: number }
}

interface Machine {
  id: string
  name: string
  type: string
  available: boolean
}

interface Employee {
  id: string
  name: string
  role: string
}

interface LabDetail {
  id: string
  name: string
  machines: Machine[]
  employees: Employee[]
}

interface FormValues {
  labId: string
  recipeId: string
  quantity: string
  plannedStartTime: string
  estimatedCompletionTime: string
  machineId: string
  employeeId: string
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

interface BatchFormProps {
  onSuccess?: (batchNumber: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatApiError(error: ApiError): string {
  switch (error.code) {
    case 'INSUFFICIENT_MATERIALS': {
      const shortages = error.details?.shortages ?? []
      if (shortages.length > 0) {
        const lines = shortages
          .map((s) => `  - Material ${s.materialId}: needs ${s.required}, only ${s.available} available`)
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
          msgs.map((m) => `${field}: ${m}`)
        ),
      ]
      return lines.length > 0 ? lines.join('\n') : error.message
    }
    default:
      return error.message
  }
}

// Minimum datetime string for inputs: 1 minute from now
function getMinDatetime(): string {
  const d = new Date(Date.now() + 60_000)
  // Format as YYYY-MM-DDTHH:MM (datetime-local input format)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BatchForm({ onSuccess }: BatchFormProps) {
  // --- Data state ---
  const [labs, setLabs] = useState<Lab[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [labDetail, setLabDetail] = useState<LabDetail | null>(null)

  // --- Load state ---
  const [loadingLabs, setLoadingLabs] = useState(true)
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [loadingLabDetail, setLoadingLabDetail] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // --- Form state ---
  const [values, setValues] = useState<FormValues>({
    labId: '',
    recipeId: '',
    quantity: '',
    plannedStartTime: '',
    estimatedCompletionTime: '',
    machineId: '',
    employeeId: '',
  })

  // --- Feedback state ---
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
        if (json.success) {
          setLabs(json.data as Lab[])
        }
      })
      .catch(() => {
        if (!cancelled) setLabs([])
      })
      .finally(() => {
        if (!cancelled) setLoadingLabs(false)
      })

    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch recipes whenever any lab is selected
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setLoadingRecipes(true)
    setRecipes([])

    fetch('/api/admin/recipes?take=100')
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) {
          setRecipes(json.data as Recipe[])
        }
      })
      .catch(() => {
        if (!cancelled) setRecipes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipes(false)
      })

    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch lab detail (machines + employees) when lab changes
  // ---------------------------------------------------------------------------
  const fetchLabDetail = useCallback((labId: string) => {
    if (!labId) {
      setLabDetail(null)
      return
    }

    let cancelled = false
    setLoadingLabDetail(true)

    fetch(`/api/admin/labs/${labId}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.success) {
          setLabDetail(json.data as LabDetail)
        }
      })
      .catch(() => {
        if (!cancelled) setLabDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingLabDetail(false)
      })

    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // Handle field changes
  // ---------------------------------------------------------------------------
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear field-level error on change
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
    setApiError(null)
    setSuccessMessage(null)

    if (name === 'labId') {
      // Reset downstream fields when lab changes
      setValues((prev) => ({
        ...prev,
        labId: value,
        recipeId: '',
        machineId: '',
        employeeId: '',
      }))
      fetchLabDetail(value)
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
    if (!values.quantity || isNaN(qty) || qty < 1) {
      errors.quantity = 'Quantity must be a positive whole number.'
    }

    if (!values.plannedStartTime) {
      errors.plannedStartTime = 'Start time is required.'
    } else if (new Date(values.plannedStartTime) <= new Date()) {
      errors.plannedStartTime = 'Start time must be in the future.'
    }

    if (!values.estimatedCompletionTime) {
      errors.estimatedCompletionTime = 'Estimated completion time is required.'
    } else if (
      values.plannedStartTime &&
      new Date(values.estimatedCompletionTime) <= new Date(values.plannedStartTime)
    ) {
      errors.estimatedCompletionTime = 'Completion time must be after start time.'
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
    setSuccessMessage(null)

    if (!validate()) return

    setSubmitting(true)

    const payload: Record<string, unknown> = {
      labId: values.labId,
      recipeId: values.recipeId,
      quantity: parseInt(values.quantity, 10),
      // Convert datetime-local format to ISO string
      plannedStartTime: new Date(values.plannedStartTime).toISOString(),
      estimatedCompletionTime: new Date(values.estimatedCompletionTime).toISOString(),
    }

    if (values.machineId) payload.machineId = values.machineId
    if (values.employeeId) payload.employeeId = values.employeeId

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
      setSuccessMessage(`Batch created successfully! Batch #: ${batchNumber}`)

      // Reset form
      setValues({
        labId: '',
        recipeId: '',
        quantity: '',
        plannedStartTime: '',
        estimatedCompletionTime: '',
        machineId: '',
        employeeId: '',
      })
      setLabDetail(null)
      setFieldErrors({})

      onSuccess?.(batchNumber)
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const availableMachines = labDetail?.machines.filter((m) => m.available) ?? []
  const employees = labDetail?.employees ?? []
  const minDatetime = getMinDatetime()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      aria-label="Create production batch"
    >
      {/* Success message */}
      {successMessage && (
        <div
          role="status"
          className="bg-green-50 border border-green-300 text-green-800 rounded-lg px-4 py-3 text-sm"
        >
          {successMessage}
        </div>
      )}

      {/* API error */}
      {apiError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-4 py-3 text-sm whitespace-pre-wrap"
        >
          <span className="font-semibold block mb-1">Error</span>
          {apiError}
        </div>
      )}

      {/* Row: Lab + Recipe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lab Selection */}
        <div>
          <label
            htmlFor="batch-labId"
            className="block text-sm font-medium text-gray-700 mb-1"
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
              fieldErrors.labId
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300'
            } disabled:bg-gray-100`}
          >
            <option value="">{loadingLabs ? 'Loading labs...' : 'Select a lab'}</option>
            {labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name} ({lab.type})
              </option>
            ))}
          </select>
          {fieldErrors.labId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.labId}</p>
          )}
        </div>

        {/* Recipe Selection */}
        <div>
          <label
            htmlFor="batch-recipeId"
            className="block text-sm font-medium text-gray-700 mb-1"
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
              fieldErrors.recipeId
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300'
            } disabled:bg-gray-100`}
          >
            <option value="">{loadingRecipes ? 'Loading recipes...' : 'Select a recipe'}</option>
            {recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name} ({recipe.laborMinutes} min, {recipe._count.ingredients} ingredients)
              </option>
            ))}
          </select>
          {fieldErrors.recipeId && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.recipeId}</p>
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="max-w-xs">
        <label
          htmlFor="batch-quantity"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Quantity <span className="text-red-500">*</span>
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
            fieldErrors.quantity
              ? 'border-red-400 focus:ring-red-400'
              : 'border-gray-300'
          }`}
        />
        {fieldErrors.quantity && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.quantity}</p>
        )}
      </div>

      {/* Row: Planned Start + Estimated Completion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="batch-plannedStartTime"
            className="block text-sm font-medium text-gray-700 mb-1"
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
            <p className="mt-1 text-xs text-red-600">{fieldErrors.plannedStartTime}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="batch-estimatedCompletionTime"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Estimated Completion <span className="text-red-500">*</span>
          </label>
          <input
            id="batch-estimatedCompletionTime"
            type="datetime-local"
            name="estimatedCompletionTime"
            value={values.estimatedCompletionTime}
            onChange={handleChange}
            min={values.plannedStartTime || minDatetime}
            required
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] ${
              fieldErrors.estimatedCompletionTime
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300'
            }`}
          />
          {fieldErrors.estimatedCompletionTime && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.estimatedCompletionTime}</p>
          )}
        </div>
      </div>

      {/* Row: Machine + Employee (only shown when a lab is selected) */}
      {values.labId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Machine Assignment */}
          <div>
            <label
              htmlFor="batch-machineId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Machine <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="batch-machineId"
              name="machineId"
              value={values.machineId}
              onChange={handleChange}
              disabled={loadingLabDetail}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] disabled:bg-gray-100"
            >
              <option value="">
                {loadingLabDetail ? 'Loading...' : 'No machine assigned'}
              </option>
              {availableMachines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} ({machine.type})
                </option>
              ))}
            </select>
            {!loadingLabDetail && availableMachines.length === 0 && values.labId && (
              <p className="mt-1 text-xs text-gray-500">No available machines in this lab.</p>
            )}
          </div>

          {/* Employee Assignment */}
          <div>
            <label
              htmlFor="batch-employeeId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Employee <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              id="batch-employeeId"
              name="employeeId"
              value={values.employeeId}
              onChange={handleChange}
              disabled={loadingLabDetail}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B4513] disabled:bg-gray-100"
            >
              <option value="">
                {loadingLabDetail ? 'Loading...' : 'No employee assigned'}
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.role}
                </option>
              ))}
            </select>
            {!loadingLabDetail && employees.length === 0 && values.labId && (
              <p className="mt-1 text-xs text-gray-500">No employees assigned to this lab.</p>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting || loadingLabs}
          className="inline-flex items-center gap-2 bg-[#8B4513] hover:bg-[#7a3c10] disabled:bg-gray-400 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B4513]"
        >
          {submitting && (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {submitting ? 'Creating batch...' : 'Create Batch'}
        </button>
      </div>
    </form>
  )
}
