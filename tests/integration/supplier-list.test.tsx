/**
 * @jest-environment jsdom
 *
 * tests/integration/supplier-list.test.tsx
 *
 * Integration tests for the Supplier List page.
 * Covers: column rendering, API data display, add-supplier button,
 * status filter, row-click navigation, search, status badge colors,
 * reliability score colors, and View Details link.
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

// Extended fixture used for multi-supplier color tests
const mockSuppliersMulti = [
  {
    id: 'sup-1',
    name: 'Premier Foods',
    email: 'contact@premier.com',
    status: 'ACTIVE',
    reliabilityScore: 92,
  },
  {
    id: 'sup-2',
    name: 'Metro Supply',
    email: 'info@metro.com',
    status: 'INACTIVE',
    reliabilityScore: 75,
  },
  {
    id: 'sup-3',
    name: 'Delta Goods',
    email: 'hello@delta.com',
    status: 'SUSPENDED',
    reliabilityScore: 60,
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

function mockFetchWithMultiSuppliers() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: { suppliers: mockSuppliersMulti },
    }),
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
  // 3. Has button to add new supplier — verifies router.push is called
  // -------------------------------------------------------------------------
  it('has button to add new supplier', async () => {
    const user = userEvent.setup()
    mockFetchEmpty()
    render(<SupplierListPage />)

    const addButton = screen.getByRole('button', { name: /add supplier/i })
    expect(addButton).toBeInTheDocument()

    await user.click(addButton)

    expect(mockRouterPush).toHaveBeenCalledWith('/supplier/suppliers/new')
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

  // -------------------------------------------------------------------------
  // 6. Searches suppliers by name or email (Req 4)
  // -------------------------------------------------------------------------
  it('searches suppliers by name or email', async () => {
    const user = userEvent.setup()
    // Initial load returns data; subsequent search call also resolves normally
    mockFetchWithSuppliers()

    render(<SupplierListPage />)

    // Wait for the component to finish the initial fetch so the input is ready
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const searchInput = screen.getByPlaceholderText(
      /search by name or email/i,
    )

    await user.type(searchInput, 'Premier')

    // The input value must reflect what was typed
    expect(searchInput).toHaveValue('Premier')

    // The component appends ?search=Premier to the API URL when searchTerm is set
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls.map(
        ([url]: [string]) => url,
      )
      expect(calls.some((url) => url.includes('search=Premier'))).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 7. Displays status badge with correct color (Req 7)
  // -------------------------------------------------------------------------
  it('displays status badge with correct color', async () => {
    mockFetchWithMultiSuppliers()
    render(<SupplierListPage />)

    // Wait for the table rows to appear
    await screen.findByText('Premier Foods')

    // ACTIVE — badge text is the status value itself
    const activeBadge = screen.getByText('ACTIVE')
    expect(activeBadge).toHaveClass('bg-green-100', 'text-green-800')

    // INACTIVE
    const inactiveBadge = screen.getByText('INACTIVE')
    expect(inactiveBadge).toHaveClass('bg-gray-100', 'text-gray-800')

    // SUSPENDED
    const suspendedBadge = screen.getByText('SUSPENDED')
    expect(suspendedBadge).toHaveClass('bg-red-100', 'text-red-800')
  })

  // -------------------------------------------------------------------------
  // 8. Displays reliability score with correct color (Req 8)
  // -------------------------------------------------------------------------
  it('displays reliability score with correct color', async () => {
    mockFetchWithMultiSuppliers()
    render(<SupplierListPage />)

    await screen.findByText('Premier Foods')

    // score 92 -> green
    const greenCell = screen.getByText('92.0%').closest('td')
    expect(greenCell).toHaveClass('text-green-600')

    // score 75 -> yellow
    const yellowCell = screen.getByText('75.0%').closest('td')
    expect(yellowCell).toHaveClass('text-yellow-600')

    // score 60 -> red
    const redCell = screen.getByText('60.0%').closest('td')
    expect(redCell).toHaveClass('text-red-600')
  })

  // -------------------------------------------------------------------------
  // 9. Displays View Details link in actions column (Req 9)
  // -------------------------------------------------------------------------
  it('displays View Details link in actions column', async () => {
    mockFetchWithMultiSuppliers()
    render(<SupplierListPage />)

    await screen.findByText('Premier Foods')

    // There should be one "View Details" link per supplier row
    const links = screen.getAllByRole('link', { name: /view details/i })
    expect(links).toHaveLength(mockSuppliersMulti.length)

    // Each link must point to the correct supplier detail page
    mockSuppliersMulti.forEach((supplier, index) => {
      expect(links[index]).toHaveAttribute(
        'href',
        `/supplier/suppliers/${supplier.id}`,
      )
    })
  })
})
