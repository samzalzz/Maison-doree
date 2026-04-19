/**
 * @jest-environment jsdom
 *
 * tests/integration/po-tracking.test.tsx
 *
 * Integration tests for the Purchase Order Tracking page.
 * Covers: page heading, PO list columns, status badge colors,
 * status filter, delivery date display, view details buttons,
 * and stats display.
 */

// ---------------------------------------------------------------------------
// Module mocks — must come before any import
// ---------------------------------------------------------------------------

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: jest.fn(),
  }),
}));

jest.mock('next/link', () => {
  const React = require('react');
  return function MockLink({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import POTrackingPage from '@/app/(admin)/supplier/purchase-orders/page';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPOs = [
  {
    id: 'po-1',
    poNumber: 'PO-2026-04-19-001',
    supplierId: 'sup-1',
    supplierName: 'Premier Foods',
    materialId: 'mat-flour',
    materialName: 'Flour',
    quantity: 500,
    unit: 'kg',
    totalAmount: '1250.50',
    status: 'APPROVED',
    expectedDeliveryDate: '2026-04-25T00:00:00Z',
    actualDeliveryDate: null,
    createdAt: '2026-04-19T10:00:00Z',
  },
  {
    id: 'po-2',
    poNumber: 'PO-2026-04-18-001',
    supplierId: 'sup-2',
    supplierName: 'Sugar Co',
    materialId: 'mat-sugar',
    materialName: 'Sugar',
    quantity: 200,
    unit: 'kg',
    totalAmount: '400.00',
    status: 'RECEIVED',
    expectedDeliveryDate: '2026-04-22T00:00:00Z',
    actualDeliveryDate: '2026-04-21T00:00:00Z',
    createdAt: '2026-04-18T09:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POTrackingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders Purchase Orders heading', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);
    expect(screen.getByRole('heading', { name: /purchase orders/i })).toBeInTheDocument();
  });

  it('displays PO list with columns: PO #, Supplier, Material, Qty, Status, Expected, Actual, Actions', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);
    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-19-001')).toBeInTheDocument();
      expect(screen.getByText('Premier Foods')).toBeInTheDocument();
      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText('500 kg')).toBeInTheDocument();
    });
  });

  it('displays status badge with color coding', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);
    await waitFor(() => {
      const approvedBadge = screen.getByText('APPROVED');
      expect(approvedBadge).toHaveClass('bg-blue-100', 'text-blue-800');

      const receivedBadge = screen.getByText('RECEIVED');
      expect(receivedBadge).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  it('filters POs by status', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { purchaseOrders: [mockPOs[1]], stats: { total: 1, pending: 0 } },
        }),
      });

    const user = userEvent.setup();
    render(<POTrackingPage />);

    const statusFilter = screen.getByRole('combobox', { name: /status/i });
    await user.selectOptions(statusFilter, 'RECEIVED');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=RECEIVED'),
        expect.any(Object)
      );
    });
  });

  it('displays expected and actual delivery dates', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);
    await waitFor(() => {
      expect(screen.getByText(/4\/25\/2026/)).toBeInTheDocument();  // Expected date
      expect(screen.getByText(/4\/21\/2026/)).toBeInTheDocument();  // Actual date
    });
  });

  it('displays View Details button for each PO', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);
    await waitFor(() => {
      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      expect(viewButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('displays total and pending order stats', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);
    await waitFor(() => {
      // Stat cards render the numeric totals as standalone text nodes
      const allTwos = screen.getAllByText(/^2$/);
      expect(allTwos.length).toBeGreaterThanOrEqual(1);  // total stat card
      const allOnes = screen.getAllByText(/^1$/);
      expect(allOnes.length).toBeGreaterThanOrEqual(1);  // pending stat card
    });
  });

  // ---------------------------------------------------------------------------
  // GAP 1 – Search by PO number or supplier name
  // ---------------------------------------------------------------------------

  it('searches POs by PO number or supplier name', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { purchaseOrders: [mockPOs[0]], stats: { total: 1, pending: 1 } },
        }),
      });

    const user = userEvent.setup();
    render(<POTrackingPage />);

    const searchInput = screen.getByPlaceholderText(/search by po number/i);
    await user.type(searchInput, 'Premier');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=Premier'),
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GAP 2 – Supplier name is a link to supplier detail page
  // ---------------------------------------------------------------------------

  it('displays supplier name as a link to supplier detail page', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);

    await waitFor(() => {
      const supplierLink = screen.getByRole('link', { name: 'Premier Foods' });
      expect(supplierLink).toHaveAttribute('href', '/supplier/suppliers/sup-1');
    });
  });

  // ---------------------------------------------------------------------------
  // GAP 3 – View Details button routing
  // ---------------------------------------------------------------------------

  it('navigates to PO detail page when View Details button is clicked', async () => {
    const mockRouter = require('next/navigation').useRouter();
    const user = userEvent.setup();

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { purchaseOrders: mockPOs, stats: { total: 2, pending: 1 } },
      }),
    });

    render(<POTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-19-001')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole('button', { name: /view details/i });
    await user.click(viewButtons[0]);

    expect(mockRouter.push).toHaveBeenCalledWith('/supplier/purchase-orders/po-1');
  });
});
