/**
 * @jest-environment jsdom
 *
 * app/(admin)/__tests__/supplier-pages.test.tsx
 *
 * Unit tests for the 5 Supplier Management UI pages (Cycle B):
 *   1. SupplierListPage       – /supplier/suppliers
 *   2. SupplierDetailPage     – /supplier/suppliers/[id]
 *   3. POTrackingPage         – /supplier/purchase-orders
 *   4. PerformanceDashboardPage – /supplier/performance
 *   5. InventoryReplenishmentPage – /supplier/inventory-replenishment
 *
 * Strategy:
 *  - All fetch calls are mocked via jest.spyOn(global, 'fetch').
 *  - next/navigation hooks (useRouter, useParams, useSearchParams) are mocked.
 *  - next/link is replaced with a plain <a> to keep href assertions stable.
 *  - Tests validate: column headers, data rows, filters, tabs,
 *    action buttons, overdue highlighting, and link navigation.
 */

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import
// ---------------------------------------------------------------------------

const mockRouterPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useParams: () => ({ id: 'supplier_001' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import SupplierListPage from '@/app/(admin)/supplier/suppliers/page'
import SupplierDetailPage from '@/app/(admin)/supplier/suppliers/[id]/page'
import POTrackingPage from '@/app/(admin)/supplier/purchase-orders/page'
import PerformanceDashboardPage from '@/app/(admin)/supplier/performance/page'
import InventoryReplenishmentPage from '@/app/(admin)/supplier/inventory-replenishment/page'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mockFetchOnce(data: unknown, ok = true) {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  } as Response)
}

function mockFetchAlways(data: unknown, ok = true) {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  } as Response)
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUPPLIER_1 = {
  id: 'supplier_001',
  name: 'Argan Oil Co.',
  email: 'contact@arganoil.ma',
  phone: '+212-522-111111',
  status: 'ACTIVE',
  reliabilityScore: 92.5,
}

const SUPPLIER_2 = {
  id: 'supplier_002',
  name: 'Rose Water Distillery',
  email: 'info@rosewaterma.com',
  phone: null,
  status: 'INACTIVE',
  reliabilityScore: 68.0,
}

const SUPPLIER_LIST_RESPONSE = {
  success: true,
  data: { suppliers: [SUPPLIER_1, SUPPLIER_2] },
}

const SUPPLIER_DETAIL_RESPONSE = {
  success: true,
  data: {
    supplier: {
      id: 'supplier_001',
      name: 'Argan Oil Co.',
      email: 'contact@arganoil.ma',
      phone: '+212-522-111111',
      status: 'ACTIVE',
      address: '123 Medina, Marrakech',
      reliabilityScore: 92.5,
    },
    catalog: [
      {
        id: 'cat_001',
        materialId: 'mat_001',
        materialName: 'Argan Oil',
        pricePerUnit: '15.50',
        minOrderQuantity: 10,
        leadTimeDays: 3,
      },
    ],
    performance: {
      onTimeDeliveryPercentage: 95,
      qualityScore: 98,
      trend: 'IMPROVING',
      ordersCompleted30Days: 8,
      averageLeadTime: 2.5,
      reliabilityScore: 92.5,
    },
    recentOrders: [
      {
        id: 'po_001',
        poNumber: 'PO-2026-001',
        materialName: 'Argan Oil',
        quantity: 50,
        unit: 'liters',
        status: 'COMPLETED',
        expectedDeliveryDate: '2026-04-10T00:00:00Z',
        actualDeliveryDate: '2026-04-09T00:00:00Z',
        isOnTime: true,
      },
    ],
  },
}

const PENDING_SUGGESTION = {
  id: 'sug_001',
  labId: 'lab_001',
  labName: 'Lab Alpha',
  materialId: 'mat_001',
  materialName: 'Argan Oil',
  suggestedQuantity: 100,
  bestSupplierId: 'supplier_001',
  bestSupplierName: 'Argan Oil Co.',
  expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
}

