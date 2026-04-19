/**
 * @jest-environment jsdom
 *
 * tests/integration/po-tracking.test.tsx
 *
 * Comprehensive integration tests for the rebuilt PO Tracking page.
 * Covers all 3 tabs, modals, stats bar, overdue highlighting,
 * search/sort in Delivery History, and action button flows.
 */

// ---------------------------------------------------------------------------
// Module mocks — must come before any import
// ---------------------------------------------------------------------------

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
    refresh: jest.fn(),
  }),
  useParams: () => ({ id: 'po-1' }),
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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import POTrackingPage from '@/app/(admin)/supplier/purchase-orders/page';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSuggestions = [
  {
    id: 'sug-1',
    labId: 'lab-1',
    labName: 'Lab Alpha',
    materialId: 'mat-flour',
    materialName: 'Flour',
    suggestedQuantity: 200,
    bestSupplierId: 'sup-1',
    bestSupplierName: 'Premier Foods',
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
  },
  {
    id: 'sug-2',
    labId: 'lab-2',
    labName: 'Lab Beta',
    materialId: 'mat-sugar',
    materialName: 'Sugar',
    suggestedQuantity: 100,
    bestSupplierId: 'sup-2',
    bestSupplierName: 'Sugar Co',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
  },
];

const mockActivePOs = [
  {
    id: 'po-active-1',
    poNumber: 'PO-2026-04-19-001',
    supplierId: 'sup-1',
    supplierName: 'Premier Foods',
    materialId: 'mat-flour',
    materialName: 'Flour',
    quantity: 500,
    unit: 'kg',
    expectedDeliveryDate: '2026-04-25T00:00:00Z',
    actualDeliveryDate: null,
    status: 'APPROVED',
    isOverdue: false,
  },
  {
    id: 'po-active-2',
    poNumber: 'PO-2026-04-10-001',
    supplierId: 'sup-2',
    supplierName: 'Sugar Co',
    materialId: 'mat-sugar',
    materialName: 'Sugar',
    quantity: 200,
    unit: 'kg',
    expectedDeliveryDate: '2026-04-15T00:00:00Z',
    actualDeliveryDate: null,
    status: 'SHIPPED',
    isOverdue: true,
  },
];

const mockHistory = [
  {
    id: 'hist-1',
    poNumber: 'PO-2026-03-01-001',
    supplierId: 'sup-1',
    supplierName: 'Premier Foods',
    materialId: 'mat-flour',
    materialName: 'Flour',
    orderedQuantity: 300,
    receivedQuantity: 300,
    deliveryDate: '2026-03-10T00:00:00Z',
    qcResult: 'PASS',
    isOnTime: true,
  },
  {
    id: 'hist-2',
    poNumber: 'PO-2026-02-15-001',
    supplierId: 'sup-3',
    supplierName: 'Chocolate House',
    materialId: 'mat-cocoa',
    materialName: 'Cocoa',
    orderedQuantity: 50,
    receivedQuantity: 48,
    deliveryDate: '2026-02-22T00:00:00Z',
    qcResult: 'FAIL',
    isOnTime: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers to build mocked fetch responses
// ---------------------------------------------------------------------------

function buildSuggestionsResponse(suggestions = mockSuggestions) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        suggestions,
        stats: { pendingApproval: suggestions.length },
      },
    }),
  };
}

function buildActiveResponse(activeOrders = mockActivePOs) {
  const overdue = activeOrders.filter((po) => po.isOverdue).length;
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        activeOrders,
        stats: { activeOrders: activeOrders.length, overdue },
      },
    }),
  };
}

function buildHistoryResponse(history = mockHistory) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        history,
        sortColumns: ['poNumber', 'supplierName', 'materialName', 'deliveryDate', 'qcResult'],
      },
    }),
  };
}

