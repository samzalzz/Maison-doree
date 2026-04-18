'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/lib/hooks/useToast'
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Settings,
  Package,
  FlaskConical,
  ChevronDown,
  GripVertical,
  Trash2,
  Eye,
  Code2,
  ArrowDown,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawMaterialSummary {
  id: string
  name: string
  type: string
  unit: string
}

interface RecipeIngredient {
  id: string
  rawMaterialId: string | null
  intermediateProductId: string | null
  quantity: number
  unit: string
  rawMaterial?: RawMaterialSummary | null
  intermediateProduct?: RawMaterialSummary | null
}

interface RecipeData {
  id: string
  name: string
  description: string | null
  laborMinutes: number
  ingredients: RecipeIngredient[]
}

interface Lab {
  id: string
  name: string
  type: string
}

interface Machine {
  id: string
  labId: string
  name: string
  type: string
  cycleTimeMinutes: number
  available: boolean
  lab: { id: string; name: string }
}

// Workflow step types
interface MaterialCheckStep {
  type: 'material_check'
  materialIds: string[]
  operator: 'all_available'
}

interface MachineOperationStep {
  type: 'machine_operation'
  machineId: string
  labId: string
  durationMinutes: number
  outputMaterialId: string | null
}

interface OutputStep {
  type: 'output'
  materialId: string
  quantity: number
}

type WorkflowStep = MaterialCheckStep | MachineOperationStep | OutputStep

