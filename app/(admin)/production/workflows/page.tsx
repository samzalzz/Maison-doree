'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type {
  Workflow,
  WorkflowWithSteps,
  WorkflowExecution,
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowConditionOperator,
  CanvasNode,
  CanvasEdge,
  CanvasNodeType,
} from '@/lib/types-production'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_LABELS: Record<WorkflowTriggerType, string> = {
  BATCH_CREATED: 'Batch Created',
  BATCH_COMPLETED: 'Batch Completed',
  LOW_STOCK: 'Low Stock',
  SCHEDULED: 'Scheduled (Cron)',
  MANUAL: 'Manual',
}

const ACTION_LABELS: Record<WorkflowActionType, string> = {
  TRANSFER_STOCK: 'Transfer Stock',
  CREATE_ORDER: 'Create Purchase Order',
  SEND_NOTIFICATION: 'Send Notification',
  LOG_EVENT: 'Log Event',
}

const OPERATOR_LABELS: Record<WorkflowConditionOperator, string> = {
  EQUALS: '= equals',
  GREATER_THAN: '> greater than',
  LESS_THAN: '< less than',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts with',
}

const NODE_TYPE_COLORS: Record<CanvasNodeType, string> = {
  START: 'bg-green-500 text-white border-green-700',
  END: 'bg-slate-500 text-white border-slate-700',
  CONDITION: 'bg-yellow-400 text-yellow-900 border-yellow-600',
  ACTION: 'bg-blue-500 text-white border-blue-700',
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 70

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function defaultNodes(): CanvasNode[] {
  return [
    { id: 'start', type: 'START', label: 'Start', x: 100, y: 200 },
    { id: 'end', type: 'END', label: 'End', x: 600, y: 200 },
  ]
}

function defaultEdges(): CanvasEdge[] {
  return [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end' }]
}

function buildStepsFromCanvas(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): object[] {
  const workNodes = nodes.filter((n) => n.type !== 'START' && n.type !== 'END')
  const steps = workNodes
    .filter((n) => n.stepOrder !== undefined)
    .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
    .map((node) => {
      const step: Record<string, unknown> = {
        order: node.stepOrder,
        type: node.type === 'CONDITION' ? 'condition' : 'action',
      }
      if (node.type === 'CONDITION' && node.conditionConfig) {
        step.condition = node.conditionConfig
        if (node.elseStepOrder) step.elseStepOrder = node.elseStepOrder
      }
      if (node.type === 'ACTION' && node.actionConfig) {
        step.action = node.actionConfig
      }
      return step
    })
  return steps
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Node palette item
function PaletteItem({
  type,
  label,
  onAddNode,
}: {
  type: CanvasNodeType
  label: string
  onAddNode: (type: CanvasNodeType) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onAddNode(type)}
      className={`w-full text-left px-3 py-2 rounded border-2 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity ${NODE_TYPE_COLORS[type]}`}
    >
      + {label}
    </button>
  )
}

// Condition config form
function ConditionConfigForm({
  config,
  onChange,
}: {
  config: CanvasNode['conditionConfig']
  onChange: (c: CanvasNode['conditionConfig']) => void
}) {
  const current = config ?? { field: '', operator: 'EQUALS' as WorkflowConditionOperator, value: '' }
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Field (dot path)</label>
        <input
          type="text"
          placeholder="e.g. stock.quantity"
          value={current.field}
          onChange={(e) => onChange({ ...current, field: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Operator</label>
        <select
          value={current.operator}
          onChange={(e) => onChange({ ...current, operator: e.target.value as WorkflowConditionOperator })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {(Object.keys(OPERATOR_LABELS) as WorkflowConditionOperator[]).map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Value</label>
        <input
          type="text"
          placeholder="e.g. 10"
          value={current.value}
          onChange={(e) => onChange({ ...current, value: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
    </div>
  )
}

// Action config form
function ActionConfigForm({
  config,
  onChange,
}: {
  config: CanvasNode['actionConfig']
  onChange: (c: CanvasNode['actionConfig']) => void
}) {
  const current = config ?? { type: 'LOG_EVENT' as WorkflowActionType, config: {} }

  function updateRawConfig(updates: Record<string, unknown>) {
    onChange({ ...current, config: { ...current.config, ...updates } })
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Action Type</label>
        <select
          value={current.type}
          onChange={(e) => onChange({ type: e.target.value as WorkflowActionType, config: {} })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {(Object.keys(ACTION_LABELS) as WorkflowActionType[]).map((t) => (
            <option key={t} value={t}>
              {ACTION_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {current.type === 'TRANSFER_STOCK' && (
        <>
          <input
            type="text"
            placeholder="Source Lab ID"
            value={(current.config.sourceLab as string) ?? ''}
            onChange={(e) => updateRawConfig({ sourceLab: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Destination Lab ID"
            value={(current.config.destLab as string) ?? ''}
            onChange={(e) => updateRawConfig({ destLab: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Material ID"
            value={(current.config.material as string) ?? ''}
            onChange={(e) => updateRawConfig({ material: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="number"
            placeholder="Quantity"
            value={(current.config.quantity as number) ?? ''}
            onChange={(e) => updateRawConfig({ quantity: parseFloat(e.target.value) })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </>
      )}

      {current.type === 'CREATE_ORDER' && (
        <>
          <input
            type="text"
            placeholder="Supplier name"
            value={(current.config.supplier as string) ?? ''}
            onChange={(e) => updateRawConfig({ supplier: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="text"
            placeholder="Material ID"
            value={(current.config.material as string) ?? ''}
            onChange={(e) => updateRawConfig({ material: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            type="number"
            placeholder="Quantity"
            value={(current.config.quantity as number) ?? ''}
            onChange={(e) => updateRawConfig({ quantity: parseFloat(e.target.value) })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </>
      )}

      {current.type === 'SEND_NOTIFICATION' && (
        <>
          <select
            value={(current.config.channel as string) ?? 'email'}
            onChange={(e) => updateRawConfig({ channel: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
          <input
            type="text"
            placeholder="Recipient (email or URL)"
            value={(current.config.recipient as string) ?? ''}
            onChange={(e) => updateRawConfig({ recipient: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <textarea
            placeholder="Message (use {{field}} for template vars)"
            value={(current.config.message as string) ?? ''}
            onChange={(e) => updateRawConfig({ message: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            rows={3}
          />
        </>
      )}

      {current.type === 'LOG_EVENT' && (
        <textarea
          placeholder="Description (use {{field}} for template vars)"
          value={(current.config.description as string) ?? ''}
          onChange={(e) => updateRawConfig({ description: e.target.value })}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          rows={3}
        />
      )}
    </div>
  )
}

// Single canvas node
function CanvasNodeBox({
  node,
  selected,
  onSelect,
  onDragStart,
}: {
  node: CanvasNode
  selected: boolean
  onSelect: (id: string) => void
  onDragStart: (e: React.MouseEvent, id: string) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        cursor: 'grab',
        userSelect: 'none',
        zIndex: selected ? 10 : 1,
      }}
      className={`rounded-lg border-2 px-3 py-2 shadow-md text-sm font-semibold ${NODE_TYPE_COLORS[node.type]} ${
        selected ? 'ring-4 ring-offset-1 ring-indigo-400' : ''
      }`}
      onMouseDown={(e) => {
        e.stopPropagation()
        onDragStart(e, node.id)
        onSelect(node.id)
      }}
    >
      <div className="text-xs uppercase tracking-wide opacity-70 mb-0.5">{node.type}</div>
      <div className="truncate">{node.label}</div>
      {node.stepOrder !== undefined && (
        <div className="text-xs opacity-60 mt-0.5">Step {node.stepOrder}</div>
      )}
    </div>
  )
}

// SVG edge line
function EdgeLine({ fromNode, toNode, label }: { fromNode: CanvasNode; toNode: CanvasNode; label?: string }) {
  const x1 = fromNode.x + NODE_WIDTH
  const y1 = fromNode.y + NODE_HEIGHT / 2
  const x2 = toNode.x
  const y2 = toNode.y + NODE_HEIGHT / 2
  const cx = (x1 + x2) / 2

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
        stroke="#94a3b8"
        strokeWidth={2}
        fill="none"
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text x={cx} y={Math.min(y1, y2) - 4} fontSize={10} fill="#64748b" textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  )
}

// Execution history row
function ExecutionRow({ execution }: { execution: WorkflowExecution }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }

  return (
    <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-gray-50 text-sm">
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[execution.status] ?? 'bg-gray-100'}`}>
        {execution.status}
      </span>
      <span className="text-gray-500 flex-1 font-mono text-xs">{execution.id.slice(0, 12)}...</span>
      <span className="text-gray-500">
        {new Date(execution.startedAt).toLocaleString()}
      </span>
      {execution.completedAt && (
        <span className="text-gray-400 text-xs">
          {Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s
        </span>
      )}
      {execution.errorMessage && (
        <span className="text-red-600 text-xs truncate max-w-[200px]" title={execution.errorMessage}>
          {execution.errorMessage}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  // ---- List state ----
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // ---- Editor state ----
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowWithSteps | null>(null)

  // Workflow form fields
  const [wfName, setWfName] = useState('')
  const [wfDescription, setWfDescription] = useState('')
  const [wfTriggerType, setWfTriggerType] = useState<WorkflowTriggerType>('MANUAL')
  const [wfTriggerConfig, setWfTriggerConfig] = useState('{}')
  const [wfEnabled, setWfEnabled] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // ---- Canvas state ----
  const [nodes, setNodes] = useState<CanvasNode[]>(defaultNodes)
  const [edges, setEdges] = useState<CanvasEdge[]>(defaultEdges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [stepCounter, setStepCounter] = useState(1)

  const canvasRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{ nodeId: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number } | null>(null)

  // ---- Executions panel state ----
  const [executionsOpen, setExecutionsOpen] = useState(false)
  const [executionsWorkflow, setExecutionsWorkflow] = useState<Workflow | null>(null)
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [executionsLoading, setExecutionsLoading] = useState(false)

  // ---- Executing state ----
  const [executingId, setExecutingId] = useState<string | null>(null)

  // ---- Initial load ----
  useEffect(() => {
    fetchWorkflows()
  }, [])

  async function fetchWorkflows() {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch('/api/admin/workflows?take=50')
      const json = await res.json()
      if (json.success) {
        setWorkflows(json.data)
      } else {
        setListError(json.error?.message ?? 'Failed to load workflows')
      }
    } catch {
      setListError('Network error while loading workflows')
    } finally {
      setListLoading(false)
    }
  }

  // ---- Canvas drag logic ----
  const handleDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    draggingRef.current = {
      nodeId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: node.x,
      startNodeY: node.y,
    }

    const handleMove = (moveEvent: MouseEvent) => {
      if (!draggingRef.current) return
      const dx = moveEvent.clientX - draggingRef.current.startMouseX
      const dy = moveEvent.clientY - draggingRef.current.startMouseY
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingRef.current!.nodeId
            ? { ...n, x: Math.max(0, draggingRef.current!.startNodeX + dx), y: Math.max(0, draggingRef.current!.startNodeY + dy) }
            : n,
        ),
      )
    }

    const handleUp = () => {
      draggingRef.current = null
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [nodes])

  // ---- Add node from palette ----
  function addNode(type: CanvasNodeType) {
    if (type === 'START' || type === 'END') return
    const order = stepCounter
    setStepCounter((c) => c + 1)
    const newNode: CanvasNode = {
      id: generateId(),
      type,
      label: type === 'CONDITION' ? `Condition ${order}` : `Action ${order}`,
      x: 120 + order * 220,
      y: 200,
      stepOrder: order,
      conditionConfig: type === 'CONDITION' ? { field: '', operator: 'EQUALS', value: '' } : undefined,
      actionConfig: type === 'ACTION' ? { type: 'LOG_EVENT', config: { description: '' } } : undefined,
    }
    setNodes((prev) => [...prev, newNode])
    // Auto-connect: insert before END
    setEdges((prev) => {
      const endEdge = prev.find((e) => e.toNodeId === 'end')
      if (!endEdge) return [...prev, { id: generateId(), fromNodeId: newNode.id, toNodeId: 'end' }]
      const updatedEdges = prev.filter((e) => e.id !== endEdge.id)
      return [
        ...updatedEdges,
        { id: generateId(), fromNodeId: endEdge.fromNodeId, toNodeId: newNode.id },
        { id: generateId(), fromNodeId: newNode.id, toNodeId: 'end' },
      ]
    })
    setSelectedNodeId(newNode.id)
  }

  function removeSelectedNode() {
    if (!selectedNodeId || selectedNodeId === 'start' || selectedNodeId === 'end') return
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId))
    setEdges((prev) =>
      prev.filter((e) => e.fromNodeId !== selectedNodeId && e.toNodeId !== selectedNodeId),
    )
    setSelectedNodeId(null)
  }

  // ---- Selected node mutations ----
  function updateSelectedNodeLabel(label: string) {
    if (!selectedNodeId) return
    setNodes((prev) => prev.map((n) => (n.id === selectedNodeId ? { ...n, label } : n)))
  }

  function updateSelectedConditionConfig(c: CanvasNode['conditionConfig']) {
    if (!selectedNodeId) return
    setNodes((prev) => prev.map((n) => (n.id === selectedNodeId ? { ...n, conditionConfig: c } : n)))
  }

  function updateSelectedActionConfig(c: CanvasNode['actionConfig']) {
    if (!selectedNodeId) return
    setNodes((prev) => prev.map((n) => (n.id === selectedNodeId ? { ...n, actionConfig: c } : n)))
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  // ---- Open editor for a new workflow ----
  function openNewWorkflow() {
    setEditingWorkflow(null)
    setWfName('')
    setWfDescription('')
    setWfTriggerType('MANUAL')
    setWfTriggerConfig('{}')
    setWfEnabled(true)
    setNodes(defaultNodes())
    setEdges(defaultEdges())
    setStepCounter(1)
    setSelectedNodeId(null)
    setFormError(null)
    setEditorOpen(true)
  }

  // ---- Open editor to edit an existing workflow ----
  async function openEditWorkflow(wf: Workflow) {
    try {
      const res = await fetch(`/api/admin/workflows/${wf.id}`)
      const json = await res.json()
      if (!json.success) {
        alert(json.error?.message ?? 'Failed to load workflow')
        return
      }
      const full: WorkflowWithSteps = json.data
      setEditingWorkflow(full)
      setWfName(full.name)
      setWfDescription(full.description ?? '')
      setWfTriggerType(full.triggerType)
      setWfTriggerConfig(JSON.stringify(full.triggerConfig, null, 2))
      setWfEnabled(full.enabled)
      setFormError(null)

      // Reconstruct canvas from steps
      const reconstructed: CanvasNode[] = [
        { id: 'start', type: 'START', label: 'Start', x: 60, y: 200 },
      ]
      let maxOrder = 0
      for (const step of full.steps) {
        const xPos = 60 + (step.order + 1) * 220
        const node: CanvasNode = {
          id: step.id,
          type: step.type === 'condition' ? 'CONDITION' : 'ACTION',
          label:
            step.type === 'condition'
              ? `${step.condition?.field ?? 'Condition'} ${step.condition?.operator ?? ''} ${step.condition?.value ?? ''}`
              : (step.action ? ACTION_LABELS[step.action.type] : `Action ${step.order}`),
          x: xPos,
          y: 200,
          stepOrder: step.order,
          conditionConfig: step.condition
            ? { field: step.condition.field, operator: step.condition.operator, value: step.condition.value }
            : undefined,
          actionConfig: step.action
            ? { type: step.action.type, config: step.action.config as Record<string, unknown> }
            : undefined,
          elseStepOrder: step.elseStepOrder ?? undefined,
        }
        reconstructed.push(node)
        if (step.order > maxOrder) maxOrder = step.order
      }
      reconstructed.push({
        id: 'end',
        type: 'END',
        label: 'End',
        x: 60 + (maxOrder + 2) * 220,
        y: 200,
      })

      // Build edges from node order
      const reconstructedEdges: CanvasEdge[] = []
      for (let i = 0; i < reconstructed.length - 1; i++) {
        reconstructedEdges.push({
          id: generateId(),
          fromNodeId: reconstructed[i].id,
          toNodeId: reconstructed[i + 1].id,
        })
      }

      setNodes(reconstructed)
      setEdges(reconstructedEdges)
      setStepCounter(maxOrder + 1)
      setSelectedNodeId(null)
      setEditorOpen(true)
    } catch {
      alert('Failed to load workflow details')
    }
  }

  // ---- Save workflow ----
  async function saveWorkflow() {
    setFormError(null)
    setSaving(true)

    let parsedTriggerConfig: Record<string, unknown> = {}
    try {
      parsedTriggerConfig = JSON.parse(wfTriggerConfig)
    } catch {
      setFormError('Trigger Config must be valid JSON')
      setSaving(false)
      return
    }

    const steps = buildStepsFromCanvas(nodes, edges)

    const payload = {
      name: wfName,
      description: wfDescription || undefined,
      triggerType: wfTriggerType,
      triggerConfig: parsedTriggerConfig,
      enabled: wfEnabled,
      steps,
    }

    try {
      const url = editingWorkflow ? `/api/admin/workflows/${editingWorkflow.id}` : '/api/admin/workflows'
      const method = editingWorkflow ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!json.success) {
        setFormError(json.error?.message ?? 'Save failed')
        return
      }

      setEditorOpen(false)
      fetchWorkflows()
    } catch {
      setFormError('Network error while saving')
    } finally {
      setSaving(false)
    }
  }

  // ---- Toggle enabled ----
  async function toggleEnabled(wf: Workflow) {
    try {
      const res = await fetch(`/api/admin/workflows/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !wf.enabled }),
      })
      const json = await res.json()
      if (json.success) fetchWorkflows()
    } catch {
      alert('Failed to toggle workflow')
    }
  }

  // ---- Delete workflow ----
  async function deleteWorkflow(wf: Workflow) {
    if (!confirm(`Delete workflow "${wf.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/workflows/${wf.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) fetchWorkflows()
      else alert(json.error?.message ?? 'Delete failed')
    } catch {
      alert('Failed to delete workflow')
    }
  }

  // ---- Manual execute ----
  async function executeWorkflow(wf: Workflow) {
    setExecutingId(wf.id)
    try {
      const res = await fetch(`/api/admin/workflows/${wf.id}/execute`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        alert(`Workflow executed. Status: ${json.data.status}`)
        fetchWorkflows()
      } else {
        alert(json.error?.message ?? 'Execution failed')
      }
    } catch {
      alert('Network error during execution')
    } finally {
      setExecutingId(null)
    }
  }

  // ---- Open executions panel ----
  async function openExecutions(wf: Workflow) {
    setExecutionsWorkflow(wf)
    setExecutionsOpen(true)
    setExecutionsLoading(true)
    try {
      const res = await fetch(`/api/admin/workflows/${wf.id}/executions?take=20`)
      const json = await res.json()
      if (json.success) setExecutions(json.data)
    } catch {
      // ignore
    } finally {
      setExecutionsLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Workflows</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Automate stock transfers, orders, and notifications based on production events.
            </p>
          </div>
          <button
            type="button"
            onClick={openNewWorkflow}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            New Workflow
          </button>
        </div>

        {/* Workflow list */}
        {listLoading && <p className="text-gray-500 text-sm">Loading workflows...</p>}
        {listError && <p className="text-red-600 text-sm">{listError}</p>}

        {!listLoading && workflows.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No workflows yet. Create your first one above.</p>
          </div>
        )}

        {workflows.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Trigger</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Runs</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Run</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workflows.map((wf) => (
                  <tr key={wf.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {wf.name}
                      {wf.description && (
                        <p className="text-xs text-gray-400 mt-0.5 font-normal truncate max-w-[240px]">
                          {wf.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-medium">
                        {TRIGGER_LABELS[wf.triggerType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{wf.executionCount}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {wf.lastExecuted ? new Date(wf.lastExecuted).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleEnabled(wf)}
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                          wf.enabled
                            ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {wf.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditWorkflow(wf)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => executeWorkflow(wf)}
                        disabled={executingId === wf.id || !wf.enabled}
                        className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-40"
                      >
                        {executingId === wf.id ? 'Running...' : 'Run'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openExecutions(wf)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWorkflow(wf)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- VISUAL EDITOR MODAL ---- */}
        {editorOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch">
            <div className="bg-white flex flex-col w-full h-full overflow-hidden">

              {/* Editor header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingWorkflow ? `Edit: ${editingWorkflow.name}` : 'New Workflow'}
                </h2>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveWorkflow}
                    disabled={saving}
                    className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Workflow'}
                  </button>
                </div>
              </div>

              {formError && (
                <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex flex-1 overflow-hidden">

                {/* Left panel: settings + palette */}
                <div className="w-64 border-r border-gray-200 overflow-y-auto p-4 space-y-5 shrink-0 bg-gray-50">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Workflow Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                        <input
                          type="text"
                          value={wfName}
                          onChange={(e) => setWfName(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          placeholder="Workflow name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                        <textarea
                          value={wfDescription}
                          onChange={(e) => setWfDescription(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                          rows={2}
                          placeholder="Optional description"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Trigger</label>
                        <select
                          value={wfTriggerType}
                          onChange={(e) => setWfTriggerType(e.target.value as WorkflowTriggerType)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                        >
                          {(Object.keys(TRIGGER_LABELS) as WorkflowTriggerType[]).map((t) => (
                            <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Trigger Config (JSON)</label>
                        <textarea
                          value={wfTriggerConfig}
                          onChange={(e) => setWfTriggerConfig(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono"
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="wf-enabled"
                          type="checkbox"
                          checked={wfEnabled}
                          onChange={(e) => setWfEnabled(e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor="wf-enabled" className="text-sm text-gray-700">Enabled</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Add Node</h3>
                    <div className="space-y-2">
                      <PaletteItem type="CONDITION" label="Condition" onAddNode={addNode} />
                      <PaletteItem type="ACTION" label="Action" onAddNode={addNode} />
                    </div>
                  </div>
                </div>

                {/* Center: canvas */}
                <div
                  ref={canvasRef}
                  className="flex-1 relative overflow-auto bg-slate-100"
                  style={{ minHeight: 500 }}
                  onClick={() => setSelectedNodeId(null)}
                >
                  {/* Grid pattern */}
                  <svg
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                      </pattern>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                      </marker>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Draw edges */}
                    {edges.map((edge) => {
                      const from = nodes.find((n) => n.id === edge.fromNodeId)
                      const to = nodes.find((n) => n.id === edge.toNodeId)
                      if (!from || !to) return null
                      return <EdgeLine key={edge.id} fromNode={from} toNode={to} label={edge.label} />
                    })}
                  </svg>

                  {/* Draw nodes */}
                  {nodes.map((node) => (
                    <CanvasNodeBox
                      key={node.id}
                      node={node}
                      selected={selectedNodeId === node.id}
                      onSelect={setSelectedNodeId}
                      onDragStart={handleDragStart}
                    />
                  ))}

                  {/* Canvas toolbar */}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={removeSelectedNode}
                      disabled={!selectedNodeId || selectedNodeId === 'start' || selectedNodeId === 'end'}
                      className="bg-white border border-gray-300 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-40 shadow-sm"
                    >
                      Remove Selected
                    </button>
                  </div>
                </div>

                {/* Right panel: node configuration */}
                <div className="w-72 border-l border-gray-200 overflow-y-auto p-4 bg-gray-50 shrink-0">
                  {!selectedNode && (
                    <p className="text-xs text-gray-400">Click a node on the canvas to configure it.</p>
                  )}

                  {selectedNode && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Configure: {selectedNode.type}
                      </h3>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Label</label>
                        <input
                          type="text"
                          value={selectedNode.label}
                          onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>

                      {selectedNode.type === 'CONDITION' && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-600 mb-2">Condition Logic</h4>
                          <ConditionConfigForm
                            config={selectedNode.conditionConfig}
                            onChange={updateSelectedConditionConfig}
                          />
                          <div className="mt-3">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                              Else-branch step order
                            </label>
                            <input
                              type="number"
                              placeholder="Jump to step # if false"
                              value={selectedNode.elseStepOrder ?? ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value)
                                setNodes((prev) =>
                                  prev.map((n) =>
                                    n.id === selectedNodeId
                                      ? { ...n, elseStepOrder: isNaN(val) ? undefined : val }
                                      : n,
                                  ),
                                )
                              }}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {selectedNode.type === 'ACTION' && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-600 mb-2">Action Configuration</h4>
                          <ActionConfigForm
                            config={selectedNode.actionConfig}
                            onChange={updateSelectedActionConfig}
                          />
                        </div>
                      )}

                      {(selectedNode.type === 'START' || selectedNode.type === 'END') && (
                        <p className="text-xs text-gray-400">This node has no configuration.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- EXECUTIONS PANEL ---- */}
        {executionsOpen && executionsWorkflow && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">
                  Execution History: {executionsWorkflow.name}
                </h2>
                <button
                  type="button"
                  onClick={() => setExecutionsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  x
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {executionsLoading && <p className="text-gray-400 text-sm">Loading...</p>}
                {!executionsLoading && executions.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">No executions recorded yet.</p>
                )}
                {executions.map((ex) => (
                  <ExecutionRow key={ex.id} execution={ex} />
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
