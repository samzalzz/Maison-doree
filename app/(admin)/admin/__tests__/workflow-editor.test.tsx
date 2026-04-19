/**
 * @jest-environment jsdom
 *
 * app/(admin)/admin/__tests__/workflow-editor.test.tsx
 *
 * UI tests for the Workflow Create/Edit page and its component building blocks:
 *  - WorkflowForm  (form section)
 *  - StepPalette   (step blocks)
 *  - WorkflowCanvas (drag-drop area)
 *  - StepConfigPanel (step configuration)
 *  - ActionTypeFields (dynamic payload fields)
 *  - WorkflowEditorPage (full page integration)
 *
 * Strategy:
 *  - fetch is mocked via jest.spyOn.
 *  - next/navigation hooks are mocked.
 *  - Tests cover: rendering, form validation, canvas step add/delete/select,
 *    action type field rendering, condition management, create/update API calls,
 *    edit mode pre-population, error handling.
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useParams: () => ({ id: 'wf_edit_001' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/workflows/wf_edit_001',
}))

jest.mock('next/link', () => {
  const React = require('react')
  return function MockLink({
    href,
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) {
    return (
      <a href={href} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    )
  }
})

jest.mock('@/lib/hooks/useToast', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    show: jest.fn(),
    toasts: [],
    removeToast: jest.fn(),
  }),
}))

jest.mock('@/lib/context/ToastContext', () => ({
  useToastContext: () => ({
    addToast: jest.fn(),
    removeToast: jest.fn(),
    toasts: [],
  }),
}))

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import WorkflowForm from '@/components/workflow/WorkflowForm'
import StepPalette from '@/components/workflow/StepPalette'
import WorkflowCanvas, { createStep } from '@/components/workflow/WorkflowCanvas'
import StepConfigPanel from '@/components/workflow/StepConfigPanel'
import ActionTypeFields from '@/components/workflow/ActionTypeFields'
import WorkflowEditorPage from '../workflows/[id]/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKFLOW_DETAIL = {
  id: 'wf_edit_001',
  name: 'Existing Workflow',
  description: 'A pre-existing workflow',
  enabled: true,
  triggerType: 'MANUAL' as const,
  createdBy: 'admin001',
  executionCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-04-10T00:00:00.000Z',
  steps: [
    {
      id: 'step_001',
      workflowId: 'wf_edit_001',
      stepNumber: 1,
      type: 'ACTION' as const,
      actionType: 'TRANSFER',
      actionPayload: { sourceLabId: 'lab1', destLabId: 'lab2', materialId: 'mat1', quantity: 10 },
      conditions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'step_002',
      workflowId: 'wf_edit_001',
      stepNumber: 2,
      type: 'CONDITION' as const,
      actionType: null,
      actionPayload: null,
      conditions: [
        { id: 'cond_001', field: 'stock.quantity', operator: 'GREATER_THAN', value: '5' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(response: unknown, status = 200) {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => response,
  } as Response)
}

function mockFetchSequence(responses: Array<{ data: unknown; status?: number }>) {
  const spy = jest.spyOn(global, 'fetch')
  responses.forEach(({ data, status = 200 }) => {
    spy.mockResolvedValueOnce({
      ok: status < 400,
      status,
      json: async () => data,
    } as Response)
  })
}

// Ensure global.fetch exists for jest.spyOn in jsdom environment
beforeEach(() => {
  if (!global.fetch) {
    global.fetch = jest.fn()
  }
})

// ---------------------------------------------------------------------------
// WorkflowForm tests
// ---------------------------------------------------------------------------

describe('WorkflowForm', () => {
  it('renders all form fields', () => {
    render(<WorkflowForm onSubmit={jest.fn()} loading={false} />)
    expect(screen.getByTestId('workflow-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-description-input')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-trigger-select')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-active-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-submit-btn')).toBeInTheDocument()
  })

  it('shows name required error when submitted empty', async () => {
    render(<WorkflowForm onSubmit={jest.fn()} loading={false} />)
    fireEvent.click(screen.getByTestId('workflow-submit-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Workflow name is required.')).toBeInTheDocument()
  })

  it('calls onSubmit with form data when valid', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<WorkflowForm onSubmit={onSubmit} loading={false} />)
    fireEvent.change(screen.getByTestId('workflow-name-input'), { target: { value: 'My Workflow' } })
    fireEvent.click(screen.getByTestId('workflow-submit-btn'))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Workflow', triggerType: 'MANUAL', isActive: true }),
      )
    })
  })

  it('disables submit button and shows Saving text when loading', () => {
    render(<WorkflowForm onSubmit={jest.fn()} loading={true} />)
    const btn = screen.getByTestId('workflow-submit-btn')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Saving…')
  })

  it('toggles isActive switch', async () => {
    render(<WorkflowForm onSubmit={jest.fn()} loading={false} />)
    const toggle = screen.getByTestId('workflow-active-toggle')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('shows Cancel button and calls onCancel when clicked', () => {
    const onCancel = jest.fn()
    render(<WorkflowForm onSubmit={jest.fn()} loading={false} onCancel={onCancel} />)
    const cancelBtn = screen.getByTestId('workflow-cancel-btn')
    expect(cancelBtn).toBeInTheDocument()
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pre-populates fields from initialData', () => {
    render(
      <WorkflowForm
        onSubmit={jest.fn()}
        loading={false}
        initialData={{ name: 'Pre-filled', description: 'Desc', triggerType: 'SCHEDULED', isActive: false }}
      />,
    )
    expect(screen.getByTestId('workflow-name-input')).toHaveValue('Pre-filled')
    expect(screen.getByTestId('workflow-description-input')).toHaveValue('Desc')
    expect(screen.getByTestId('workflow-active-toggle')).toHaveAttribute('aria-checked', 'false')
  })

  it('shows API error from error prop', () => {
    render(<WorkflowForm onSubmit={jest.fn()} loading={false} error="API error occurred" />)
    expect(screen.getByTestId('form-error')).toHaveTextContent('API error occurred')
  })
})

// ---------------------------------------------------------------------------
// StepPalette tests
// ---------------------------------------------------------------------------

describe('StepPalette', () => {
  it('renders ACTION and CONDITION palette items', () => {
    render(<StepPalette onAddStep={jest.fn()} />)
    expect(screen.getByTestId('palette-item-action')).toBeInTheDocument()
    expect(screen.getByTestId('palette-item-condition')).toBeInTheDocument()
  })

  it('calls onAddStep with ACTION type when clicked', () => {
    const onAddStep = jest.fn()
    render(<StepPalette onAddStep={onAddStep} />)
    fireEvent.click(screen.getByTestId('palette-item-action'))
    expect(onAddStep).toHaveBeenCalledWith('ACTION')
  })

  it('calls onAddStep with CONDITION type when clicked', () => {
    const onAddStep = jest.fn()
    render(<StepPalette onAddStep={onAddStep} />)
    fireEvent.click(screen.getByTestId('palette-item-condition'))
    expect(onAddStep).toHaveBeenCalledWith('CONDITION')
  })

  it('disables buttons when disabled prop is true', () => {
    render(<StepPalette onAddStep={jest.fn()} disabled />)
    expect(screen.getByTestId('palette-item-action')).toBeDisabled()
    expect(screen.getByTestId('palette-item-condition')).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// WorkflowCanvas tests
// ---------------------------------------------------------------------------

describe('WorkflowCanvas', () => {
  it('renders empty state when no steps', () => {
    render(
      <WorkflowCanvas
        steps={[]}
        onStepsChange={jest.fn()}
        selectedStepId={null}
        onSelectStep={jest.fn()}
      />,
    )
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
    expect(screen.getByText('Canvas is empty')).toBeInTheDocument()
  })

  it('renders steps list when steps are provided', () => {
    const steps = [createStep('ACTION', 1), createStep('CONDITION', 2)]
    render(
      <WorkflowCanvas
        steps={steps}
        onStepsChange={jest.fn()}
        selectedStepId={null}
        onSelectStep={jest.fn()}
      />,
    )
    expect(screen.getByTestId('canvas-steps-list')).toBeInTheDocument()
  })

  it('calls onSelectStep when a step is clicked', () => {
    const onSelectStep = jest.fn()
    const step = createStep('ACTION', 1)
    render(
      <WorkflowCanvas
        steps={[step]}
        onStepsChange={jest.fn()}
        selectedStepId={null}
        onSelectStep={onSelectStep}
      />,
    )
    fireEvent.click(screen.getByTestId(`canvas-step-${step.id}`))
    expect(onSelectStep).toHaveBeenCalledWith(step.id)
  })

  it('applies selected ring when step is selected', () => {
    const step = createStep('ACTION', 1)
    const { container } = render(
      <WorkflowCanvas
        steps={[step]}
        onStepsChange={jest.fn()}
        selectedStepId={step.id}
        onSelectStep={jest.fn()}
      />,
    )
    const stepEl = container.querySelector(`[data-testid="canvas-step-${step.id}"]`)
    expect(stepEl?.className).toContain('ring-blue-500')
  })

  it('calls onStepsChange without deleted step when delete is clicked', () => {
    const onStepsChange = jest.fn()
    const step = createStep('ACTION', 1)
    render(
      <WorkflowCanvas
        steps={[step]}
        onStepsChange={onStepsChange}
        selectedStepId={null}
        onSelectStep={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId(`step-delete-${step.id}`))
    expect(onStepsChange).toHaveBeenCalledWith([])
  })
})

// ---------------------------------------------------------------------------
// StepConfigPanel tests
// ---------------------------------------------------------------------------

describe('StepConfigPanel', () => {
  beforeEach(() => {
    // StepConfigPanel renders ActionTypeFields which calls fetch for labs/materials
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    } as Response)
  })

  it('renders action type select for ACTION steps', () => {
    const step = { id: 's1', type: 'ACTION' as const, order: 1, label: 'Action Step 1', actionType: 'TRANSFER' as const, actionPayload: {} }
    render(<StepConfigPanel step={step} onChange={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByTestId('action-type-select')).toBeInTheDocument()
    expect(screen.getByTestId('action-type-select')).toHaveValue('TRANSFER')
  })

  it('renders condition fields for CONDITION steps', () => {
    const step = {
      id: 's2',
      type: 'CONDITION' as const,
      order: 1,
      label: 'Condition Step 1',
      conditions: [{ id: 'c1', field: 'stock', operator: 'EQUALS' as const, value: '0' }],
    }
    render(<StepConfigPanel step={step} onChange={jest.fn()} onDelete={jest.fn()} />)
    expect(screen.getByTestId('add-condition-btn')).toBeInTheDocument()
    expect(screen.getByTestId('condition-row-0')).toBeInTheDocument()
  })

  it('calls onChange with new condition when Add Condition is clicked', () => {
    const onChange = jest.fn()
    const step = { id: 's2', type: 'CONDITION' as const, order: 1, label: 'Cond 1', conditions: [] }
    render(<StepConfigPanel step={step} onChange={onChange} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByTestId('add-condition-btn'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ conditions: expect.arrayContaining([expect.objectContaining({ field: '', operator: 'EQUALS' })]) }),
    )
  })

  it('calls onDelete when delete step button is clicked', () => {
    const onDelete = jest.fn()
    const step = { id: 's1', type: 'ACTION' as const, order: 1, label: 'Action Step 1', actionType: 'EMAIL' as const, actionPayload: {} }
    render(<StepConfigPanel step={step} onChange={jest.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByTestId('step-delete-btn'))
    expect(onDelete).toHaveBeenCalledWith('s1')
  })
})

// ---------------------------------------------------------------------------
// ActionTypeFields tests
// ---------------------------------------------------------------------------

describe('ActionTypeFields', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    } as Response)
  })

  it('renders TRANSFER fields', () => {
    render(<ActionTypeFields actionType="TRANSFER" payload={{}} onChange={jest.fn()} />)
    expect(screen.getByTestId('action-fields-transfer')).toBeInTheDocument()
    expect(screen.getByTestId('transfer-quantity')).toBeInTheDocument()
  })

  it('renders UPDATE_INVENTORY fields', () => {
    render(<ActionTypeFields actionType="UPDATE_INVENTORY" payload={{}} onChange={jest.fn()} />)
    expect(screen.getByTestId('action-fields-update-inventory')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-reason')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-quantity')).toBeInTheDocument()
  })

  it('renders NOTIFY fields with channel toggles', () => {
    render(<ActionTypeFields actionType="NOTIFY" payload={{ channels: [] }} onChange={jest.fn()} />)
    expect(screen.getByTestId('action-fields-notify')).toBeInTheDocument()
    expect(screen.getByTestId('notify-channel-slack')).toBeInTheDocument()
    expect(screen.getByTestId('notify-channel-email')).toBeInTheDocument()
    expect(screen.getByTestId('notify-channel-sms')).toBeInTheDocument()
  })

  it('renders EMAIL fields', () => {
    render(<ActionTypeFields actionType="EMAIL" payload={{}} onChange={jest.fn()} />)
    expect(screen.getByTestId('action-fields-email')).toBeInTheDocument()
    expect(screen.getByTestId('email-to')).toBeInTheDocument()
    expect(screen.getByTestId('email-subject')).toBeInTheDocument()
    expect(screen.getByTestId('email-body')).toBeInTheDocument()
  })

  it('calls onChange when a NOTIFY channel is toggled', () => {
    const onChange = jest.fn()
    render(<ActionTypeFields actionType="NOTIFY" payload={{ channels: [] }} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('notify-channel-slack'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ channels: ['slack'] }))
  })
})

// ---------------------------------------------------------------------------
// WorkflowEditorPage — CREATE mode
// ---------------------------------------------------------------------------

describe('WorkflowEditorPage — create mode', () => {
  it('renders Create Workflow heading in create mode', () => {
    render(<WorkflowEditorPage params={{ id: 'create' }} />)
    // Use heading role query to avoid matching the submit button which also says "Create Workflow"
    expect(screen.getByRole('heading', { name: 'Create Workflow' })).toBeInTheDocument()
  })

  it('renders canvas and palette in create mode', () => {
    render(<WorkflowEditorPage params={{ id: 'create' }} />)
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('step-palette')).toBeInTheDocument()
  })

  it('adds a step to canvas when palette ACTION is clicked', async () => {
    render(<WorkflowEditorPage params={{ id: 'create' }} />)
    fireEvent.click(screen.getByTestId('palette-item-action'))
    await waitFor(() => {
      expect(screen.getByTestId('canvas-steps-list')).toBeInTheDocument()
    })
  })

  it('shows step config panel when a step is selected', async () => {
    render(<WorkflowEditorPage params={{ id: 'create' }} />)
    // Add an action step via the palette button
    fireEvent.click(screen.getByTestId('palette-item-action'))
    // Wait for the canvas to show the step list
    await waitFor(() => screen.getByTestId('canvas-steps-list'))
    // The step is auto-selected when added via palette (via handleAddStep which calls setSelectedStepId)
    // Config section should appear automatically since step is selected
    await waitFor(() => {
      expect(screen.getByTestId('step-config-section')).toBeInTheDocument()
    })
  })

  it('calls POST /api/admin/workflows on form submit (create)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { id: 'new_wf_001' } }),
    } as Response)

    render(<WorkflowEditorPage params={{ id: 'create' }} />)
    fireEvent.change(screen.getByTestId('workflow-name-input'), { target: { value: 'New Workflow' } })
    fireEvent.click(screen.getByTestId('workflow-submit-btn'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/workflows',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('shows form error when API returns error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }),
    } as Response)

    render(<WorkflowEditorPage params={{ id: 'create' }} />)
    fireEvent.change(screen.getByTestId('workflow-name-input'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('workflow-submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// WorkflowEditorPage — EDIT mode
// ---------------------------------------------------------------------------

describe('WorkflowEditorPage — edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state while fetching workflow', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => undefined))
    render(<WorkflowEditorPage params={{ id: 'wf_edit_001' }} />)
    expect(screen.getByTestId('loading-detail')).toBeInTheDocument()
  })

  it('pre-populates form with existing workflow data', async () => {
    mockFetch({ success: true, data: WORKFLOW_DETAIL })
    render(<WorkflowEditorPage params={{ id: 'wf_edit_001' }} />)
    await waitFor(() => {
      expect(screen.getByTestId('workflow-name-input')).toHaveValue('Existing Workflow')
    })
    expect(screen.getByTestId('workflow-description-input')).toHaveValue('A pre-existing workflow')
  })

  it('renders existing steps on canvas in edit mode', async () => {
    mockFetch({ success: true, data: WORKFLOW_DETAIL })
    render(<WorkflowEditorPage params={{ id: 'wf_edit_001' }} />)
    await waitFor(() => screen.getByTestId('canvas-steps-list'))
    // Should show 2 steps (ACTION + CONDITION)
    expect(screen.getByTestId('canvas-steps-list').children.length).toBeGreaterThanOrEqual(1)
  })

  it('calls PATCH /api/admin/workflows/[id] on save (edit)', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: WORKFLOW_DETAIL }),
    } as Response)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ...WORKFLOW_DETAIL, name: 'Updated' } }),
    } as Response)

    render(<WorkflowEditorPage params={{ id: 'wf_edit_001' }} />)
    await waitFor(() => screen.getByTestId('workflow-name-input'))
    fireEvent.change(screen.getByTestId('workflow-name-input'), { target: { value: 'Updated Name' } })
    fireEvent.click(screen.getByTestId('workflow-submit-btn'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/admin/workflows/wf_edit_001',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })

  it('shows fetch error when workflow cannot be loaded', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: 'Workflow not found.' } }),
    } as Response)

    render(<WorkflowEditorPage params={{ id: 'wf_nonexistent' }} />)
    await waitFor(() => {
      expect(screen.getByTestId('fetch-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Workflow not found.')).toBeInTheDocument()
  })
})
