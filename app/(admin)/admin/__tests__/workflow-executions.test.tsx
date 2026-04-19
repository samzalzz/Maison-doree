/**
 * @jest-environment jsdom
 *
 * app/(admin)/admin/__tests__/workflow-executions.test.tsx
 *
 * UI tests for the Workflow Execution History page
 * (app/(admin)/admin/workflows/[id]/executions/page.tsx).
 *
 * Strategy:
 *  - fetch is mocked via jest.spyOn.
 *  - next/navigation and next/link are mocked.
 *  - Tests cover: rendering, workflow info card, execution table,
 *    status badges, detail modal open/close, pagination, error/empty states.
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'wf_exec_001' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/workflows/wf_exec_001/executions',
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
import WorkflowExecutionsPage from '../workflows/[id]/executions/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKFLOW_INFO = {
  id: 'wf_exec_001',
  name: 'Low Stock Alert',
  enabled: true,
  triggerType: 'EVENT_BASED',
  updatedAt: '2026-04-15T10:00:00.000Z',
}

const EXEC_1 = {
  id: 'exec_001',
  workflowId: 'wf_exec_001',
  status: 'completed' as const,
  errorMessage: null,
  triggerData: { event: 'low_stock', materialId: 'mat_001' },
  results: { transferred: 50, success: true },
  startedAt: '2026-04-15T09:00:00.000Z',
  completedAt: '2026-04-15T09:00:05.000Z',
}

const EXEC_2 = {
  id: 'exec_002',
  workflowId: 'wf_exec_001',
  status: 'failed' as const,
  errorMessage: 'Insufficient stock in source lab',
  triggerData: { event: 'low_stock' },
  results: null,
  startedAt: '2026-04-14T08:00:00.000Z',
  completedAt: '2026-04-14T08:00:02.000Z',
}

const EXEC_3 = {
  id: 'exec_003',
  workflowId: 'wf_exec_001',
  status: 'pending' as const,
  errorMessage: null,
  triggerData: {},
  results: null,
  startedAt: '2026-04-16T10:00:00.000Z',
  completedAt: null,
}

const EXEC_4 = {
  id: 'exec_004',
  workflowId: 'wf_exec_001',
  status: 'running' as const,
  errorMessage: null,
  triggerData: {},
  results: null,
  startedAt: '2026-04-17T12:00:00.000Z',
  completedAt: null,
}

const MOCK_EXECUTIONS = [EXEC_1, EXEC_2, EXEC_3, EXEC_4]

function makeWorkflowResponse() {
  return { success: true, data: WORKFLOW_INFO }
}

function makeExecutionsResponse(executions = MOCK_EXECUTIONS, total = MOCK_EXECUTIONS.length) {
  return {
    success: true,
    data: executions,
    pagination: { skip: 0, take: 20, total, hasMore: false },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSequence(responses: Array<{ data: unknown; status?: number }>) {
  const spy = jest.spyOn(global, 'fetch')
  responses.forEach(({ data, status = 200 }) => {
    spy.mockResolvedValueOnce({
      ok: status < 400,
      status,
      json: async () => data,
    } as Response)
  })
  return spy
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowExecutionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Ensure global.fetch exists for jest.spyOn in jsdom environment
    if (!global.fetch) {
      global.fetch = jest.fn()
    }
  })

  // -------------------------------------------------------------------------
  // 1. Page renders heading
  // -------------------------------------------------------------------------
  it('renders the Execution History heading', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => {
      expect(screen.getByText('Execution History')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 2. Shows loading state initially
  // -------------------------------------------------------------------------
  it('shows loading spinner during initial fetch', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => undefined))
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    expect(screen.getByTestId('executions-loading')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 3. Renders workflow info card
  // -------------------------------------------------------------------------
  it('renders workflow info card with name and trigger', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => {
      expect(screen.getByTestId('workflow-info-card')).toBeInTheDocument()
    })
    expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 4. Renders executions table
  // -------------------------------------------------------------------------
  it('renders execution table rows after loading', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => {
      expect(screen.getByTestId('executions-table')).toBeInTheDocument()
    })
    expect(screen.getByTestId(`execution-row-${EXEC_1.id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`execution-row-${EXEC_2.id}`)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 5. Status badges render correct colors
  // -------------------------------------------------------------------------
  it('renders color-coded status badges for different statuses', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => screen.getByTestId('executions-table'))
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 6. Empty state when no executions
  // -------------------------------------------------------------------------
  it('shows empty state when no executions exist', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse([], 0) },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => {
      expect(screen.getByTestId('executions-empty')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 7. Error state when API fails
  // -------------------------------------------------------------------------
  it('shows error banner when executions fetch fails', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } }, status: 500 },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => {
      expect(screen.getByTestId('executions-error')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 8. View Detail button opens detail modal
  // -------------------------------------------------------------------------
  it('opens detail modal when View Detail is clicked', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => screen.getByTestId(`view-detail-btn-${EXEC_1.id}`))
    fireEvent.click(screen.getByTestId(`view-detail-btn-${EXEC_1.id}`))
    expect(screen.getByTestId('detail-modal')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 9. Detail modal shows result JSON
  // -------------------------------------------------------------------------
  it('shows execution results JSON in detail modal', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => screen.getByTestId(`view-detail-btn-${EXEC_1.id}`))
    fireEvent.click(screen.getByTestId(`view-detail-btn-${EXEC_1.id}`))
    await waitFor(() => {
      expect(screen.getByTestId('execution-results')).toBeInTheDocument()
    })
    expect(screen.getByTestId('execution-results').textContent).toContain('transferred')
  })

  // -------------------------------------------------------------------------
  // 10. Detail modal closes on close button
  // -------------------------------------------------------------------------
  it('closes detail modal when close button is clicked', async () => {
    mockFetchSequence([
      { data: makeWorkflowResponse() },
      { data: makeExecutionsResponse() },
    ])
    render(<WorkflowExecutionsPage params={{ id: 'wf_exec_001' }} />)
    await waitFor(() => screen.getByTestId(`view-detail-btn-${EXEC_1.id}`))
    fireEvent.click(screen.getByTestId(`view-detail-btn-${EXEC_1.id}`))
    expect(screen.getByTestId('detail-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('detail-close-btn'))
    await waitFor(() => {
      expect(screen.queryByTestId('detail-modal')).not.toBeInTheDocument()
    })
  })
})