// Canvas block (includes a stable client-side id for React keys + drag operations)
interface CanvasBlock {
  _id: string
  step: WorkflowStep
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _idCounter = 0
function genId() {
  return `block_${++_idCounter}_${Date.now()}`
}

function ingredientLabel(ing: RecipeIngredient): string {
  if (ing.rawMaterial) return ing.rawMaterial.name
  if (ing.intermediateProduct) return ing.intermediateProduct.name
  return ing.rawMaterialId ?? ing.intermediateProductId ?? 'Unknown'
}

function ingredientMaterialId(ing: RecipeIngredient): string {
  return ing.rawMaterialId ?? ing.intermediateProductId ?? ''
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

// ---------------------------------------------------------------------------
// Block: Check Materials
// ---------------------------------------------------------------------------

interface CheckMaterialsBlockProps {
  block: CanvasBlock & { step: MaterialCheckStep }
  recipe: RecipeData
  onDelete: () => void
}

function CheckMaterialsBlock({ block, recipe, onDelete }: CheckMaterialsBlockProps) {
  const ingredientNames = block.step.materialIds
    .map((mid) => {
      const ing = recipe.ingredients.find(
        (i) => i.rawMaterialId === mid || i.intermediateProductId === mid,
      )
      if (ing) return ingredientLabel(ing)
      return mid.slice(0, 8) + '…'
    })
    .slice(0, 3)

  const extra = block.step.materialIds.length - 3

  return (
    <div className="relative bg-white border-2 border-emerald-400 rounded-xl shadow-md w-72 group">
      {/* Connector top */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow" />

      {/* Header */}
      <div className="bg-emerald-50 border-b border-emerald-200 rounded-t-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
            Check Materials
          </span>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
          title="Delete block"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs text-gray-500 font-medium">Verifies all materials are in stock:</p>
        <div className="flex flex-wrap gap-1.5">
          {ingredientNames.map((name, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-200"
            >
              <Package className="w-2.5 h-2.5" />
              {name}
            </span>
          ))}
          {extra > 0 && (
            <span className="text-xs text-gray-400 self-center">+{extra} more</span>
          )}
        </div>
        <p className="text-xs text-emerald-700 font-semibold">
          Operator: All Available
        </p>
      </div>

      {/* Connector bottom */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block: Machine Operation
// ---------------------------------------------------------------------------

interface MachineOperationBlockProps {
  block: CanvasBlock & { step: MachineOperationStep }
  machines: Machine[]
  labs: Lab[]
  recipe: RecipeData
  onChange: (step: MachineOperationStep) => void
  onDelete: () => void
}

function MachineOperationBlock({
  block,
  machines,
  labs,
  recipe,
  onChange,
  onDelete,
}: MachineOperationBlockProps) {
  const [isEditing, setIsEditing] = useState(false)
  const step = block.step

  const machine = machines.find((m) => m.id === step.machineId)
  const lab = labs.find((l) => l.id === step.labId)

  // local edit state
  const [localMachineId, setLocalMachineId] = useState(step.machineId)
  const [localLabId, setLocalLabId] = useState(step.labId)
  const [localDuration, setLocalDuration] = useState(String(step.durationMinutes))
  const [localOutput, setLocalOutput] = useState(step.outputMaterialId ?? '')

  const filteredMachines = localLabId
    ? machines.filter((m) => m.labId === localLabId)
    : machines

  const handleSave = () => {
    const dur = parseInt(localDuration, 10)
    if (!localMachineId || !localLabId || isNaN(dur) || dur <= 0) return
    onChange({
      type: 'machine_operation',
      machineId: localMachineId,
      labId: localLabId,
      durationMinutes: dur,
      outputMaterialId: localOutput.trim() || null,
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setLocalMachineId(step.machineId)
    setLocalLabId(step.labId)
    setLocalDuration(String(step.durationMinutes))
    setLocalOutput(step.outputMaterialId ?? '')
    setIsEditing(false)
  }

  // Find intermediate material options from recipe
  const intermediateOptions = recipe.ingredients
    .filter((i) => i.intermediateProduct)
    .map((i) => ({
      id: i.intermediateProductId!,
      name: ingredientLabel(i),
    }))

  return (
    <div className="relative bg-white border-2 border-blue-400 rounded-xl shadow-md w-72 group">
      {/* Connector top */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 border-2 border-white shadow" />

      {/* Header */}
      <div className="bg-blue-50 border-b border-blue-200 rounded-t-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
            Machine Operation
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Edit block"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="Delete block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {isEditing ? (
          <div className="space-y-2">
            {/* Lab selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lab</label>
              <select
                value={localLabId}
                onChange={(e) => {
                  setLocalLabId(e.target.value)
                  setLocalMachineId('')
                }}
                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select lab...</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Machine selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Machine</label>
              <select
                value={localMachineId}
                onChange={(e) => setLocalMachineId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select machine...</option>
                {filteredMachines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={localDuration}
                onChange={(e) => setLocalDuration(e.target.value)}
                min="1"
                step="1"
                placeholder="60"
                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Intermediate output */}
            {intermediateOptions.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Intermediate Output (optional)
                </label>
                <select
                  value={localOutput}
                  onChange={(e) => setLocalOutput(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">None</option>
                  {intermediateOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCancel}
                className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 text-xs px-2 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-gray-900">
              {machine?.name ?? <span className="text-red-500 italic">No machine</span>}
            </p>
            {lab && (
              <p className="text-xs text-gray-500">
                Lab: <span className="font-medium text-gray-700">{lab.name}</span>
              </p>
            )}
            <p className="text-xs text-blue-700 font-semibold">
              Duration: {formatDuration(step.durationMinutes)}
            </p>
            {step.outputMaterialId && (
              <p className="text-xs text-gray-500">
                Output:{' '}
                <span className="font-medium text-gray-700">
                  {intermediateOptions.find((o) => o.id === step.outputMaterialId)?.name ??
                    step.outputMaterialId.slice(0, 10) + '…'}
                </span>
              </p>
            )}
            {!step.machineId && (
              <p className="text-xs text-amber-600 italic">Click the gear icon to configure</p>
            )}
          </div>
        )}
      </div>

      {/* Connector bottom */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 border-2 border-white shadow" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block: Output
// ---------------------------------------------------------------------------

interface OutputBlockProps {
  block: CanvasBlock & { step: OutputStep }
  recipe: RecipeData
  onChange: (step: OutputStep) => void
  onDelete: () => void
}

function OutputBlock({ block, recipe, onChange, onDelete }: OutputBlockProps) {
  const [isEditing, setIsEditing] = useState(false)
  const step = block.step

  const [localMaterialId, setLocalMaterialId] = useState(step.materialId)
  const [localQuantity, setLocalQuantity] = useState(String(step.quantity))

  // Collect all materials from recipe ingredients for the output selector
  const allMaterials = recipe.ingredients.map((i) => ({
    id: ingredientMaterialId(i),
    name: ingredientLabel(i),
  }))

  const selectedMaterial = allMaterials.find((m) => m.id === step.materialId)

  const handleSave = () => {
    const qty = parseFloat(localQuantity)
    if (!localMaterialId || isNaN(qty) || qty <= 0) return
    onChange({ type: 'output', materialId: localMaterialId, quantity: qty })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setLocalMaterialId(step.materialId)
    setLocalQuantity(String(step.quantity))
    setIsEditing(false)
  }

  return (
    <div className="relative bg-white border-2 border-slate-400 rounded-xl shadow-md w-72 group">
      {/* Connector top */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-white shadow" />

      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 rounded-t-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-slate-600 flex-shrink-0" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Output
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              title="Edit block"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="Delete block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {isEditing ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Output Material
              </label>
              <select
                value={localMaterialId}
                onChange={(e) => setLocalMaterialId(e.target.value)}
                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">Select material...</option>
                {allMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
              <input
                type="number"
                value={localQuantity}
                onChange={(e) => setLocalQuantity(e.target.value)}
                min="0.01"
                step="0.01"
                placeholder="1"
                className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCancel}
                className="flex-1 text-xs px-2 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 text-xs px-2 py-1.5 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-gray-900">
              {selectedMaterial ? (
                <>
                  <span className="text-slate-600 font-normal">Produces:</span>{' '}
                  {selectedMaterial.name}
                </>
              ) : (
                <span className="text-amber-600 italic text-xs">Click gear to configure</span>
              )}
            </p>
            {step.quantity > 0 && (
              <p className="text-xs text-slate-600 font-semibold">
                Quantity: {step.quantity}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Arrow connector between blocks
// ---------------------------------------------------------------------------

function BlockArrow() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-5 bg-gray-300" />
      <ArrowDown className="w-4 h-4 text-gray-400 -mt-1" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar: Ingredient item
// ---------------------------------------------------------------------------

function IngredientSidebarItem({ ing }: { ing: RecipeIngredient }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
      <Package className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate">{ingredientLabel(ing)}</p>
        <p className="text-gray-500 truncate">
          {String(ing.quantity)} {ing.unit}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar: Machine item (drag-to-add)
// ---------------------------------------------------------------------------

function MachineSidebarItem({
  machine,
  onAdd,
  selectedLabId,
}: {
  machine: Machine
  onAdd: (m: Machine) => void
  selectedLabId: string
}) {
  const isInSelectedLab = !selectedLabId || machine.labId === selectedLabId

  return (
    <button
      onClick={() => onAdd(machine)}
      disabled={!isInSelectedLab}
      className={`w-full flex items-start gap-2 px-3 py-2 border rounded-lg text-xs text-left transition-colors ${
        isInSelectedLab
          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
          : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
      }`}
      title={isInSelectedLab ? `Add ${machine.name} operation` : 'Not in selected lab'}
    >
      <Settings className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 truncate">{machine.name}</p>
        <p className="text-gray-500 truncate">{machine.type}</p>
        <p className="text-blue-600">{machine.cycleTimeMinutes}min cycle</p>
      </div>
      <Plus className="w-3 h-3 text-blue-400 flex-shrink-0 self-center ml-auto" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// JSON Preview Panel
// ---------------------------------------------------------------------------

function JsonPreviewPanel({ blocks }: { blocks: CanvasBlock[] }) {
  const steps = blocks.map((b) => b.step)
  return (
    <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-4 overflow-auto h-full font-mono leading-relaxed">
      {JSON.stringify(steps, null, 2)}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RecipeWorkflowPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const recipeId = params.id

  // Data
  const [recipe, setRecipe] = useState<RecipeData | null>(null)
  const [labs, setLabs] = useState<Lab[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedLabId, setSelectedLabId] = useState<string>('')

  // Canvas state
  const [blocks, setBlocks] = useState<CanvasBlock[]>([])

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activePanel, setActivePanel] = useState<'preview' | 'json'>('preview')

  // ---------------------------------------------------------------------------
  // Load recipe + existing workflow + labs + machines on mount
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [workflowRes, labsRes, machinesRes] = await Promise.all([
        fetch(`/api/admin/recipes/${recipeId}/workflow`),
        fetch('/api/admin/labs'),
        fetch('/api/admin/machines?take=100'),
      ])

      const [workflowJson, labsJson, machinesJson] = await Promise.all([
        workflowRes.json(),
        labsRes.json(),
        machinesRes.json(),
      ])

      if (!workflowRes.ok || !workflowJson.success) {
        toastError({
          title: 'Load Error',
          message: workflowJson.error?.message ?? 'Failed to load recipe data.',
        })
        return
      }

      setRecipe(workflowJson.data.recipe)

      if (labsJson.success) {
        setLabs(labsJson.data as Lab[])
      }

      if (machinesJson.success) {
        setMachines(machinesJson.data as Machine[])
      }

      // Hydrate canvas from saved workflow
      if (workflowJson.data.workflow?.steps?.length > 0) {
        const savedSteps: WorkflowStep[] = workflowJson.data.workflow.steps
        setBlocks(savedSteps.map((s) => ({ _id: genId(), step: s })))
        if (workflowJson.data.workflow.labId) {
          setSelectedLabId(workflowJson.data.workflow.labId)
        }
      } else {
        // Auto-add a material_check block pre-seeded from recipe ingredients
        const recipeData: RecipeData = workflowJson.data.recipe
        if (recipeData.ingredients.length > 0) {
          const materialIds = recipeData.ingredients.map(ingredientMaterialId).filter(Boolean)
          setBlocks([
            {
              _id: genId(),
              step: { type: 'material_check', materialIds, operator: 'all_available' },
            },
          ])
        }
      }
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Block manipulation helpers
  // ---------------------------------------------------------------------------

  function addMaterialCheckBlock() {
    if (!recipe) return
    const materialIds = recipe.ingredients.map(ingredientMaterialId).filter(Boolean)
    setBlocks((prev) => [
      ...prev,
      {
        _id: genId(),
        step: { type: 'material_check', materialIds, operator: 'all_available' },
      },
    ])
  }

  function addMachineBlock(machine: Machine) {
    const labId = selectedLabId || machine.labId
    setBlocks((prev) => [
      ...prev,
      {
        _id: genId(),
        step: {
          type: 'machine_operation',
          machineId: machine.id,
          labId,
          durationMinutes: machine.cycleTimeMinutes,
          outputMaterialId: null,
        },
      },
    ])
  }

  function addOutputBlock() {
    if (!recipe) return
    const firstMaterial = recipe.ingredients[0]
    setBlocks((prev) => [
      ...prev,
      {
        _id: genId(),
        step: {
          type: 'output',
          materialId: firstMaterial ? ingredientMaterialId(firstMaterial) : '',
          quantity: 1,
        },
      },
    ])
  }

  function deleteBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b._id !== id))
  }

  function updateBlock(id: string, step: WorkflowStep) {
    setBlocks((prev) =>
      prev.map((b) => (b._id === id ? { ...b, step } : b)),
    )
  }

  // ---------------------------------------------------------------------------
  // Move block up/down
  // ---------------------------------------------------------------------------

  function moveBlock(id: string, direction: 'up' | 'down') {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b._id === id)
      if (idx < 0) return prev
      const next = [...prev]
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Save workflow
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!recipe) return

    if (blocks.length === 0) {
      toastError({
        title: 'Validation Error',
        message: 'Add at least one workflow step before saving.',
      })
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/recipes/${recipeId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: blocks.map((b) => b.step),
          labId: selectedLabId || null,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Save Failed',
          message: json.error?.message ?? 'Failed to save workflow.',
        })
        return
      }

      success({
        title: 'Workflow Saved',
        message: `Workflow for "${recipe.name}" saved successfully.`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
        <span className="ml-3 text-gray-600 font-medium">Loading workflow editor...</span>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600 font-medium">Recipe not found.</p>
        <button
          onClick={() => router.push('/admin/recipes')}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Recipes
        </button>
      </div>
    )
  }

  const filteredMachines = selectedLabId
    ? machines.filter((m) => m.labId === selectedLabId)
    : machines

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Top bar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/admin/recipes')}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Back to recipes"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 truncate">
                  {recipe.name}
                </h1>
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                  Workflow Editor
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {recipe.ingredients.length} ingredient
                {recipe.ingredients.length !== 1 ? 's' : ''} &middot; Labor:{' '}
                {formatDuration(recipe.laborMinutes)}
                {recipe.description && (
                  <span> &middot; {recipe.description}</span>
                )}
              </p>
            </div>
          </div>

          {/* Right: save button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">
              {blocks.length} step{blocks.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleSave}
              disabled={isSaving || blocks.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Workflow
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Three-column layout: sidebar | canvas | right panel                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ================================================================ */}
        {/* LEFT SIDEBAR                                                       */}
        {/* ================================================================ */}
        <aside className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* Lab Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Active Lab
              </label>
              <div className="relative">
                <select
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 pr-7 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none"
                >
                  <option value="">All Labs</option>
                  {labs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Filters machines shown below
              </p>
            </div>

            {/* Add block buttons */}
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Add Block
              </p>
              <div className="space-y-1.5">
                <button
                  onClick={addMaterialCheckBlock}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-medium text-emerald-800 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Check Materials
                  <Plus className="w-3 h-3 text-emerald-400 ml-auto" />
                </button>
                <button
                  onClick={addOutputBlock}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-slate-600" />
                  Output Block
                  <Plus className="w-3 h-3 text-slate-400 ml-auto" />
                </button>
              </div>
            </div>

            {/* Ingredients reference */}
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Ingredients ({recipe.ingredients.length})
              </p>
              <div className="space-y-1.5">
                {recipe.ingredients.map((ing) => (
                  <IngredientSidebarItem key={ing.id} ing={ing} />
                ))}
                {recipe.ingredients.length === 0 && (
                  <p className="text-xs text-gray-400 italic">No ingredients in recipe.</p>
                )}
              </div>
            </div>

            {/* Machines */}
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                Machines ({filteredMachines.length})
              </p>
              <div className="space-y-1.5">
                {filteredMachines.map((m) => (
                  <MachineSidebarItem
                    key={m.id}
                    machine={m}
                    onAdd={addMachineBlock}
                    selectedLabId={selectedLabId}
                  />
                ))}
                {filteredMachines.length === 0 && (
                  <p className="text-xs text-gray-400 italic">
                    {selectedLabId
                      ? 'No machines in this lab.'
                      : 'No machines found.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ================================================================ */}
        {/* CANVAS                                                             */}
        {/* ================================================================ */}
        <main className="flex-1 overflow-auto bg-[#f8f9fc] p-8">
          {blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="p-6 bg-white rounded-2xl border-2 border-dashed border-gray-300 max-w-sm">
                <GripVertical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No workflow steps yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Use the sidebar to add Check Materials, Machine Operations, or Output blocks.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0 pb-16">
              {/* Start indicator */}
              <div className="mb-1 flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Start
                </span>
                <div className="w-0.5 h-4 bg-gray-300" />
              </div>

              {blocks.map((block, idx) => (
                <React.Fragment key={block._id}>
                  {/* Block */}
                  <div className="flex items-center gap-2">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveBlock(block._id, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors"
                        title="Move up"
                        aria-label="Move block up"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveBlock(block._id, 'down')}
                        disabled={idx === blocks.length - 1}
                        className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-0 transition-colors"
                        title="Move down"
                        aria-label="Move block down"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>

                    {/* Render the correct block component */}
                    {block.step.type === 'material_check' && (
                      <CheckMaterialsBlock
                        block={block as CanvasBlock & { step: MaterialCheckStep }}
                        recipe={recipe}
                        onDelete={() => deleteBlock(block._id)}
                      />
                    )}
                    {block.step.type === 'machine_operation' && (
                      <MachineOperationBlock
                        block={block as CanvasBlock & { step: MachineOperationStep }}
                        machines={machines}
                        labs={labs}
                        recipe={recipe}
                        onChange={(s) => updateBlock(block._id, s)}
                        onDelete={() => deleteBlock(block._id)}
                      />
                    )}
                    {block.step.type === 'output' && (
                      <OutputBlock
                        block={block as CanvasBlock & { step: OutputStep }}
                        recipe={recipe}
                        onChange={(s) => updateBlock(block._id, s)}
                        onDelete={() => deleteBlock(block._id)}
                      />
                    )}

                    {/* Step index badge */}
                    <span className="text-xs text-gray-400 font-mono ml-1">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Arrow connector (except after last block) */}
                  {idx < blocks.length - 1 && <BlockArrow />}
                </React.Fragment>
              ))}

              {/* End indicator */}
              <div className="mt-1 flex flex-col items-center">
                <div className="w-0.5 h-4 bg-gray-300" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                  End
                </span>
              </div>
            </div>
          )}
        </main>

        {/* ================================================================ */}
        {/* RIGHT PANEL: Preview / JSON                                        */}
        {/* ================================================================ */}
        <aside className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActivePanel('preview')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                activePanel === 'preview'
                  ? 'text-amber-700 border-b-2 border-amber-600 bg-amber-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Summary
            </button>
            <button
              onClick={() => setActivePanel('json')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                activePanel === 'json'
                  ? 'text-amber-700 border-b-2 border-amber-600 bg-amber-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              JSON
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-auto p-4">
            {activePanel === 'preview' ? (
              <div className="space-y-4">
                {/* Recipe summary */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-800 mb-1.5">Recipe</p>
                  <p className="text-sm font-bold text-gray-900">{recipe.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {recipe.ingredients.length} ingredient
                    {recipe.ingredients.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    Labor: {formatDuration(recipe.laborMinutes)}
                  </p>
                </div>

                {/* Step summary */}
                <div>
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Steps ({blocks.length})
                  </p>
                  {blocks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No steps added yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {blocks.map((block, idx) => {
                        const s = block.step
                        let label = ''
                        let color = ''
                        let dotColor = ''

                        if (s.type === 'material_check') {
                          label = `Check ${s.materialIds.length} material${s.materialIds.length !== 1 ? 's' : ''}`
                          color = 'text-emerald-700'
                          dotColor = 'bg-emerald-500'
                        } else if (s.type === 'machine_operation') {
                          const m = machines.find((x) => x.id === s.machineId)
                          label = `${m?.name ?? 'Machine'} — ${formatDuration(s.durationMinutes)}`
                          color = 'text-blue-700'
                          dotColor = 'bg-blue-500'
                        } else if (s.type === 'output') {
                          const mat = recipe.ingredients.find(
                            (i) =>
                              i.rawMaterialId === s.materialId ||
                              i.intermediateProductId === s.materialId,
                          )
                          label = `Output: ${mat ? ingredientLabel(mat) : 'Unknown'} x${s.quantity}`
                          color = 'text-slate-700'
                          dotColor = 'bg-slate-500'
                        }

                        return (
                          <li key={block._id} className="flex items-start gap-2">
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded-full ${dotColor} text-white text-[9px] font-bold flex items-center justify-center mt-0.5`}
                            >
                              {idx + 1}
                            </span>
                            <span className={`text-xs font-medium ${color}`}>{label}</span>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>

                {/* Estimated total time */}
                {blocks.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-700 mb-1">Estimated Duration</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatDuration(
                        blocks.reduce((acc, b) => {
                          if (b.step.type === 'machine_operation')
                            return acc + b.step.durationMinutes
                          return acc
                        }, recipe.laborMinutes),
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Machine time + base labor
                    </p>
                  </div>
                )}

                {/* Quick actions */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                    Quick Add
                  </p>
                  <button
                    onClick={addMaterialCheckBlock}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    + Check Materials
                  </button>
                  <button
                    onClick={addOutputBlock}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-slate-600" />
                    + Output Block
                  </button>
                </div>
              </div>
            ) : (
              <JsonPreviewPanel blocks={blocks} />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
