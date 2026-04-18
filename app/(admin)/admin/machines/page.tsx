'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Cpu,
  Trash2,
  Edit2,
  X,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabSummary {
  id: string
  name: string
}

interface Machine {
  id: string
  name: string
  type: string
  labId: string
  lab: LabSummary
  batchCapacity: number
  cycleTimeMinutes: number
  available: boolean
  createdAt: string
  updatedAt: string
}

// Form data for CREATE — all five mutable fields plus the immutable specs
interface MachineCreateFormData {
  name: string
  type: string
  labId: string
  batchCapacity: string
  cycleTimeMinutes: string
  available: boolean
}

// Form data for EDIT — only name and available are accepted by the API
interface MachineEditFormData {
  name: string
  available: boolean
}

const MACHINE_TYPE_SUGGESTIONS = [
  'Oven',
  'Mixer',
  'Proofer',
  'Sheeter',
  'Depositor',
  'Fryer',
  'Cooler',
  'Wrapper',
  'Slicer',
  'Other',
]

const EMPTY_CREATE_FORM: MachineCreateFormData = {
  name: '',
  type: '',
  labId: '',
  batchCapacity: '',
  cycleTimeMinutes: '',
  available: true,
}

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// Availability badge
// ---------------------------------------------------------------------------

function AvailableBadge({ available }: { available: boolean }) {
  if (available) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
        <CheckCircle className="w-3 h-3" />
        Available
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
      <XCircle className="w-3 h-3" />
      Unavailable
    </span>
  )
}

// ---------------------------------------------------------------------------
// Create Machine Modal
// ---------------------------------------------------------------------------

interface CreateMachineModalProps {
  labs: LabSummary[]
  onClose: () => void
  onSaved: () => void
}

