'use client'

import React from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepNodeType = 'ACTION' | 'CONDITION'

interface PaletteItemConfig {
  type: StepNodeType
  label: string
  description: string
  colorClass: string
  icon: string
}

interface StepPaletteProps {
  onAddStep: (type: StepNodeType) => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PALETTE_ITEMS: PaletteItemConfig[] = [
  {
    type: 'ACTION',
    label: 'Action Step',
    description: 'Execute an action (transfer, notify, email…)',
    colorClass: 'border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100',
    icon: 'A',
  },
  {
    type: 'CONDITION',
    label: 'Condition Step',
    description: 'Evaluate conditions before proceeding',
    colorClass: 'border-yellow-400 bg-yellow-50 text-yellow-800 hover:bg-yellow-100',
    icon: 'C',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StepPalette({ onAddStep, disabled = false }: StepPaletteProps) {
  return (
    <div className="flex flex-wrap gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg" data-testid="step-palette">
      <p className="w-full text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Drag or click to add steps
      </p>
      {PALETTE_ITEMS.map((item) => (
        <button
          key={item.type}
          type="button"
          onClick={() => !disabled && onAddStep(item.type)}
          disabled={disabled}
          aria-label={`Add ${item.label}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('stepType', item.type)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-semibold cursor-grab transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none ${item.colorClass}`}
          data-testid={`palette-item-${item.type.toLowerCase()}`}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-current bg-opacity-20 text-xs font-bold">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
      <p className="w-full text-xs text-gray-400 italic">
        Tip: Click a step on the canvas to select and configure it below.
      </p>
    </div>
  )
}
