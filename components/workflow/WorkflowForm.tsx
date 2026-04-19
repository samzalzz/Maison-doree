'use client'

import React from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowTriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED'

export interface WorkflowFormData {
  name: string
  description: string
  isActive: boolean
  triggerType: WorkflowTriggerType
}

export interface WorkflowFormErrors {
  name?: string
  description?: string
  triggerType?: string
  form?: string
}

interface WorkflowFormProps {
  initialData?: Partial<WorkflowFormData>
  onSubmit: (data: WorkflowFormData) => Promise<void>
  loading: boolean
  error?: string | null
  onCancel?: () => void
  submitLabel?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_TYPE_OPTIONS: { value: WorkflowTriggerType; label: string; description: string }[] = [
  { value: 'MANUAL', label: 'Manual', description: 'Triggered by admin action' },
  { value: 'SCHEDULED', label: 'Scheduled', description: 'Runs on a cron schedule' },
  { value: 'EVENT_BASED', label: 'Event Based', description: 'Triggered by system events' },
]

const DEFAULT_FORM: WorkflowFormData = {
  name: '',
  description: '',
  isActive: true,
  triggerType: 'MANUAL',
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateForm(data: WorkflowFormData): WorkflowFormErrors {
  const errors: WorkflowFormErrors = {}

  if (!data.name.trim()) {
    errors.name = 'Workflow name is required.'
  } else if (data.name.trim().length > 200) {
    errors.name = 'Workflow name must not exceed 200 characters.'
  }

  if (data.description && data.description.length > 500) {
    errors.description = 'Description must not exceed 500 characters.'
  }

  if (!['MANUAL', 'SCHEDULED', 'EVENT_BASED'].includes(data.triggerType)) {
    errors.triggerType = 'Please select a valid trigger type.'
  }

  return errors
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowForm({
  initialData,
  onSubmit,
  loading,
  error,
  onCancel,
  submitLabel = 'Save Workflow',
}: WorkflowFormProps) {
  const [formData, setFormData] = React.useState<WorkflowFormData>({
    ...DEFAULT_FORM,
    ...initialData,
  })
  const [errors, setErrors] = React.useState<WorkflowFormErrors>({})
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})

  // Sync when initialData changes (edit mode loads data after mount)
  React.useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({ ...prev, ...initialData }))
    }
  }, [initialData?.name, initialData?.description, initialData?.isActive, initialData?.triggerType]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange<K extends keyof WorkflowFormData>(key: K, value: WorkflowFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
    // Clear field error on change
    if (errors[key as keyof WorkflowFormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validateForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setTouched({ name: true, description: true, triggerType: true })
      return
    }
    setErrors({})
    await onSubmit(formData)
  }

  const showError = (field: keyof WorkflowFormErrors) =>
    touched[field] && errors[field] ? errors[field] : null

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" data-testid="workflow-form">
      {/* API / form-level error */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          data-testid="form-error"
        >
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="wf-name" className="block text-sm font-semibold text-gray-700 mb-1">
          Workflow Name <span className="text-red-500">*</span>
        </label>
        <input
          id="wf-name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, name: true }))}
          maxLength={200}
          placeholder="e.g. Low Stock Restock Alert"
          aria-required="true"
          aria-describedby={showError('name') ? 'wf-name-error' : undefined}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            showError('name') ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
          }`}
          data-testid="workflow-name-input"
        />
        {showError('name') && (
          <p id="wf-name-error" role="alert" className="mt-1 text-xs text-red-600" data-testid="name-error">
            {showError('name')}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">{formData.name.length}/200</p>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="wf-description" className="block text-sm font-semibold text-gray-700 mb-1">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="wf-description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          onBlur={() => setTouched((p) => ({ ...p, description: true }))}
          rows={3}
          maxLength={500}
          placeholder="Describe what this workflow does…"
          aria-describedby={showError('description') ? 'wf-desc-error' : undefined}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 shadow-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            showError('description') ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
          }`}
          data-testid="workflow-description-input"
        />
        {showError('description') && (
          <p id="wf-desc-error" role="alert" className="mt-1 text-xs text-red-600">
            {showError('description')}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">{formData.description.length}/500</p>
      </div>

      {/* Trigger Type */}
      <div>
        <label htmlFor="wf-trigger" className="block text-sm font-semibold text-gray-700 mb-1">
          Trigger Type <span className="text-red-500">*</span>
        </label>
        <select
          id="wf-trigger"
          value={formData.triggerType}
          onChange={(e) => handleChange('triggerType', e.target.value as WorkflowTriggerType)}
          aria-required="true"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="workflow-trigger-select"
        >
          {TRIGGER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} — {opt.description}
            </option>
          ))}
        </select>
      </div>

      {/* Is Active Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 bg-gray-50">
        <div>
          <p className="text-sm font-semibold text-gray-700">Active</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Inactive workflows can be saved but will not execute automatically.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={formData.isActive}
          onClick={() => handleChange('isActive', !formData.isActive)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            formData.isActive ? 'bg-blue-600' : 'bg-gray-300'
          }`}
          data-testid="workflow-active-toggle"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              formData.isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          data-testid="workflow-submit-btn"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
            data-testid="workflow-cancel-btn"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
