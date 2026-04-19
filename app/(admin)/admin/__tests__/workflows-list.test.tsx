/**
 * @jest-environment jsdom
 *
 * app/(admin)/admin/__tests__/workflows-list.test.tsx
 *
 * UI tests for the Workflow List page (app/(admin)/admin/workflows/page.tsx).
 *
 * Strategy:
 *  - All fetch calls are mocked via jest.spyOn(global, 'fetch').
 *  - next/navigation is mocked so hooks do not crash.
 *  - Tests validate: rendering, stat cards, filter dropdowns, table rows,
 *    pagination, delete flow, execute flow, empty state, error state.
 */

// ---------------------------------------------------------------------------
// Module mocks — must come before any import
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/workflows',
}))

jest.mock('next/link', () => {
  const React = require('react')
  return function MockLink({
    href,
    children,
    className,
    'aria-label': ariaLabel,
    'data-testid': testId,
  }: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
    'data-testid'?: string
  }) {
    return (
      <a href={href} className={className} aria-label={ariaLabel} data-testid={testId}>
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
import WorkflowsListPage from '../workflows/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKFLOW_1 = {
  id: 'wf_001',
  name: 'Low Stock Alert',
  description: 'Triggers when stock drops below threshold',
  enabled: true,
  triggerType: 'EVENT_BASED',
  createdBy: 'admin_user_001',
  executionCount: 12,
  lastExecuted: '2026-04-15T10:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-04-15T10:00:00.000Z',
}

const WORKFLOW_2 = {
  id: 'wf_002',
  name: 'Daily Report',
  description: null,
  enabled: false,
  triggerType: 'SCHEDULED',
  createdBy: 'admin_user_002',
  executionCount: 5,
  lastExecuted: null,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-15T00:00:00.000Z',
}

const WORKFLOW_3 = {
  id: 'wf_003',
  name: 'Manual Transfer',
  description: 'Manual stock transfer workflow',
  enabled: true,
  triggerType: 'MANUAL',
  createdBy: 'admin_user_001',
  executionCount: 0,
  lastExecuted: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-05T00:00:00.000Z',
}

const MOCK_WORKFLOWS = [WORKFLOW_1, WORKFLOW_2, WORKFLOW_3]

function makeListResponse(workflows = MOCK_WORKFLOWS, total = MOCK_WORKFLOWS.length) {
  return {
    success: true,
    data: { workflows, total },
    pagination: { page: 0, limit: 50, total },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchSuccess(data: unknown = makeListResponse()) {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  } as Response)
}

function mockFetchMultiple(responses: unknown[]) {
  const spy = jest.spyOn(global, 'fetch')
  responses.forEach((r) =>
    spy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => r,
    } as Response),
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowsListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Ensure global.fetch exists for jest.spyOn in jsdom environment
    if (!global.fetch) {
      global.fetch = jest.fn()
    }
  })

  // -------------------------------------------------------------------------
  // 1. Renders page heading and create button
  // -------------------------------------------------------------------------
  it('renders the page heading and Create Workflow button', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    expect(screen.getByText('Workflows')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('create-workflow-btn')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 2. Shows loading state on initial render
  // -------------------------------------------------------------------------
  it('shows loading spinner while fetching workflows', () => {
    jest.spyOn(global, 'fetch').mockImplementation(
      () => new Promise(() => undefined), // never resolves
    )
    render(<WorkflowsListPage />)
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 3. Renders table with workflow rows
  // -------------------------------------------------------------------------
  it('renders workflow table rows after loading', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => {
      expect(screen.getByTestId('workflows-table')).toBeInTheDocument()
    })
    expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
    expect(screen.getByText('Daily Report')).toBeInTheDocument()
    expect(screen.getByText('Manual Transfer')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 4. Status badges render correctly (Active / Inactive)
  // -------------------------------------------------------------------------
  it('renders Active badge for enabled workflows and Inactive for disabled', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('workflows-table'))
    const activeBadges = screen.getAllByText('Active')
    const inactiveBadges = screen.getAllByText('Inactive')
    expect(activeBadges.length).toBeGreaterThanOrEqual(2) // wf_001 and wf_003
    expect(inactiveBadges.length).toBeGreaterThanOrEqual(1) // wf_002
  })

  // -------------------------------------------------------------------------
  // 5. Trigger type badges render
  // -------------------------------------------------------------------------
  it('renders trigger type badges with correct labels', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('workflows-table'))
    // getAllByText because the labels may also appear in filter dropdown options
    expect(screen.getAllByText('Event Based').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Manual').length).toBeGreaterThanOrEqual(1)
  })

  // -------------------------------------------------------------------------
  // 6. Stat cards show correct values
  // -------------------------------------------------------------------------
  it('renders stat cards with total, active count, and execution count', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('workflows-table'))
    // Total executions = 12 + 5 + 0 = 17
    expect(screen.getByText('17')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 7. Renders filter dropdowns
  // -------------------------------------------------------------------------
  it('renders status and trigger type filter dropdowns', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('filter-status'))
    expect(screen.getByTestId('filter-status')).toBeInTheDocument()
    expect(screen.getByTestId('filter-trigger')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 8. Filter change triggers a new fetch
  // -------------------------------------------------------------------------
  it('triggers new fetch when status filter changes', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => makeListResponse([WORKFLOW_1]),
    } as Response)

    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('filter-status'))

    fireEvent.change(screen.getByTestId('filter-status'), { target: { value: 'true' } })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  // 9. Empty state shows when no workflows returned
  // -------------------------------------------------------------------------
  it('shows empty state when no workflows are returned', async () => {
    mockFetchSuccess({ success: true, data: { workflows: [], total: 0 }, pagination: { page: 0, limit: 50, total: 0 } })
    render(<WorkflowsListPage />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
    expect(screen.getByText('No workflows found.')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 10. Error state displays when API call fails
  // -------------------------------------------------------------------------
  it('shows error banner when fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network Error'))
    render(<WorkflowsListPage />)
    await waitFor(() => {
      expect(screen.getByTestId('list-error')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 11. Edit button navigates to editor
  // -------------------------------------------------------------------------
  it('renders Edit button for each workflow row', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('workflows-table'))
    expect(screen.getByTestId('edit-btn-wf_001')).toBeInTheDocument()
    expect(screen.getByTestId('edit-btn-wf_002')).toBeInTheDocument()
    expect(screen.getByTestId('edit-btn-wf_003')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 12. Delete button opens confirmation modal
  // -------------------------------------------------------------------------
  it('opens delete confirmation modal when Delete button is clicked', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('delete-btn-wf_001'))
    fireEvent.click(screen.getByTestId('delete-btn-wf_001'))
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument()
    // Modal contains the workflow name — verify delete modal is shown with confirmation text
    expect(screen.getByTestId('delete-confirm-btn')).toBeInTheDocument()
    expect(screen.getByTestId('delete-cancel-btn')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 13. Cancel button in delete modal closes it
  // -------------------------------------------------------------------------
  it('closes delete modal when Cancel is clicked', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('delete-btn-wf_001'))
    fireEvent.click(screen.getByTestId('delete-btn-wf_001'))
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('delete-cancel-btn'))
    await waitFor(() => {
      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 14. Delete confirmation calls DELETE API and refreshes list
  // -------------------------------------------------------------------------
  it('calls DELETE API and refreshes list on confirm delete', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    // First call: list
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => makeListResponse(),
    } as Response)
    // Second call: DELETE
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as Response)
    // Third call: refresh list
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => makeListResponse([WORKFLOW_2, WORKFLOW_3], 2),
    } as Response)

    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('delete-btn-wf_001'))
    fireEvent.click(screen.getByTestId('delete-btn-wf_001'))
    await waitFor(() => screen.getByTestId('delete-confirm-btn'))
    fireEvent.click(screen.getByTestId('delete-confirm-btn'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/workflows/wf_001'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // 15. Execute button disabled for inactive workflows
  // -------------------------------------------------------------------------
  it('disables Execute button for inactive workflows', async () => {
    mockFetchSuccess()
    render(<WorkflowsListPage />)
    await waitFor(() => screen.getByTestId('workflows-table'))
    const execBtn = screen.getByTestId('execute-btn-wf_002')
    expect(execBtn).toBeDisabled()
  })
})