const ACTIVE_PO = {
  id: 'po_active_001',
  poNumber: 'PO-2026-010',
  supplierId: 'supplier_001',
  supplierName: 'Argan Oil Co.',
  materialId: 'mat_001',
  materialName: 'Argan Oil',
  quantity: 200,
  unit: 'liters',
  expectedDeliveryDate: '2026-04-25T00:00:00Z',
  actualDeliveryDate: null,
  status: 'APPROVED',
  isOverdue: false,
}

const OVERDUE_PO = {
  ...ACTIVE_PO,
  id: 'po_overdue_001',
  poNumber: 'PO-2026-005',
  expectedDeliveryDate: '2026-04-01T00:00:00Z',
  isOverdue: true,
}

const DELIVERY_HISTORY_ITEM = {
  id: 'del_001',
  poNumber: 'PO-2026-003',
  supplierId: 'supplier_001',
  supplierName: 'Argan Oil Co.',
  materialId: 'mat_001',
  materialName: 'Argan Oil',
  orderedQuantity: 100,
  receivedQuantity: 100,
  deliveryDate: '2026-03-15T00:00:00Z',
  qcResult: 'PASS',
  isOnTime: true,
}

const SUGGESTIONS_RESPONSE = {
  success: true,
  data: {
    suggestions: [PENDING_SUGGESTION],
    stats: { pendingApproval: 1 },
  },
}

const ACTIVE_ORDERS_RESPONSE = {
  success: true,
  data: {
    activeOrders: [ACTIVE_PO, OVERDUE_PO],
    stats: { activeOrders: 2, overdue: 1 },
  },
}

const HISTORY_RESPONSE = {
  success: true,
  data: { history: [DELIVERY_HISTORY_ITEM] },
}

const PERFORMANCE_RESPONSE = {
  success: true,
  data: {
    totalSuppliers: 5,
    averageReliability: 88.4,
    onTimeDeliveryRate: 91.2,
    qualityScore: 94.7,
    riskCount: 2,
    suppliers: [
      {
        id: 'supplier_001',
        name: 'Argan Oil Co.',
        reliabilityScore: 92.5,
        onTimePercentage: 95,
        qualityScore: 98,
        trend: 'IMPROVING',
        riskLevel: 'LOW',
      },
      {
        id: 'supplier_002',
        name: 'Rose Water Distillery',
        reliabilityScore: 68.0,
        onTimePercentage: 72,
        qualityScore: 80,
        trend: 'DECLINING',
        riskLevel: 'HIGH',
      },
    ],
  },
}

const INVENTORY_RESPONSE = {
  success: true,
  data: {
    labs: [
      {
        id: 'lab_001',
        name: 'Lab Alpha',
        materials: [
          {
            id: 'mat_001',
            name: 'Argan Oil',
            currentQty: 5,
            minThreshold: 20,
            unit: 'liters',
            dailyUsage: 2,
            suggestionQty: 50,
          },
          {
            id: 'mat_002',
            name: 'Rose Water',
            currentQty: 30,
            minThreshold: 10,
            unit: 'liters',
            dailyUsage: 1,
            suggestionQty: 20,
          },
        ],
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// 1. Supplier List Page
// ---------------------------------------------------------------------------

describe('SupplierListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (!global.fetch) global.fetch = jest.fn()
  })

  it('renders table with correct column headers', async () => {
    mockFetchAlways(SUPPLIER_LIST_RESPONSE)
    render(<SupplierListPage />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    expect(screen.getByText('Supplier Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    // "Status" appears in both the filter label and the table header
    expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Reliability Score')).toBeInTheDocument()
  })

  it('renders supplier data rows with name, status badge, and reliability score', async () => {
    mockFetchAlways(SUPPLIER_LIST_RESPONSE)
    render(<SupplierListPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil Co.')).toBeInTheDocument())

    expect(screen.getByText('Rose Water Distillery')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('INACTIVE')).toBeInTheDocument()
    // Reliability score formatted to 1 decimal
    expect(screen.getByText('92.5%')).toBeInTheDocument()
    expect(screen.getByText('68.0%')).toBeInTheDocument()
  })

  it('renders search input, status filter dropdown, and Add Supplier button', async () => {
    mockFetchAlways(SUPPLIER_LIST_RESPONSE)
    render(<SupplierListPage />)

    // The Add Supplier button is present immediately (not behind fetch)
    expect(screen.getByRole('button', { name: /add supplier/i })).toBeInTheDocument()

    // Inputs are also present before data loads
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument()
  })

  it('changes status filter and triggers a new fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => SUPPLIER_LIST_RESPONSE,
    } as Response)

    render(<SupplierListPage />)
    // Wait for initial fetch to complete
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: 'ACTIVE' },
    })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const secondCall = fetchSpy.mock.calls[1][0] as string
    expect(secondCall).toContain('status=ACTIVE')
  })
})