// Default fetch mock: suggestions + active on initial load
function setupDefaultFetch() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/suggestions')) return Promise.resolve(buildSuggestionsResponse());
    if (url.includes('/active')) return Promise.resolve(buildActiveResponse());
    if (url.includes('/history')) return Promise.resolve(buildHistoryResponse());
    return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POTrackingPage — 3-tab architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultFetch();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Test 1: Page renders with correct heading
  // =========================================================================
  it('renders the page heading', () => {
    render(<POTrackingPage />);
    expect(
      screen.getByRole('heading', { name: /purchase order tracking/i })
    ).toBeInTheDocument();
  });

  // =========================================================================
  // Test 2: Stats bar shows 3 counts
  // =========================================================================
  it('displays all 3 stats counts in the stats bar', async () => {
    render(<POTrackingPage />);
    await waitFor(() => {
      // pendingApproval = 2, activeOrders = 2, overdue = 1
      expect(screen.getByTestId('stat-pending')).toHaveTextContent('2');
      expect(screen.getByTestId('stat-active')).toHaveTextContent('2');
      expect(screen.getByTestId('stat-overdue')).toHaveTextContent('1');
    });
  });

  // =========================================================================
  // Test 3: Tab A — Pending Approvals renders by default
  // =========================================================================
  it('renders Pending Approvals tab by default with correct columns', async () => {
    render(<POTrackingPage />);
    await waitFor(() => {
      // Column headers (use columnheader role to avoid ambiguity with cell text)
      expect(screen.getByRole('columnheader', { name: /^lab$/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /suggested qty/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /best supplier/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /expires in/i })).toBeInTheDocument();
      // Data rows
      expect(screen.getByText('Lab Alpha')).toBeInTheDocument();
      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText('Premier Foods')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Test 4: Tab B — Active Orders tab renders when clicked
  // =========================================================================
  it('renders Active Orders tab content when clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    // Wait for initial load then switch tab
    await waitFor(() => expect(screen.getByText('Lab Alpha')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() => {
      expect(screen.getByText('PO-2026-04-19-001')).toBeInTheDocument();
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Test 5: Tab C — Delivery History tab renders when clicked
  // =========================================================================
  it('renders Delivery History tab content when clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /delivery history/i }));

    await waitFor(() => {
      expect(screen.getByText('PO-2026-03-01-001')).toBeInTheDocument();
      expect(screen.getByText('Chocolate House')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Test 6: Approve button opens modal
  // =========================================================================
  it('opens approve modal when Approve button is clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /approve/i })).toHaveLength(2));

    await user.click(screen.getAllByRole('button', { name: /approve/i })[0]);

    expect(screen.getByRole('dialog', { name: /approve purchase order/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(200);
  });

  // =========================================================================
  // Test 7: Approve modal submits POST with correct data
  // =========================================================================
  it('submits POST to approve endpoint with supplier and quantity', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn()
      .mockImplementation((url: string) => {
        if (url.includes('/suggestions') && !url.includes('/approve')) {
          return Promise.resolve(buildSuggestionsResponse());
        }
        if (url.includes('/active')) return Promise.resolve(buildActiveResponse());
        if (url.includes('/approve')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      });

    render(<POTrackingPage />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /approve/i })).toHaveLength(2));

    await user.click(screen.getAllByRole('button', { name: /approve/i })[0]);

    // Confirm in modal
    const dialog = screen.getByRole('dialog', { name: /approve purchase order/i });
    await user.click(within(dialog).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const approveCall = calls.find(([url, opts]) =>
        url.includes('/sug-1/approve') && opts?.method === 'POST'
      );
      expect(approveCall).toBeDefined();
      const body = JSON.parse(approveCall[1].body);
      expect(body).toMatchObject({ supplierId: 'sup-1', quantity: 200 });
    });
  });

  // =========================================================================
  // Test 8: Reject button opens modal
  // =========================================================================
  it('opens reject modal when Reject button is clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: /reject/i })).toHaveLength(2));

    await user.click(screen.getAllByRole('button', { name: /reject/i })[0]);

    expect(screen.getByRole('dialog', { name: /reject suggestion/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/reason for rejection/i)).toBeInTheDocument();
  });

  // =========================================================================
  // Test 9: Reject modal submits POST with reason
  // =========================================================================
  it('submits POST to reject endpoint with rejection reason', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn()
      .mockImplementation((url: string) => {
        if (url.includes('/suggestions') && !url.includes('/reject')) {
          return Promise.resolve(buildSuggestionsResponse());
        }
        if (url.includes('/active')) return Promise.resolve(buildActiveResponse());
        if (url.includes('/reject')) {
          return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      });

    render(<POTrackingPage />);
    await waitFor(() => expect(screen.getAllByRole('button', { name: /reject/i })).toHaveLength(2));

    await user.click(screen.getAllByRole('button', { name: /reject/i })[0]);

    const dialog = screen.getByRole('dialog', { name: /reject suggestion/i });
    await user.type(within(dialog).getByLabelText(/reason/i), 'Stock already ordered');

    await user.click(within(dialog).getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const rejectCall = calls.find(([url, opts]) =>
        url.includes('/sug-1/reject') && opts?.method === 'POST'
      );
      expect(rejectCall).toBeDefined();
      const body = JSON.parse(rejectCall[1].body);
      expect(body.reason).toBe('Stock already ordered');
    });
  });

  // =========================================================================
  // Test 10: Overdue rows highlighted in red
  // =========================================================================
  it('highlights overdue PO rows with red styling in Active Orders tab', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() => {
      const overdueRow = screen.getByTestId('overdue-row');
      expect(overdueRow).toHaveClass('bg-red-50');
      expect(overdueRow).toHaveClass('border-red-500');
    });
  });

  // =========================================================================
  // Test 11: Mark Received button opens modal with date picker
  // =========================================================================
  it('opens Mark Received modal with date picker when button clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /mark received/i })).toHaveLength(2)
    );

    await user.click(screen.getAllByRole('button', { name: /mark received/i })[0]);

    const dialog = screen.getByRole('dialog', { name: /mark as received/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/actual delivery date/i)).toBeInTheDocument();
  });

  // =========================================================================
  // Test 12: Mark Received submits PATCH with actualDeliveryDate
  // =========================================================================
  it('submits PATCH to mark-received endpoint with actual delivery date', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/suggestions')) return Promise.resolve(buildSuggestionsResponse());
      if (url.includes('/active')) return Promise.resolve(buildActiveResponse());
      if (url.includes('/mark-received')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    });

    render(<POTrackingPage />);
    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /mark received/i })).toHaveLength(2)
    );

    await user.click(screen.getAllByRole('button', { name: /mark received/i })[0]);

    const dialog = screen.getByRole('dialog', { name: /mark as received/i });
    await user.click(within(dialog).getByRole('button', { name: /confirm receipt/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const patchCall = calls.find(([url, opts]) =>
        url.includes('/po-active-1/mark-received') && opts?.method === 'PATCH'
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(patchCall[1].body);
      expect(body.actualDeliveryDate).toBeDefined();
    });
  });

  // =========================================================================
  // Test 13: Cancel button opens confirmation modal
  // =========================================================================
  it('opens Cancel Order modal with confirmation when Cancel button clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^cancel$/i })).toHaveLength(2)
    );

    await user.click(screen.getAllByRole('button', { name: /^cancel$/i })[0]);

    const cancelDialog = screen.getByRole('dialog', { name: /cancel order/i });
    expect(cancelDialog).toBeInTheDocument();
    // PO number is inside a <span> within the dialog
    expect(within(cancelDialog).getByText('PO-2026-04-19-001')).toBeInTheDocument();
  });

  // =========================================================================
  // Test 14: Cancel submits PATCH to cancel endpoint
  // =========================================================================
  it('submits PATCH to cancel endpoint when confirmed', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/suggestions')) return Promise.resolve(buildSuggestionsResponse());
      if (url.includes('/active')) return Promise.resolve(buildActiveResponse());
      if (url.includes('/cancel')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    });

    render(<POTrackingPage />);
    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^cancel$/i })).toHaveLength(2)
    );

    await user.click(screen.getAllByRole('button', { name: /^cancel$/i })[0]);

    const dialog = screen.getByRole('dialog', { name: /cancel order/i });
    await user.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const cancelCall = calls.find(([url, opts]) =>
        url.includes('/po-active-1/cancel') && opts?.method === 'PATCH'
      );
      expect(cancelCall).toBeDefined();
    });
  });

  // =========================================================================
  // Test 15: Delivery History search filters via query param
  // =========================================================================
  it('sends search query param when searching Delivery History', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /delivery history/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/search delivery history/i)).toBeInTheDocument()
    );

    const searchInput = screen.getByLabelText(/search delivery history/i);
    await user.type(searchInput, 'Premier');

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const historyCall = calls.find(([url]) =>
        url.includes('/history') && url.includes('search=Premier')
      );
      expect(historyCall).toBeDefined();
    });
  });

  // =========================================================================
  // Test 16: Column sorting in Delivery History
  // =========================================================================
  it('sends sort query params when a history column header is clicked', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /delivery history/i }));

    await waitFor(() =>
      expect(screen.getByText('PO-2026-03-01-001')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('columnheader', { name: /supplier/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const sortCall = calls.find(([url]) =>
        url.includes('/history') && url.includes('sortBy=supplierName')
      );
      expect(sortCall).toBeDefined();
    });
  });

  // =========================================================================
  // Test 17: History QC Result color-coding
  // =========================================================================
  it('applies green class to PASS and red class to FAIL in Delivery History', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /delivery history/i }));

    await waitFor(() => {
      const passCell = screen.getByText('PASS');
      expect(passCell).toHaveClass('text-green-700');

      const failCell = screen.getByText('FAIL');
      expect(failCell).toHaveClass('text-red-700');
    });
  });

  // =========================================================================
  // Test 18: View Details navigates to detail page
  // =========================================================================
  it('navigates to PO detail page when View Details is clicked in Active Orders', async () => {
    const user = userEvent.setup();
    render(<POTrackingPage />);

    await user.click(screen.getByRole('tab', { name: /active orders/i }));

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /view details/i })).toHaveLength(2)
    );

    await user.click(screen.getAllByRole('button', { name: /view details/i })[0]);

    expect(mockRouterPush).toHaveBeenCalledWith(
      '/supplier/purchase-orders/po-active-1'
    );
  });
});
