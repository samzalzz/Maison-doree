'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { useToast } from '@/lib/hooks/useToast'
import WorkflowForm, { type WorkflowFormData } from '@/components/workflow/WorkflowForm'
import WorkflowCanvas, { createStep } from '@/components/workflow/WorkflowCanvas'
import StepPalette, { type StepNodeType } from '@/components/workflow/StepPalette'
import StepConfigPanel, { type CanvasStep } from '@/components/workflow/StepConfigPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowStep {
  id: string
  workflowId: string
  stepNumber: number
  type: 'ACTION' | 'CONDITION'
  actionType?: string | null
  actionPayload?: Record<string, unknown> | null
  conditions?: Array<{
    id: string
    field: string
    operator: string
    value: string
  }>
  createdAt: string
  updatedAt: string
}

interface WorkflowDetail {
  id: string
  name: string
  description: string | null
  enabled: boolean
  triggerType: 'MANUAL' | 'SCHEDULED' | 'EVENT_BASED'
  createdBy: string
  executionCount: number
  createdAt: string
  updatedAt: string
  steps?: WorkflowStep[]
}

interface ApiDetailResponse {
  success: boolean
  data?: WorkflowDetail
  error?: { code: string; message: string; errors?: Record<string, string[]> }
}

interface WorkflowEditorPageProps {
  params: { id: string }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isCreateMode = (id: string) => id === 'create'

function stepsToCanvasSteps(steps: WorkflowStep[]): CanvasStep[] {
  return [...steps]
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((s, idx) => ({
      id: s.id,
      type: s.type as 'ACTION' | 'CONDITION',
      order: idx + 1,
      label: s.type === 'ACTION'
        ? `Action Step ${idx + 1}`
        : `Condition Step ${idx + 1}`,
      actionType: (s.actionType ?? 'TRANSFER') as CanvasStep['actionType'],
      actionPayload: s.actionPayload ?? {},
      conditions: (s.conditions ?? []).map((c) => ({
        id: c.id,
        field: c.field,
        operator: c.operator as 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS',
        value: c.value,
      })),
    }))
}

function canvasStepsToPayload(steps: CanvasStep[]) {
  return steps.map((s) => ({
    type: s.type,
    stepNumber: s.order,
    actionType: s.type === 'ACTION' ? s.actionType : undefined,
    actionPayload: s.type === 'ACTION' ? s.actionPayload : undefined,
    conditions:
      s.type === 'CONDITION'
        ? (s.conditions ?? []).map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          }))
        : undefined,
  }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowEditorPage({ params }: WorkflowEditorPageProps) {
  const { id } = params
  const createMode = isCreateMode(id)
  const router = useRouter()
  const toast = useToast()

  // Form state
  const [formData, setFormData] = useState<WorkflowFormData>({
    name: '',
    description: '',
    isActive: true,
    triggerType: 'MANUAL',
  })
  const [formError, setFormError] = useState<string | null>(null)

  // Canvas state
  const [canvasSteps, setCanvasSteps] = useState<CanvasStep[]>([])
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  // Loading states
  const [loadingDetail, setLoadingDetail] = useState(!createMode)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Selected step (derived)
  const selectedStep = canvasSteps.find((s) => s.id === selectedStepId) ?? null

  // ---------------------------------------------------------------------------
  // Fetch existing workflow (edit mode)
  // ---------------------------------------------------------------------------

  const fetchWorkflow = useCallback(async () => {
    if (createMode) return
    setLoadingDetail(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/workflows/${id}`)
      const json: ApiDetailResponse = await res.json()
      if (!json.success || !json.data) {
        setFetchError(json.error?.message ?? 'Workflow not found.')
        return
      }
      const wf = json.data
      setFormData({
        name: wf.name,
        description: wf.description ?? '',
        isActive: wf.enabled,
        triggerType: wf.triggerType,
      })
      if (wf.steps && wf.steps.length > 0) {
        setCanvasSteps(stepsToCanvasSteps(wf.steps))
      }
    } catch {
      setFetchError('Network error. Please try again.')
    } finally {
      setLoadingDetail(false)
    }
  }, [id, createMode])

  useEffect(() => {
    void fetchWorkflow()
  }, [fetchWorkflow])

  // ---------------------------------------------------------------------------
  // Add step from palette
  // ---------------------------------------------------------------------------

  function handleAddStep(type: StepNodeType) {
    const newStep = createStep(type, canvasSteps.length + 1)
    setCanvasSteps((prev) => [...prev, newStep])
    setSelectedStepId(newStep.id)
  }

  // ---------------------------------------------------------------------------
  // Update selected step config
  // ---------------------------------------------------------------------------

  function handleStepChange(updated: CanvasStep) {
    setCanvasSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  // ---------------------------------------------------------------------------
  // Delete step via config panel
  // ---------------------------------------------------------------------------

  function handleStepDelete(stepId: string) {
    const filtered = canvasSteps.filter((s) => s.id !== stepId)
    const renumbered = filtered.map((s, i) => ({
      ...s,
      order: i + 1,
      label: `${s.type === 'ACTION' ? 'Action' : 'Condition'} Step ${i + 1}`,
    }))
    setCanvasSteps(renumbered)
    if (selectedStepId === stepId) setSelectedStepId(null)
  }

  // ---------------------------------------------------------------------------
  // Save workflow
  // ---------------------------------------------------------------------------

  async function handleFormSubmit(data: WorkflowFormData) {
    setSaving(true)
    setFormError(null)

    const body = {
      name: data.name.trim(),
      description: data.description.trim() || undefined,
      isActive: data.isActive,
      triggerType: data.triggerType,
      steps: canvasStepsToPayload(canvasSteps),
    }

    try {
      const url = createMode
        ? '/api/admin/workflows'
        : `/api/admin/workflows/${id}`
      const method = createMode ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json: ApiDetailResponse = await res.json()

      if (!json.success) {
        const msg = json.error?.message ?? 'Failed to save workflow.'
        setFormError(msg)
        toast.error({ title: 'Save failed', message: msg })
        return
      }

      toast.success({
        title: 'Workflow saved',
        message: createMode ? 'New workflow created successfully.' : 'Workflow updated successfully.',
      })
      router.push('/admin/workflows')
    } catch {
      const msg = 'Network error. Please try again.'
      setFormError(msg)
      toast.error({ title: 'Network error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render: loading state
  // ---------------------------------------------------------------------------

  if (loadingDetail) {
    return (
      <div className="flex items-center justify-center min-h-64" data-testid="loading-detail">
        <div className="text-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Loading workflow…</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-4" data-testid="fetch-error">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6">
          <p className="text-sm font-semibold text-red-700">{fetchError}</p>
        </div>
        <Link
          href="/admin/workflows"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workflows
        </Link>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6" data-testid="workflow-editor-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/workflows"
          className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          aria-label="Back to workflows"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {createMode ? 'Create Workflow' : 'Edit Workflow'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {createMode
              ? 'Define a new automated workflow with steps and conditions.'
              : `Editing workflow — use the canvas to manage steps.`}
          </p>
        </div>
      </div>

      {/* Two-column layout: form left, canvas right */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left — Form */}
        <div className="flex-shrink-0 lg:w-80 xl:w-96">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-4">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Workflow Details</h2>
            <WorkflowForm
              initialData={formData}
              onSubmit={handleFormSubmit}
              loading={saving}
              error={formError}
              onCancel={() => router.push('/admin/workflows')}
              submitLabel={createMode ? 'Create Workflow' : 'Save Changes'}
            />
          </div>
        </div>

        {/* Right — Canvas */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Workflow Canvas</h2>
              <span className="text-xs text-gray-400">
                {canvasSteps.length} step{canvasSteps.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Step Palette */}
            <StepPalette onAddStep={handleAddStep} disabled={saving} />

            {/* Canvas area */}
            <div className="mt-4">
              <WorkflowCanvas
                steps={canvasSteps}
                onStepsChange={setCanvasSteps}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
                onDropNewStep={handleAddStep}
              />
            </div>

            {/* Step count indicator */}
            {canvasSteps.length === 0 && (
              <p className="mt-2 text-xs text-center text-amber-600">
                No steps defined. Add at least one step to build your workflow.
              </p>
            )}
          </div>

          {/* Step Configuration Panel */}
          {selectedStep && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5" data-testid="step-config-section">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Configure Step</h2>
              <StepConfigPanel
                step={selectedStep}
                onChange={handleStepChange}
                onDelete={handleStepDelete}
              />
            </div>
          )}

          {!selectedStep && canvasSteps.length > 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
              Click a step on the canvas to configure it.
            </div>
          )}

          {/* Save bar (sticky on mobile) */}
          <div className="lg:hidden bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <button
              type="button"
              onClick={() => {
                void handleFormSubmit(formData)
              }}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving…' : createMode ? 'Create Workflow' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