// ---------------------------------------------------------------------------
// 2. Supplier Detail Page
// ---------------------------------------------------------------------------

describe('SupplierDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (!global.fetch) global.fetch = jest.fn()
  })

  it('renders supplier name, status badge, and contact info card', async () => {
    mockFetchAlways(SUPPLIER_DETAIL_RESPONSE)
    render(<SupplierDetailPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil Co.')).toBeInTheDocument())

    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('Contact Information')).toBeInTheDocument()
    expect(screen.getByText('contact@arganoil.ma')).toBeInTheDocument()
  })

  it('renders performance metrics section with on-time, quality, and reliability values', async () => {
    mockFetchAlways(SUPPLIER_DETAIL_RESPONSE)
    render(<SupplierDetailPage />)

    await waitFor(() => expect(screen.getByText('Performance Metrics (30 days)')).toBeInTheDocument())

    expect(screen.getByText('On-Time Delivery')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('Quality Score')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
    expect(screen.getByText('Reliability Score')).toBeInTheDocument()
  })

  it('renders materials catalog table with material rows and Edit/Remove actions', async () => {
    mockFetchAlways(SUPPLIER_DETAIL_RESPONSE)
    render(<SupplierDetailPage />)

    // "Materials Supplied" appears in both <h2> and <caption class="sr-only">
    await waitFor(() =>
      expect(screen.getAllByText('Materials Supplied').length).toBeGreaterThanOrEqual(1),
    )

    // "Argan Oil" appears in both the catalog table and the recent orders table
    expect(screen.getAllByText('Argan Oil').length).toBeGreaterThanOrEqual(1)
    // Price is rendered as "€" + "15.50" text nodes inside the same <td>
    expect(screen.getByText(/15\.50/)).toBeInTheDocument()
    expect(screen.getByText('10 units')).toBeInTheDocument()
    // Edit and Remove buttons are present in the catalog actions column
    expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /remove/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('renders recent purchase orders section with PO number and on-time indicator', async () => {
    mockFetchAlways(SUPPLIER_DETAIL_RESPONSE)
    render(<SupplierDetailPage />)

    // "Recent Purchase Orders" appears in both <h2> and <caption class="sr-only">
    await waitFor(() =>
      expect(screen.getAllByText('Recent Purchase Orders').length).toBeGreaterThanOrEqual(1),
    )

    expect(screen.getByText('PO-2026-001')).toBeInTheDocument()
    // isOnTime: true → <td aria-label="On time"> rendered in the component
    expect(screen.getByRole('cell', { name: /on time/i })).toBeInTheDocument()
  })

  it('renders Edit Supplier, Archive Supplier, and Block Supplier action buttons', async () => {
    mockFetchAlways(SUPPLIER_DETAIL_RESPONSE)
    render(<SupplierDetailPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil Co.')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /edit supplier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /archive supplier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /block supplier/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 3. PO Tracking Page
// ---------------------------------------------------------------------------

describe('POTrackingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (!global.fetch) global.fetch = jest.fn()
  })

  it('renders page heading and three tab buttons', async () => {
    // POTrackingPage fires two fetch calls on mount (suggestions + active)
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => SUGGESTIONS_RESPONSE,
    } as Response)

    render(<POTrackingPage />)

    expect(screen.getByText('Purchase Order Tracking')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /pending approvals/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /active orders/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /delivery history/i })).toBeInTheDocument()
  })

  it('Pending Approvals tab displays suggestion rows with Approve and Reject buttons', async () => {
    // On mount with activeTab='PENDING', three fetch calls fire:
    //   1. useEffect[activeTab,fetchSuggestions] → fetchSuggestions()
    //   2. useEffect[] → fetchSuggestions()
    //   3. useEffect[] → fetchActiveOrders()
    // We use mockResolvedValue (not Once) so every call resolves the same data.
    const fetchSpy = jest.spyOn(global, 'fetch')
    fetchSpy.mockImplementation((url: RequestInfo | URL) => {
      const urlStr = String(url)
      if (urlStr.includes('active')) {
        return Promise.resolve({
          ok: true,
          json: async () => ACTIVE_ORDERS_RESPONSE,
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => SUGGESTIONS_RESPONSE,
      } as Response)
    })

    render(<POTrackingPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil')).toBeInTheDocument())

    expect(screen.getByText('Lab Alpha')).toBeInTheDocument()
    expect(screen.getByText('Argan Oil Co.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('Active Orders tab shows POs with Mark Received button and highlights overdue rows', async () => {
    // Route all fetches based on URL to avoid ordering fragility
    jest.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      const urlStr = String(url)
      if (urlStr.includes('active')) {
        return Promise.resolve({
          ok: true,
          json: async () => ACTIVE_ORDERS_RESPONSE,
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => SUGGESTIONS_RESPONSE,
      } as Response)
    })

    render(<POTrackingPage />)

    // Switch to Active Orders tab
    fireEvent.click(screen.getByRole('tab', { name: /active orders/i }))

    await waitFor(() => expect(screen.getByText('PO-2026-010')).toBeInTheDocument())

    // Both the normal and overdue PO should render
    expect(screen.getByText('PO-2026-005')).toBeInTheDocument()

    // Mark Received button present for each active PO
    const markBtns = screen.getAllByRole('button', { name: /mark received/i })
    expect(markBtns.length).toBeGreaterThanOrEqual(1)

    // Overdue row identified by data-testid set in the component
    expect(screen.getByTestId('overdue-row')).toBeInTheDocument()
  })

  it('Delivery History tab shows completed delivery rows', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL) => {
      const urlStr = String(url)
      if (urlStr.includes('history')) {
        return Promise.resolve({
          ok: true,
          json: async () => HISTORY_RESPONSE,
        } as Response)
      }
      if (urlStr.includes('active')) {
        return Promise.resolve({
          ok: true,
          json: async () => ACTIVE_ORDERS_RESPONSE,
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        json: async () => SUGGESTIONS_RESPONSE,
      } as Response)
    })

    render(<POTrackingPage />)

    fireEvent.click(screen.getByRole('tab', { name: /delivery history/i }))

    await waitFor(() => expect(screen.getByText('PO-2026-003')).toBeInTheDocument())

    expect(screen.getByText('PASS')).toBeInTheDocument()
    // On-time delivery indicator: the component renders a <span aria-label="On time">
    expect(screen.getByLabelText('On time')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 4. Performance Dashboard Page
// ---------------------------------------------------------------------------

describe('PerformanceDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (!global.fetch) global.fetch = jest.fn()
  })

  it('renders portfolio metric cards with correct values', async () => {
    mockFetchAlways(PERFORMANCE_RESPONSE)
    render(<PerformanceDashboardPage />)

    await waitFor(() => expect(screen.getByText('Performance Dashboard')).toBeInTheDocument())

    expect(screen.getByText('Total Suppliers')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()

    expect(screen.getByText('Avg Reliability')).toBeInTheDocument()
    expect(screen.getByText('88.4%')).toBeInTheDocument()

    expect(screen.getByText('On-Time Rate')).toBeInTheDocument()
    expect(screen.getByText('91.2%')).toBeInTheDocument()

    // "Quality Score" appears once in the metric card header and once per supplier card
    expect(screen.getAllByText('Quality Score').length).toBeGreaterThanOrEqual(1)
    // The overall quality score value (94.7%) only appears in the portfolio card
    expect(screen.getByText('94.7%')).toBeInTheDocument()
  })

  it('renders risk alert banner when riskCount is greater than zero', async () => {
    mockFetchAlways(PERFORMANCE_RESPONSE)
    render(<PerformanceDashboardPage />)

    await waitFor(() => expect(screen.getByText(/2 suppliers at risk/i)).toBeInTheDocument())
  })

  it('renders supplier performance cards with links to detail pages', async () => {
    mockFetchAlways(PERFORMANCE_RESPONSE)
    render(<PerformanceDashboardPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil Co.')).toBeInTheDocument())

    expect(screen.getByText('Rose Water Distillery')).toBeInTheDocument()

    // Supplier cards should be wrapped in <a> links pointing to the detail page
    const links = screen.getAllByRole('link')
    const supplierLinks = links.filter((l) =>
      l.getAttribute('href')?.includes('/supplier/suppliers/'),
    )
    expect(supplierLinks.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// 5. Inventory Replenishment Page
// ---------------------------------------------------------------------------

describe('InventoryReplenishmentPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (!global.fetch) global.fetch = jest.fn()
  })

  it('renders page heading, lab name, and material rows', async () => {
    mockFetchAlways(INVENTORY_RESPONSE)
    render(<InventoryReplenishmentPage />)

    await waitFor(() => expect(screen.getByText('Lab Alpha')).toBeInTheDocument())

    expect(screen.getByText('Inventory Replenishment')).toBeInTheDocument()
    expect(screen.getByText('Argan Oil')).toBeInTheDocument()
    expect(screen.getByText('Rose Water')).toBeInTheDocument()
    expect(screen.getByText('2 materials needing replenishment')).toBeInTheDocument()
  })

  it('highlights materials below threshold with red background class', async () => {
    mockFetchAlways(INVENTORY_RESPONSE)
    render(<InventoryReplenishmentPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil')).toBeInTheDocument())

    // Argan Oil: currentQty(5) < minThreshold(20) → bg-red-50 row
    // Rose Water: currentQty(30) >= minThreshold(10) → no red class
    const rows = screen.getAllByRole('row')
    // Find the Argan Oil data row (skip header row at index 0)
    const arganRow = rows.find((r) => r.textContent?.includes('Argan Oil'))
    expect(arganRow).toBeDefined()
    expect(arganRow!.className).toContain('bg-red-50')

    const roseWaterRow = rows.find((r) => r.textContent?.includes('Rose Water'))
    expect(roseWaterRow).toBeDefined()
    expect(roseWaterRow!.className).not.toContain('bg-red-50')
  })

  it('renders Create Order button for each material row and it is clickable', async () => {
    mockFetchAlways(INVENTORY_RESPONSE)
    render(<InventoryReplenishmentPage />)

    await waitFor(() => expect(screen.getByText('Argan Oil')).toBeInTheDocument())

    const createOrderButtons = screen.getAllByRole('button', { name: /create order/i })
    expect(createOrderButtons.length).toBe(2)

    // Buttons are enabled — no error thrown on click
    fireEvent.click(createOrderButtons[0])
  })
})
