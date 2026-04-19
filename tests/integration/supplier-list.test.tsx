/**
 * @jest-environment jsdom
 *
 * tests/integration/supplier-list.test.tsx
 *
 * Integration tests for the Supplier List page.
 * Covers: column rendering, API data display, add-supplier button,
 * status filter, and row-click navigation.
 */

// ---------------------------------------------------------------------------
// Module mocks — must come before any import
// ---------------------------------------------------------------------------

// Shared push mock so both the component and test assertions reference the
// same jest.fn() instance across calls to useRouter().
const mockRouterPush = jest.fn()
const mockRouterRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
  }),
}))

jest.mock('next/link', () => {
  const React = require('react')
  return function MockLink({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }
})

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import SupplierListPage from '@/app/(admin)/supplier/suppliers/page'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSuppliers = [
  {
    id: 'sup-1',
    name: 'Premier Foods',
    email: 'contact@premier.com',
    status: 'ACTIVE',
    reliabilityScore: 92,
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchWithSuppliers() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { suppliers: mockSuppliers } }),
  } as Response)
}

function mockFetchEmpty() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { suppliers: [] } }),
  } as Response)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupplierListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (!global.fetch) {
      global.fetch = jest.fn()
    }
  })

  // -------------------------------------------------------------------------
  // 1. Renders page heading and Supplier Name column header
  // -------------------------------------------------------------------------
  it('renders supplier table with columns', async () => {
    mockFetchWithSuppliers()
    render(<SupplierListPage />)

    // The h1 heading should say "Suppliers"
    expect(
      screen.getByRole('heading', { name: /suppliers/i }),
    ).toBeInTheDocument()

    // Column header appears once data loads
    await waitFor(() => {
      expect(screen.getByText(/supplier name/i)).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // 2. Displays supplier list from API
  // -------------------------------------------------------------------------
  it('displays supplier list from API', async () => {
    mockFetchWithSuppliers()

    render(<SupplierListPage />)
    await screen.findByText('Premier Foods')
    expect(screen.getByText('contact@premier.com')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 3. Has button to add new supplier
  // -------------------------------------------------------------------------
  it('has button to add new supplier', async () => {
    mockFetchEmpty()
    render(<SupplierListPage />)
    expect(
      screen.getByRole('button', { name: /add supplier/i }),
    ).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // 4. Filters suppliers by status
  // -------------------------------------------------------------------------
  it('filters suppliers by status', async () => {
    const user = userEvent.setup()
    mockFetchEmpty()

    render(<SupplierListPage />)

    const statusFilter = screen.getByRole('combobox', { name: /status/i })
    await user.selectOptions(statusFilter, 'ACTIVE')
    expect(statusFilter).toHaveValue('ACTIVE')
  })

  // -------------------------------------------------------------------------
  // 5. Opens supplier detail on row click
  // -------------------------------------------------------------------------
  it('opens supplier detail on row click', async () => {
    const user = userEvent.setup()
    mockFetchWithSuppliers()

    render(<SupplierListPage />)
    await screen.findByText('Premier Foods')

    const supplierRow = screen.getByText('Premier Foods').closest('tr')
    if (supplierRow) {
      await user.click(supplierRow)
    }

    // mockRouterPush is the shared instance used by the component
    expect(mockRouterPush).toHaveBeenCalledWith('/supplier/suppliers/sup-1')
  })
})
