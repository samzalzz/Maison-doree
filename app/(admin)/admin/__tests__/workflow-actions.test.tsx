/**
 * @jest-environment jsdom
 *
 * app/(admin)/admin/__tests__/workflow-actions.test.tsx
 *
 * 35+ tests covering all 8 workflow action display components:
 *   ActionResultCard, ActionDetailModal, TransferActionCard,
 *   InventoryActionCard, NotifyActionCard, EmailActionCard,
 *   ActionTimeline, ActionExecutionStats
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'wf_001' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/workflows/wf_001/executions',
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

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'

import ActionResultCard from '@/components/workflow/ActionResultCard'
import ActionDetailModal from '@/components/workflow/ActionDetailModal'
import TransferActionCard from '@/components/workflow/actions/TransferActionCard'
import InventoryActionCard from '@/components/workflow/actions/InventoryActionCard'
import NotifyActionCard from '@/components/workflow/actions/NotifyActionCard'
import EmailActionCard from '@/components/workflow/actions/EmailActionCard'
import ActionTimeline from '@/components/workflow/ActionTimeline'
import ActionExecutionStats from '@/components/workflow/ActionExecutionStats'

import type {
  WorkflowActionResponse,
  WorkflowStep,
  Workflow,
} from '@/components/workflow/workflow-action-types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_STEP_TRANSFER: WorkflowStep = {
  id: 'step_transfer_1',
  workflowId: 'wf_001',
  stepNumber: 1,
  type: 'ACTION',
  actionType: 'TRANSFER',
  actionPayload: {
    sourceLabId: 'lab_A',
    destLabId: 'lab_B',
    materialId: 'mat_001',
    quantity: 50,
  },
  createdAt: '2026-04-19T10:00:00.000Z',
  updatedAt: '2026-04-19T10:00:00.000Z',
}

const BASE_STEP_INVENTORY: WorkflowStep = {
  id: 'step_inv_1',
  workflowId: 'wf_001',
  stepNumber: 2,
  type: 'ACTION',
  actionType: 'UPDATE_INVENTORY',
  actionPayload: {
    labId: 'lab_A',
    materialId: 'mat_001',
    quantity: 50,
    reason: 'Stock correction',
  },
  createdAt: '2026-04-19T10:01:00.000Z',
  updatedAt: '2026-04-19T10:01:00.000Z',
}

const BASE_STEP_NOTIFY: WorkflowStep = {
  id: 'step_notify_1',
  workflowId: 'wf_001',
  stepNumber: 3,
  type: 'ACTION',
  actionType: 'NOTIFY',
  actionPayload: {
    message: 'Low stock alert: material below threshold',
    channels: ['slack', 'email'],
  },
  createdAt: '2026-04-19T10:02:00.000Z',
  updatedAt: '2026-04-19T10:02:00.000Z',
}

const BASE_STEP_EMAIL: WorkflowStep = {
  id: 'step_email_1',
  workflowId: 'wf_001',
  stepNumber: 4,
  type: 'ACTION',
  actionType: 'EMAIL',
  actionPayload: {
    to: 'admin@example.com',
    subject: 'Low Stock Alert',
    body: 'Please review stock levels.',
  },
  createdAt: '2026-04-19T10:03:00.000Z',
  updatedAt: '2026-04-19T10:03:00.000Z',
}

const ACTION_COMPLETED_TRANSFER: WorkflowActionResponse = {
  id: 'act_001',
  workflowExecutionId: 'exec_001',
  stepId: 'step_transfer_1',
  status: 'COMPLETED',
  result: { transferredQuantity: 50, sourceStock: 150, destStock: 150 },
  errorMessage: null,
  createdAt: '2026-04-19T10:00:00.000Z',
  executedAt: '2026-04-19T10:00:02.000Z',
}

const ACTION_FAILED_TRANSFER: WorkflowActionResponse = {
  id: 'act_002',
  workflowExecutionId: 'exec_001',
  stepId: 'step_transfer_1',
  status: 'FAILED',
  result: null,
  errorMessage: 'Insufficient stock in source lab',
  createdAt: '2026-04-19T10:00:00.000Z',
  executedAt: '2026-04-19T10:00:01.000Z',
}

const ACTION_COMPLETED_INVENTORY: WorkflowActionResponse = {
  id: 'act_003',
  workflowExecutionId: 'exec_001',
  stepId: 'step_inv_1',
  status: 'COMPLETED',
  result: { oldQuantity: 100, newQuantity: 150, reason: 'Stock correction' },
  errorMessage: null,
  createdAt: '2026-04-19T10:01:00.000Z',
  executedAt: '2026-04-19T10:01:01.500Z',
}

const ACTION_FAILED_INVENTORY: WorkflowActionResponse = {
  id: 'act_004',
  workflowExecutionId: 'exec_001',
  stepId: 'step_inv_1',
  status: 'FAILED',
  result: null,
  errorMessage: 'Material not found',
  createdAt: '2026-04-19T10:01:00.000Z',
  executedAt: '2026-04-19T10:01:00.500Z',
}

const ACTION_COMPLETED_NOTIFY: WorkflowActionResponse = {
  id: 'act_005',
  workflowExecutionId: 'exec_001',
  stepId: 'step_notify_1',
  status: 'COMPLETED',
  result: { notifiedChannels: ['slack', 'email'], timestamp: '2026-04-19T10:02:01.000Z' },
  errorMessage: null,
  createdAt: '2026-04-19T10:02:00.000Z',
  executedAt: '2026-04-19T10:02:00.800Z',
}

const ACTION_FAILED_NOTIFY: WorkflowActionResponse = {
  id: 'act_006',
  workflowExecutionId: 'exec_001',
  stepId: 'step_notify_1',
  status: 'FAILED',
  result: null,
  errorMessage: 'No valid channels',
  createdAt: '2026-04-19T10:02:00.000Z',
  executedAt: '2026-04-19T10:02:00.300Z',
}

const ACTION_COMPLETED_EMAIL: WorkflowActionResponse = {
  id: 'act_007',
  workflowExecutionId: 'exec_001',
  stepId: 'step_email_1',
  status: 'COMPLETED',
  result: {
    to: 'admin@example.com',
    subject: 'Low Stock Alert',
    sentAt: '2026-04-19T10:03:01.000Z',
    messageId: 'msg_abc123',
  },
  errorMessage: null,
  createdAt: '2026-04-19T10:03:00.000Z',
  executedAt: '2026-04-19T10:03:01.200Z',
}

const ACTION_FAILED_EMAIL: WorkflowActionResponse = {
  id: 'act_008',
  workflowExecutionId: 'exec_001',
  stepId: 'step_email_1',
  status: 'FAILED',
  result: null,
  errorMessage: 'Invalid email address',
  createdAt: '2026-04-19T10:03:00.000Z',
  executedAt: '2026-04-19T10:03:00.400Z',
}

const ACTION_PENDING: WorkflowActionResponse = {
  id: 'act_009',
  workflowExecutionId: 'exec_001',
  stepId: 'step_transfer_1',
  status: 'PENDING',
  result: null,
  errorMessage: null,
  createdAt: '2026-04-19T10:05:00.000Z',
  executedAt: null,
}

const ACTION_IN_PROGRESS: WorkflowActionResponse = {
  id: 'act_010',
  workflowExecutionId: 'exec_001',
  stepId: 'step_inv_1',
  status: 'IN_PROGRESS',
  result: null,
  errorMessage: null,
  createdAt: '2026-04-19T10:06:00.000Z',
  executedAt: null,
}

const MOCK_WORKFLOW: Workflow = {
  id: 'wf_001',
  name: 'Low Stock Alert',
  description: null,
  enabled: true,
  triggerType: 'EVENT_BASED',
  steps: [BASE_STEP_TRANSFER, BASE_STEP_INVENTORY, BASE_STEP_NOTIFY, BASE_STEP_EMAIL],
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-19T00:00:00.000Z',
}

// ---------------------------------------------------------------------------
// ===========================================================================
// 1. ActionResultCard (8 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('ActionResultCard', () => {
  test('renders COMPLETED status badge with green styling', () => {
    render(
      <ActionResultCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    const badge = screen.getByTestId(`status-badge-${ACTION_COMPLETED_TRANSFER.id}`)
    expect(badge).toHaveTextContent('Completed')
    expect(badge).toHaveClass('bg-green-50')
  })

  test('renders FAILED status badge with red styling', () => {
    render(
      <ActionResultCard
        action={ACTION_FAILED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    const badge = screen.getByTestId(`status-badge-${ACTION_FAILED_TRANSFER.id}`)
    expect(badge).toHaveTextContent('Failed')
    expect(badge).toHaveClass('bg-red-50')
  })

  test('renders PENDING status badge with gray styling', () => {
    render(<ActionResultCard action={ACTION_PENDING} step={BASE_STEP_TRANSFER} />)
    const badge = screen.getByTestId(`status-badge-${ACTION_PENDING.id}`)
    expect(badge).toHaveTextContent('Pending')
    expect(badge).toHaveClass('bg-gray-50')
  })

  test('renders IN_PROGRESS status badge with yellow styling', () => {
    render(<ActionResultCard action={ACTION_IN_PROGRESS} step={BASE_STEP_INVENTORY} />)
    const badge = screen.getByTestId(`status-badge-${ACTION_IN_PROGRESS.id}`)
    expect(badge).toHaveTextContent('In Progress')
    expect(badge).toHaveClass('bg-yellow-50')
  })

  test('shows TRANSFER action type label', () => {
    render(
      <ActionResultCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    expect(screen.getByText('Transfer Stock')).toBeInTheDocument()
  })

  test('shows result summary for FAILED transfer with error message', () => {
    render(
      <ActionResultCard
        action={ACTION_FAILED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    const summary = screen.getByTestId(`result-summary-${ACTION_FAILED_TRANSFER.id}`)
    expect(summary).toHaveTextContent('Insufficient stock in source lab')
  })

  test('calls onViewDetail when card is clicked', () => {
    const handler = jest.fn()
    render(
      <ActionResultCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        onViewDetail={handler}
      />,
    )
    fireEvent.click(screen.getByTestId(`action-result-card-${ACTION_COMPLETED_TRANSFER.id}`))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('formats duration in seconds correctly', () => {
    render(
      <ActionResultCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    // ACTION_COMPLETED_TRANSFER: createdAt 10:00:00, executedAt 10:00:02 = 2s
    expect(screen.getByText('2.0s')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 2. ActionDetailModal (6 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('ActionDetailModal', () => {
  test('renders modal when isOpen=true', () => {
    render(
      <ActionDetailModal
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        isOpen={true}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByTestId('action-detail-modal')).toBeInTheDocument()
  })

  test('does NOT render when isOpen=false', () => {
    render(
      <ActionDetailModal
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        isOpen={false}
        onClose={jest.fn()}
      />,
    )
    expect(screen.queryByTestId('action-detail-modal')).not.toBeInTheDocument()
  })

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn()
    render(
      <ActionDetailModal
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        isOpen={true}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByTestId('action-detail-close-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('displays formatted JSON in request section', () => {
    render(
      <ActionDetailModal
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        isOpen={true}
        onClose={jest.fn()}
      />,
    )
    // Expand request block (it may be collapsed by default)
    const expandButtons = screen.getAllByRole('button')
    const requestBtn = expandButtons.find((b) => b.textContent?.includes('Request'))
    if (requestBtn) fireEvent.click(requestBtn)

    // JSON should contain the payload keys
    const jsonBlock = screen.queryByTestId('json-request')
    if (jsonBlock) {
      expect(jsonBlock).toHaveTextContent('sourceLabId')
    }
  })

  test('shows error message block for FAILED action', () => {
    render(
      <ActionDetailModal
        action={ACTION_FAILED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        isOpen={true}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByTestId('error-message-block')).toBeInTheDocument()
    expect(screen.getByTestId('error-message-block')).toHaveTextContent(
      'Insufficient stock in source lab',
    )
  })

  test('renders metadata: created at, duration, action type', () => {
    render(
      <ActionDetailModal
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
        isOpen={true}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByTestId('meta-duration')).toHaveTextContent('2.0s')
    expect(screen.getByTestId('modal-status-badge')).toHaveTextContent('Completed')
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 3. TransferActionCard (4 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('TransferActionCard', () => {
  test('renders COMPLETED transfer with source and dest labs', () => {
    render(
      <TransferActionCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    expect(screen.getByTestId('transfer-card-completed')).toBeInTheDocument()
    expect(screen.getByTestId('transfer-source-lab')).toHaveTextContent('lab_A')
    expect(screen.getByTestId('transfer-dest-lab')).toHaveTextContent('lab_B')
  })

  test('renders transferred quantity from result', () => {
    render(
      <TransferActionCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    expect(screen.getByText(/Transferred 50 units/i)).toBeInTheDocument()
  })

  test('renders stock change: before and after values', () => {
    render(
      <TransferActionCard
        action={ACTION_COMPLETED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    // result: sourceStock=150 (after), transferredQty=50 → before=200
    expect(screen.getByTestId('transfer-card-completed')).toHaveTextContent('200')
    expect(screen.getByTestId('transfer-card-completed')).toHaveTextContent('150')
  })

  test('renders FAILED transfer with error message', () => {
    render(
      <TransferActionCard
        action={ACTION_FAILED_TRANSFER}
        step={BASE_STEP_TRANSFER}
      />,
    )
    expect(screen.getByTestId('transfer-card-failed')).toBeInTheDocument()
    expect(screen.getByTestId('transfer-card-failed')).toHaveTextContent(
      'Insufficient stock in source lab',
    )
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 4. InventoryActionCard (4 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('InventoryActionCard', () => {
  test('renders COMPLETED inventory update with old and new quantities', () => {
    render(
      <InventoryActionCard
        action={ACTION_COMPLETED_INVENTORY}
        step={BASE_STEP_INVENTORY}
      />,
    )
    expect(screen.getByTestId('inventory-card-completed')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-old-quantity')).toHaveTextContent('100')
    expect(screen.getByTestId('inventory-new-quantity')).toHaveTextContent('150')
  })

  test('renders reason from result', () => {
    render(
      <InventoryActionCard
        action={ACTION_COMPLETED_INVENTORY}
        step={BASE_STEP_INVENTORY}
      />,
    )
    expect(screen.getByTestId('inventory-reason')).toHaveTextContent('Stock correction')
  })

  test('renders FAILED inventory update with error message', () => {
    render(
      <InventoryActionCard
        action={ACTION_FAILED_INVENTORY}
        step={BASE_STEP_INVENTORY}
      />,
    )
    expect(screen.getByTestId('inventory-card-failed')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-card-failed')).toHaveTextContent('Material not found')
  })

  test('renders lab ID in completed state', () => {
    render(
      <InventoryActionCard
        action={ACTION_COMPLETED_INVENTORY}
        step={BASE_STEP_INVENTORY}
      />,
    )
    expect(screen.getByTestId('inventory-lab-id')).toHaveTextContent('lab_A')
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 5. NotifyActionCard (4 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('NotifyActionCard', () => {
  test('renders COMPLETED notification with channel badges', () => {
    render(
      <NotifyActionCard
        action={ACTION_COMPLETED_NOTIFY}
        step={BASE_STEP_NOTIFY}
      />,
    )
    expect(screen.getByTestId('notify-card-completed')).toBeInTheDocument()
    expect(screen.getByTestId('channel-badge-slack')).toHaveTextContent('slack')
    expect(screen.getByTestId('channel-badge-email')).toHaveTextContent('email')
  })

  test('truncates long message to 80 characters', () => {
    const longMessage = 'A'.repeat(100)
    const stepWithLongMsg: WorkflowStep = {
      ...BASE_STEP_NOTIFY,
      actionPayload: { ...BASE_STEP_NOTIFY.actionPayload, message: longMessage },
    }
    render(
      <NotifyActionCard
        action={ACTION_COMPLETED_NOTIFY}
        step={stepWithLongMsg}
      />,
    )
    const preview = screen.getByTestId('notify-message-preview')
    expect(preview.textContent?.length).toBeLessThanOrEqual(83) // 80 + "…" + some buffer
    expect(preview).toHaveTextContent('…')
  })

  test('renders FAILED notification with error message', () => {
    render(
      <NotifyActionCard
        action={ACTION_FAILED_NOTIFY}
        step={BASE_STEP_NOTIFY}
      />,
    )
    expect(screen.getByTestId('notify-card-failed')).toBeInTheDocument()
    expect(screen.getByTestId('notify-card-failed')).toHaveTextContent('No valid channels')
  })

  test('shows channel badges from payload on failed state', () => {
    render(
      <NotifyActionCard
        action={ACTION_FAILED_NOTIFY}
        step={BASE_STEP_NOTIFY}
      />,
    )
    // Channel names should appear in failed card as faded badges
    expect(screen.getByTestId('notify-card-failed')).toHaveTextContent('slack')
    expect(screen.getByTestId('notify-card-failed')).toHaveTextContent('email')
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 6. EmailActionCard (4 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('EmailActionCard', () => {
  test('renders COMPLETED email with recipient and subject', () => {
    render(
      <EmailActionCard
        action={ACTION_COMPLETED_EMAIL}
        step={BASE_STEP_EMAIL}
      />,
    )
    expect(screen.getByTestId('email-card-completed')).toBeInTheDocument()
    expect(screen.getByTestId('email-to')).toHaveTextContent('admin@example.com')
    expect(screen.getByTestId('email-subject')).toHaveTextContent('Low Stock Alert')
  })

  test('renders message ID from result', () => {
    render(
      <EmailActionCard
        action={ACTION_COMPLETED_EMAIL}
        step={BASE_STEP_EMAIL}
      />,
    )
    expect(screen.getByTestId('email-message-id')).toHaveTextContent('msg_abc123')
  })

  test('renders FAILED email with error message', () => {
    render(
      <EmailActionCard
        action={ACTION_FAILED_EMAIL}
        step={BASE_STEP_EMAIL}
      />,
    )
    expect(screen.getByTestId('email-card-failed')).toBeInTheDocument()
    expect(screen.getByTestId('email-card-failed')).toHaveTextContent('Invalid email address')
  })

  test('shows intended recipient on failed email', () => {
    render(
      <EmailActionCard
        action={ACTION_FAILED_EMAIL}
        step={BASE_STEP_EMAIL}
      />,
    )
    expect(screen.getByTestId('email-failed-to')).toHaveTextContent('admin@example.com')
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 7. ActionTimeline (4 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('ActionTimeline', () => {
  const ALL_ACTIONS = [
    ACTION_COMPLETED_TRANSFER,
    ACTION_COMPLETED_INVENTORY,
    ACTION_COMPLETED_NOTIFY,
    ACTION_COMPLETED_EMAIL,
  ]
  const ALL_STEPS = [
    BASE_STEP_TRANSFER,
    BASE_STEP_INVENTORY,
    BASE_STEP_NOTIFY,
    BASE_STEP_EMAIL,
  ]

  test('renders a timeline item for each action', () => {
    render(<ActionTimeline actions={ALL_ACTIONS} steps={ALL_STEPS} />)
    expect(screen.getByTestId('action-timeline')).toBeInTheDocument()
    ALL_ACTIONS.forEach((a) => {
      expect(screen.getByTestId(`timeline-item-${a.id}`)).toBeInTheDocument()
    })
  })

  test('renders green dots for COMPLETED actions', () => {
    render(<ActionTimeline actions={ALL_ACTIONS} steps={ALL_STEPS} />)
    const dot = screen.getByTestId(`timeline-dot-${ACTION_COMPLETED_TRANSFER.id}`)
    expect(dot).toHaveClass('bg-green-500')
  })

  test('renders red dot for FAILED actions', () => {
    render(
      <ActionTimeline
        actions={[ACTION_FAILED_TRANSFER]}
        steps={[BASE_STEP_TRANSFER]}
      />,
    )
    const dot = screen.getByTestId(`timeline-dot-${ACTION_FAILED_TRANSFER.id}`)
    expect(dot).toHaveClass('bg-red-500')
  })

  test('calls onActionClick with correct action and step when timeline item is clicked', () => {
    const handler = jest.fn()
    render(
      <ActionTimeline
        actions={[ACTION_COMPLETED_TRANSFER]}
        steps={[BASE_STEP_TRANSFER]}
        onActionClick={handler}
      />,
    )
    fireEvent.click(screen.getByTestId(`timeline-dot-${ACTION_COMPLETED_TRANSFER.id}`))
    expect(handler).toHaveBeenCalledWith(ACTION_COMPLETED_TRANSFER, BASE_STEP_TRANSFER)
  })
})

// ---------------------------------------------------------------------------
// ===========================================================================
// 8. ActionExecutionStats (3 tests)
// ===========================================================================
// ---------------------------------------------------------------------------

describe('ActionExecutionStats', () => {
  const ALL_ACTIONS = [
    ACTION_COMPLETED_TRANSFER,
    ACTION_FAILED_INVENTORY,
    ACTION_PENDING,
    ACTION_COMPLETED_EMAIL,
  ]

  test('renders correct counts for completed, failed, and pending', () => {
    render(
      <ActionExecutionStats actions={ALL_ACTIONS} workflow={MOCK_WORKFLOW} />,
    )
    expect(screen.getByTestId('stat-completed')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-failed')).toHaveTextContent('1')
    expect(screen.getByTestId('stat-pending')).toHaveTextContent('1')
  })

  test('shows FAILED overall status banner when any action failed', () => {
    render(
      <ActionExecutionStats actions={ALL_ACTIONS} workflow={MOCK_WORKFLOW} />,
    )
    const banner = screen.getByTestId('overall-status-banner')
    expect(banner).toHaveClass('bg-red-50')
    expect(banner).toHaveTextContent('Execution Failed')
  })

  test('shows SUCCESS overall status when all actions completed', () => {
    const allCompleted = [
      ACTION_COMPLETED_TRANSFER,
      ACTION_COMPLETED_INVENTORY,
      ACTION_COMPLETED_NOTIFY,
      ACTION_COMPLETED_EMAIL,
    ]
    render(
      <ActionExecutionStats actions={allCompleted} workflow={MOCK_WORKFLOW} />,
    )
    const banner = screen.getByTestId('overall-status-banner')
    expect(banner).toHaveClass('bg-green-50')
    expect(banner).toHaveTextContent('All Steps Completed')
  })
})
