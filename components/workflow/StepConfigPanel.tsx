'use client'

import React from 'react'
import ActionTypeFields, { type ActionType } from './ActionTypeFields'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepType = 'ACTION' | 'CONDITION'
export type ConditionOperator = 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS'

export interface ConditionRow {
  id: string
  field: string
  operator: ConditionOperator
  value: string
}

export interface CanvasStep {
  id: string
  type: StepType
  order: number
  label: string
  actionType?: ActionType
  actionPayload?: Record<string, unknown>
  conditions?: ConditionRow[]
}

interface StepConfigPanelProps {
  step: CanvasStep
  onChange: (updated: CanvasStep) => void
  onDelete: (id: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: 'TRANSFER', label: 'Transfer Stock' },
  { value: 'UPDATE_INVENTORY', label: 'Update Inventory' },
  { value: 'NOTIFY', label: 'Send Notification' },
  { value: 'EMAIL', label: 'Send Email' },
]

const OPERATOR_OPTIONS: { value: ConditionOperator; label: string }[] = [
  { value: 'EQUALS', label: '= equals' },
  { value: 'GREATER_THAN', label: '> greater than' },
  { value: 'LESS_THAN', label: '< less than' },
  { value: 'CONTAINS', label: 'contains' },
]

function generateConditionId() {
  return `cond_${Math.random().toString(36).slice(2, 9)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StepConfigPanel({ step, onChange, onDelete }: StepConfigPanelProps) {
  function addCondition() {
    const conditions = [...(step.conditions ?? []), {
      id: generateConditionId(),
      field: '',
      operator: 'EQUALS' as ConditionOperator,
      value: '',
    }]
    onChange({ ...step, conditions })
  }

  function updateCondition(id: string, updates: Partial<ConditionRow>) {
    const conditions = (step.conditions ?? []).map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    )
    onChange({ ...step, conditions })
  }

  function removeCondition(id: string) {
    const conditions = (step.conditions ?? []).filter((c) => c.id !== id)
    onChange({ ...step, conditions })
  }

  return (
    <div
      className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4"
      data-testid="step-config-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
              step.type === 'ACTION' ? 'bg-blue-600' : 'bg-yellow-500'
            }`}
          >
            {step.order}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-800">{step.label}</p>
            <p className="text-xs text-gray-500">{step.type} step — Step #{step.order}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(step.id)}
          aria-label={`Delete step ${step.order}`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 transition-colors"
          data-testid="step-delete-btn"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>

      <hr className="border-blue-200" />

      {/* ACTION step configuration */}
      {step.type === 'ACTION' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Action Type</label>
            <select
              value={step.actionType ?? 'TRANSFER'}
              onChange={(e) =>
                onChange({
                  ...step,
                  actionType: e.target.value as ActionType,
                  actionPayload: {},
                })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="action-type-select"
            >
              {ACTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ActionTypeFields
            actionType={step.actionType ?? 'TRANSFER'}
            payload={step.actionPayload ?? {}}
            onChange={(payload) => onChange({ ...step, actionPayload: payload })}
          />
        </div>
      )}

      {/* CONDITION step configuration */}
      {step.type === 'CONDITION' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Conditions</p>
              <p className="text-xs text-gray-500 mt-0.5">
                All conditions must pass (AND logic) within this step.
              </p>
            </div>
            <button
              type="button"
              onClick={addCondition}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 transition-colors"
              data-testid="add-condition-btn"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Condition
            </button>
          </div>

          {(step.conditions ?? []).length === 0 && (
            <p className="text-xs text-gray-400 italic py-2 text-center border border-dashed border-gray-300 rounded-lg">
              No conditions yet. Click &ldquo;Add Condition&rdquo; to add one.
            </p>
          )}

          {(step.conditions ?? []).map((cond, idx) => (
            <div
              key={cond.id}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-start p-3 bg-white rounded-lg border border-gray-200"
              data-testid={`condition-row-${idx}`}
            >
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Field</label>
                <input
                  type="text"
                  value={cond.field}
                  onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                  placeholder="e.g. stock.quantity"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  data-testid={`condition-field-${idx}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Op</label>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(cond.id, { operator: e.target.value as ConditionOperator })}
                  className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  data-testid={`condition-operator-${idx}`}
                >
                  {OPERATOR_OPTIONS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Value</label>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                  placeholder="e.g. 10"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  data-testid={`condition-value-${idx}`}
                />
              </div>
              <div className="flex items-end pb-0.5">
                <button
                  type="button"
                  onClick={() => removeCondition(cond.id)}
                  aria-label={`Remove condition ${idx + 1}`}
                  className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                  data-testid={`condition-remove-${idx}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