function CreateMachineModal({ labs, onClose, onSaved }: CreateMachineModalProps) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState<MachineCreateFormData>(EMPTY_CREATE_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [typeInputFocused, setTypeInputFocused] = useState(false)

  function setField<K extends keyof MachineCreateFormData>(
    key: K,
    value: MachineCreateFormData[K],
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
      e.name = 'Machine name is required.'
    } else if (form.name.trim().length > 100) {
      e.name = 'Machine name must not exceed 100 characters.'
    }

    if (!form.type.trim()) {
      e.type = 'Machine type is required.'
    } else if (form.type.trim().length > 50) {
      e.type = 'Machine type must not exceed 50 characters.'
    }

    if (!form.labId) {
      e.labId = 'Please select a lab.'
    }

    const batchCap = parseInt(form.batchCapacity, 10)
    if (!form.batchCapacity || isNaN(batchCap) || batchCap <= 0 || !Number.isInteger(batchCap)) {
      e.batchCapacity = 'Batch capacity must be a positive whole number.'
    }

    const cycleTime = parseInt(form.cycleTimeMinutes, 10)
    if (!form.cycleTimeMinutes || isNaN(cycleTime) || cycleTime <= 0 || !Number.isInteger(cycleTime)) {
      e.cycleTimeMinutes = 'Cycle time must be a positive whole number of minutes.'
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
        type: form.type.trim(),
        labId: form.labId,
        batchCapacity: parseInt(form.batchCapacity, 10),
        cycleTimeMinutes: parseInt(form.cycleTimeMinutes, 10),
        available: form.available,
      }

      const res = await fetch('/api/admin/machines', {
        method: 'POST',
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
          title: 'Create Failed',
          message: json.error?.message ?? 'An error occurred.',
        })
        return
      }

      success({
        title: 'Machine Created',
        message: `"${form.name.trim()}" has been created successfully.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const filteredSuggestions = MACHINE_TYPE_SUGGESTIONS.filter(
    (s) =>
      form.type.length > 0 &&
      s.toLowerCase().includes(form.type.toLowerCase()) &&
      s.toLowerCase() !== form.type.toLowerCase(),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-machine-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="create-machine-title" className="text-xl font-bold text-gray-900">
            Create New Machine
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
            <label htmlFor="machine-name" className="block text-sm font-semibold text-gray-700 mb-1">
              Machine Name <span className="text-red-500">*</span>
            </label>
            <input
              id="machine-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Industrial Deck Oven #2"
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

          {/* Type with autocomplete suggestions */}
          <div className="relative">
            <label htmlFor="machine-type" className="block text-sm font-semibold text-gray-700 mb-1">
              Machine Type <span className="text-red-500">*</span>
            </label>
            <input
              id="machine-type"
              type="text"
              value={form.type}
              onChange={(e) => setField('type', e.target.value)}
              onFocus={() => setTypeInputFocused(true)}
              onBlur={() => setTimeout(() => setTypeInputFocused(false), 150)}
              placeholder="e.g. Oven, Mixer, Proofer"
              maxLength={50}
              autoComplete="off"
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.type ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.type && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.type}
              </p>
            )}
            {/* Suggestions dropdown */}
            {typeInputFocused && filteredSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto text-sm">
                {filteredSuggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={() => setField('type', s)}
                      className="w-full text-left px-4 py-2 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* Show all suggestions as pills when field is empty and focused */}
            {typeInputFocused && form.type.length === 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MACHINE_TYPE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => setField('type', s)}
                    className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-amber-100 hover:text-amber-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lab */}
          <div>
            <label htmlFor="machine-lab" className="block text-sm font-semibold text-gray-700 mb-1">
              Production Lab <span className="text-red-500">*</span>
            </label>
            {labs.length === 0 ? (
              <div className="px-4 py-2 border border-amber-200 rounded-lg bg-amber-50 text-sm text-amber-700">
                No labs available. Create a lab first.
              </div>
            ) : (
              <select
                id="machine-lab"
                value={form.labId}
                onChange={(e) => setField('labId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.labId ? 'border-red-400' : 'border-gray-300'
                }`}
              >
                <option value="">Select a lab...</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            )}
            {errors.labId && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.labId}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Lab cannot be changed after creation.
            </p>
          </div>

          {/* Batch Capacity + Cycle Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="machine-batch" className="block text-sm font-semibold text-gray-700 mb-1">
                Batch Capacity <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="machine-batch"
                  type="number"
                  value={form.batchCapacity}
                  onChange={(e) => setField('batchCapacity', e.target.value)}
                  placeholder="e.g. 50"
                  min="1"
                  step="1"
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors.batchCapacity ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.batchCapacity ? (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.batchCapacity}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Units per batch</p>
              )}
            </div>

            <div>
              <label htmlFor="machine-cycle" className="block text-sm font-semibold text-gray-700 mb-1">
                Cycle Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="machine-cycle"
                  type="number"
                  value={form.cycleTimeMinutes}
                  onChange={(e) => setField('cycleTimeMinutes', e.target.value)}
                  placeholder="e.g. 30"
                  min="1"
                  step="1"
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 pr-14 ${
                    errors.cycleTimeMinutes ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                <span className="absolute right-3 inset-y-0 flex items-center text-gray-400 text-xs pointer-events-none">
                  min
                </span>
              </div>
              {errors.cycleTimeMinutes ? (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.cycleTimeMinutes}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Minutes per cycle</p>
              )}
            </div>
          </div>

          {/* Available toggle */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="machine-available"
              checked={form.available}
              onChange={(e) => setField('available', e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <label htmlFor="machine-available" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Available for production use
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
              disabled={isSaving || labs.length === 0}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Machine'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit Machine Modal
// NOTE: The API UpdateMachineSchema only permits name + available.
//       Hardware specs (type, batchCapacity, cycleTimeMinutes) and labId are
//       intentionally immutable after creation to preserve batch history.
// ---------------------------------------------------------------------------

interface EditMachineModalProps {
  machine: Machine
  onClose: () => void
  onSaved: () => void
}

function EditMachineModal({ machine, onClose, onSaved }: EditMachineModalProps) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState<MachineEditFormData>({
    name: machine.name,
    available: machine.available,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function setField<K extends keyof MachineEditFormData>(
    key: K,
    value: MachineEditFormData[K],
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
      e.name = 'Machine name is required.'
    } else if (form.name.trim().length > 100) {
      e.name = 'Machine name must not exceed 100 characters.'
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
        available: form.available,
      }

      const res = await fetch(`/api/admin/machines/${machine.id}`, {
        method: 'PATCH',
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
          title: 'Update Failed',
          message: json.error?.message ?? 'An error occurred.',
        })
        return
      }

      success({
        title: 'Machine Updated',
        message: `"${form.name.trim()}" has been updated.`,
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
      aria-labelledby="edit-machine-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="edit-machine-title" className="text-xl font-bold text-gray-900">
            Edit Machine
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
            <label htmlFor="edit-machine-name" className="block text-sm font-semibold text-gray-700 mb-1">
              Machine Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-machine-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
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

          {/* Read-only hardware specs */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Hardware Specs (immutable)
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="font-medium text-gray-700">{machine.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Batch Cap.</p>
                <p className="font-medium text-gray-700">{machine.batchCapacity} units</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cycle Time</p>
                <p className="font-medium text-gray-700">{machine.cycleTimeMinutes} min</p>
              </div>
            </div>
            <div className="pt-1">
              <p className="text-xs text-gray-500">Lab</p>
              <p className="font-medium text-gray-700">{machine.lab.name}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              These values cannot be changed after creation to preserve batch history.
            </p>
          </div>

          {/* Available toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="edit-machine-available"
              checked={form.available}
              onChange={(e) => setField('available', e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <label htmlFor="edit-machine-available" className="text-sm font-semibold text-gray-700 cursor-pointer">
              Available for production use
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
              ) : (
                'Save Changes'
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
  machine: Machine
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({ machine, onClose, onConfirmed }: DeleteConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/machines/${machine.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to delete machine.',
        })
        return
      }

      success({
        title: 'Machine Deleted',
        message: `"${machine.name}" has been permanently deleted.`,
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
      aria-labelledby="delete-machine-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 id="delete-machine-title" className="text-lg font-bold text-gray-900">
              Delete Machine
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-gray-900">"{machine.name}"</span>?
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 text-sm text-gray-600 space-y-1">
          <p>
            <span className="font-medium">Type:</span> {machine.type}
          </p>
          <p>
            <span className="font-medium">Lab:</span> {machine.lab.name}
          </p>
          <p>
            <span className="font-medium">Batch capacity:</span>{' '}
            {machine.batchCapacity} units
          </p>
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
              'Delete Machine'
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

export default function AdminMachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [labs, setLabs] = useState<LabSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [labsLoading, setLabsLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [total, setTotal] = useState(0)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editMachine, setEditMachine] = useState<Machine | null>(null)
  const [deleteMachine, setDeleteMachine] = useState<Machine | null>(null)

  const { error: toastError } = useToast()

  // ------------------------------------------------------------------
  // Fetch labs for dropdown (load once on mount — kept small with take=100)
  // ------------------------------------------------------------------
  const fetchLabs = useCallback(async () => {
    setLabsLoading(true)
    try {
      const res = await fetch('/api/admin/labs?take=100')
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Could Not Load Labs',
          message: json.error?.message ?? 'Failed to load labs for dropdown.',
        })
        return
      }

      // The labs endpoint returns the full shape; we only need id + name
      const summaries: LabSummary[] = (json.data ?? []).map(
        (l: { id: string; name: string }) => ({ id: l.id, name: l.name }),
      )
      setLabs(summaries)
    } finally {
      setLabsLoading(false)
    }
  }, [toastError])

  // ------------------------------------------------------------------
  // Fetch machines with cursor pagination
  // ------------------------------------------------------------------
  const fetchMachines = useCallback(
    async (reset = false) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ take: String(PAGE_SIZE) })
        if (!reset && nextCursor) params.set('cursor', nextCursor)

        const res = await fetch(`/api/admin/machines?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Load Failed',
            message: json.error?.message ?? 'Failed to load machines.',
          })
          return
        }

        setMachines((prev) => (reset ? json.data : [...prev, ...json.data]))
        setNextCursor(json.pagination.nextCursor)
        setHasNextPage(json.pagination.hasNextPage)
        setTotal(json.pagination.total)
      } finally {
        setIsLoading(false)
      }
    },
    // nextCursor intentionally excluded so callers can always pass reset=true
    // to start over without stale cursor interference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toastError],
  )

  // Load everything on mount
  useEffect(() => {
    fetchLabs()
    fetchMachines(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditMachine(null)
    setNextCursor(null)
    fetchMachines(true)
  }

  const handleDeleted = () => {
    setDeleteMachine(null)
    setNextCursor(null)
    fetchMachines(true)
  }

  const handleLoadMore = () => {
    fetchMachines(false)
  }

  // Summary counts
  const availableCount = machines.filter((m) => m.available).length

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} machine{total !== 1 ? 's' : ''} total
            {machines.length > 0 && (
              <span className="ml-2 text-gray-400">
                &mdash;{' '}
                <span className="text-green-600 font-medium">{availableCount} available</span>
                {', '}
                <span className="text-gray-500">{machines.length - availableCount} unavailable</span>
                {machines.length < total && ' (partial list)'}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setNextCursor(null)
              fetchMachines(true)
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh machines list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={labsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Machine
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Machines">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Machine Name
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
                  Lab
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Batch Capacity
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Cycle Time
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Status
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
              {isLoading && machines.length === 0 ? (
                // Skeleton rows during initial load
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : machines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                    <Cpu className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No machines found</p>
                    <p className="text-xs mt-1">
                      Add your first machine to start tracking production capacity.
                    </p>
                  </td>
                </tr>
              ) : (
                machines.map((machine) => (
                  <tr
                    key={machine.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">
                        {machine.name}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full">
                        {machine.type}
                      </span>
                    </td>

                    {/* Lab */}
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {machine.lab.name}
                    </td>

                    {/* Batch Capacity */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Layers className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{machine.batchCapacity}</span>
                        <span className="text-xs text-gray-500">units</span>
                      </div>
                    </td>

                    {/* Cycle Time */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{machine.cycleTimeMinutes}</span>
                        <span className="text-xs text-gray-500">min</span>
                      </div>
                    </td>

                    {/* Available badge */}
                    <td className="px-4 py-3">
                      <AvailableBadge available={machine.available} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditMachine(machine)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit machine"
                          aria-label={`Edit ${machine.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteMachine(machine)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete machine"
                          aria-label={`Delete ${machine.name}`}
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
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={handleLoadMore}
              isLoading={isLoading}
              label={`Load More Machines`}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateMachineModal
          labs={labs}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editMachine && (
        <EditMachineModal
          machine={editMachine}
          onClose={() => setEditMachine(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteMachine && (
        <DeleteConfirmModal
          machine={deleteMachine}
          onClose={() => setDeleteMachine(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  )
}
