'use client'

import React, { useCallback, useRef, useState } from 'react'
import type { CanvasStep, StepType } from './StepConfigPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowCanvasProps {
  steps: CanvasStep[]
  onStepsChange: (steps: CanvasStep[]) => void
  selectedStepId: string | null
  onSelectStep: (id: string | null) => void
  onDropNewStep?: (type: StepType) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_COLORS: Record<StepType, { border: string; bg: string; badge: string; text: string }> = {
  ACTION: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    badge: 'bg-blue-600 text-white',
    text: 'text-blue-800',
  },
  CONDITION: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: 'bg-yellow-500 text-white',
    text: 'text-yellow-800',
  },
}

function generateId() {
  return `step_${Math.random().toString(36).slice(2, 9)}`
}

function generateLabel(type: StepType, order: number): string {
  return type === 'ACTION' ? `Action Step ${order}` : `Condition Step ${order}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorkflowCanvas({
  steps,
  onStepsChange,
  selectedStepId,
  onSelectStep,
  onDropNewStep,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  // Handle drop of new step from palette
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOverIdx(null)
    const stepType = e.dataTransfer.getData('stepType') as StepType | ''
    if (stepType === 'ACTION' || stepType === 'CONDITION') {
      onDropNewStep?.(stepType)
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // Reorder by dragging existing steps
  const handleStepDragStart = useCallback((idx: number) => {
    setDraggingIdx(idx)
  }, [])

  const handleStepDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverIdx(idx)
  }, [])

  const handleStepDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOverIdx(null)
      if (draggingIdx === null || draggingIdx === targetIdx) {
        setDraggingIdx(null)
        return
      }
      const reordered = [...steps]
      const [removed] = reordered.splice(draggingIdx, 1)
      reordered.splice(targetIdx, 0, removed)
      // Reassign orders
      const renumbered = reordered.map((s, i) => ({
        ...s,
        order: i + 1,
        label: generateLabel(s.type, i + 1),
      }))
      setDraggingIdx(null)
      onStepsChange(renumbered)
    },
    [draggingIdx, steps, onStepsChange],
  )

  function handleDeleteStep(id: string) {
    const filtered = steps.filter((s) => s.id !== id)
    const renumbered = filtered.map((s, i) => ({
      ...s,
      order: i + 1,
      label: generateLabel(s.type, i + 1),
    }))
    onStepsChange(renumbered)
    if (selectedStepId === id) {
      onSelectStep(null)
    }
  }

  const isEmpty = steps.length === 0

  return (
    <div
      ref={canvasRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="relative min-h-64 bg-white border-2 border-dashed border-gray-300 rounded-xl overflow-hidden"
      data-testid="workflow-canvas"
    >
      {isEmpty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p className="text-sm font-semibold text-gray-400">Canvas is empty</p>
          <p className="text-xs text-gray-300 mt-1">
            Drag steps from the palette above, or click a step button to add.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-0" data-testid="canvas-steps-list">
          {steps.map((step, idx) => {
            const colors = STEP_COLORS[step.type]
            const isSelected = selectedStepId === step.id
            const isDraggingThis = draggingIdx === idx
            const isDragTarget = dragOverIdx === idx && draggingIdx !== null && draggingIdx !== idx

            return (
              <div key={step.id} className="relative">
                {/* Drop indicator line */}
                {isDragTarget && (
                  <div className="h-1 bg-blue-400 rounded-full mx-2 mb-1 transition-all" />
                )}

                <div className="flex items-stretch gap-0">
                  {/* Step box */}
                  <div
                    draggable
                    onDragStart={() => handleStepDragStart(idx)}
                    onDragOver={(e) => handleStepDragOver(e, idx)}
                    onDrop={(e) => handleStepDrop(e, idx)}
                    onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null) }}
                    onClick={() => onSelectStep(isSelected ? null : step.id)}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    aria-label={`${step.type} step ${step.order}: ${step.label}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectStep(isSelected ? null : step.id)
                      }
                      if (e.key === 'Delete' || e.key === 'Backspace') {
                        e.preventDefault()
                        handleDeleteStep(step.id)
                      }
                    }}
                    className={`
                      flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer
                      select-none transition-all duration-150
                      ${colors.border} ${colors.bg}
                      ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md' : 'hover:shadow-sm'}
                      ${isDraggingThis ? 'opacity-40' : 'opacity-100'}
                    `}
                    data-testid={`canvas-step-${step.id}`}
                  >
                    {/* Order badge */}
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${colors.badge}`}
                    >
                      {step.order}
                    </span>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${colors.text}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {step.type === 'ACTION'
                          ? `Action: ${step.actionType ?? 'not configured'}`
                          : `Conditions: ${(step.conditions ?? []).length}`}
                      </p>
                    </div>

                    {/* Type badge */}
                    <span
                      className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge} opacity-80`}
                    >
                      {step.type}
                    </span>

                    {/* Drag handle */}
                    <span className="text-gray-400 cursor-grab flex-shrink-0" aria-hidden>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id) }}
                      aria-label={`Delete step ${step.order}`}
                      className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      data-testid={`step-delete-${step.id}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Connector arrow between steps */}
                {idx < steps.length - 1 && (
                  <div className="flex justify-center py-1" aria-hidden>
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}

          {/* Drop indicator at end */}
          {dragOverIdx === steps.length && draggingIdx !== null && (
            <div className="h-1 bg-blue-400 rounded-full mx-2 mt-1 transition-all" />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utility exported for page-level use
// ---------------------------------------------------------------------------

export function createStep(type: StepType, order: number): CanvasStep {
  return {
    id: generateId(),
    type,
    order,
    label: generateLabel(type, order),
    actionType: type === 'ACTION' ? 'TRANSFER' : undefined,
    actionPayload: type === 'ACTION' ? {} : undefined,
    conditions: type === 'CONDITION' ? [] : undefined,
  }
}
