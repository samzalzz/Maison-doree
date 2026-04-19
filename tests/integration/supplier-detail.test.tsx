/**
 * @jest-environment jsdom
 *
 * tests/integration/supplier-detail.test.tsx
 *
 * Integration tests for the Supplier Detail page.
 * Covers: supplier heading, contact info, performance metrics,
 * catalog entries, edit/archive/block buttons, status badge color,
 * trend indicator, reliability score, category breakdown, and
 * expanded recent PO columns.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SupplierDetailPage from '@/app/(admin)/supplier/suppliers/[id]/page';

const mockRouterPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
  useParams: () => ({
    id: 'sup-1',
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

describe('SupplierDetailPage', () => {
  const mockSupplier = {
    id: 'sup-1',
    name: 'Premier Foods',
    email: 'contact@premier.com',
    phone: '+33.1.234.567.89',
    status: 'ACTIVE',
    address: '123 Rue de Boulangerie, Paris, France',
    reliabilityScore: 92,
  };

  const mockCatalog = [
    {
      id: 'cat-1',
      materialId: 'mat-flour',
      materialName: 'Flour',
      pricePerUnit: '2.50',
      minOrderQuantity: 50,
      leadTimeDays: 3,
    },
  ];

  const mockPerformance = {
    onTimeDeliveryPercentage: 96,
    qualityScore: 88,
    trend: 'IMPROVING',
    ordersCompleted30Days: 12,
    averageLeadTime: 2.5,
    reliabilityScore: 92,
    categoryBreakdown: [
      {
        categoryId: 'cat-grains',
        categoryName: 'Grains',
        onTimePercentage: 97,
        qualityScore: 90,
        reliabilityScore: 93.5,
      },
      {
        categoryId: 'cat-dairy',
        categoryName: 'Dairy',
        onTimePercentage: 94,
        qualityScore: 85,
        reliabilityScore: 89.0,
      },
    ],
  };

  const mockRecentOrders = [
    {
      id: 'po-1',
      poNumber: 'PO-2026-04-19-001',
      materialName: 'Flour',
      quantity: 200,
      unit: 'kg',
      status: 'COMPLETED',
      expectedDeliveryDate: '2026-04-18T00:00:00Z',
      actualDeliveryDate: '2026-04-18T10:00:00Z',
      isOnTime: true,
    },
    {
      id: 'po-2',
      poNumber: 'PO-2026-04-18-001',
      materialName: 'Butter',
      quantity: 50,
      unit: 'kg',
      status: 'PENDING',
      expectedDeliveryDate: '2026-04-20T00:00:00Z',
      actualDeliveryDate: null,
      isOnTime: false,
    },
  ];

  // Issue 5: clearAllMocks is sufficient — no redundant .mockClear() calls
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure window.confirm auto-accepts so confirmation-guarded mutations
    // can be exercised without interactive prompts.
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  // Issue 5: restore all spies / mocks after each test to prevent leakage
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders supplier heading with name', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => expect(screen.getByText('Premier Foods')).toBeInTheDocument());
  });

  it('displays supplier contact information', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('contact@premier.com')).toBeInTheDocument();
      expect(screen.getByText('+33.1.234.567.89')).toBeInTheDocument();
    });
  });

  it('displays supplier performance metrics', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    // Issue 13: specific text matchers instead of broad regexes
    await waitFor(() => {
      expect(screen.getByText('96%')).toBeInTheDocument(); // on-time %
      expect(screen.getByText('88%')).toBeInTheDocument(); // quality score
    });
  });

  it('displays catalog entries (materials supplied)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText(/2.50/)).toBeInTheDocument();
    });
  });

  it('has button to edit supplier', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays status badge with color', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      const badge = screen.getByText('ACTIVE');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  it('displays trend indicator', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByText(/improving/i)).toBeInTheDocument();
    });
  });

  it('displays recent purchase orders table with expanded columns', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: mockRecentOrders,
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      // PO numbers
      expect(screen.getByText('PO-2026-04-19-001')).toBeInTheDocument();
      expect(screen.getByText('PO-2026-04-18-001')).toBeInTheDocument();

      // Material names
      expect(screen.getByText('Butter')).toBeInTheDocument();

      // Quantities with units
      expect(screen.getByText(/200.*kg/)).toBeInTheDocument();
      expect(screen.getByText(/50.*kg/)).toBeInTheDocument();

      // Column headers (Material appears in both catalog and orders tables)
      const materialHeaders = screen.getAllByText('Material');
      expect(materialHeaders.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Qty')).toBeInTheDocument();
      expect(screen.getByText('Expected')).toBeInTheDocument();
      expect(screen.getByText('Actual')).toBeInTheDocument();
      expect(screen.getByText('On-Time?')).toBeInTheDocument();

      // Status badges with correct colors
      const completedBadge = screen.getByText('COMPLETED');
      expect(completedBadge).toHaveClass('bg-green-100', 'text-green-800');

      const pendingBadge = screen.getByText('PENDING');
      expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');

      // On-time flag: checkmark for isOnTime=true, X for false
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('✗')).toBeInTheDocument();

      // Actual delivery shows '-' when null
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  it('has Add Material button that navigates to add-catalog route', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    const user = userEvent.setup();

    render(<SupplierDetailPage />);

    await waitFor(() => {
      const addMaterialButton = screen.getByRole('button', { name: /add material/i });
      expect(addMaterialButton).toBeInTheDocument();
    });

    const addMaterialButton = screen.getByRole('button', { name: /add material/i });
    await user.click(addMaterialButton);

    expect(mockRouterPush).toHaveBeenCalledWith('/supplier/suppliers/sup-1/add-catalog');
  });

  it('displays Archive Supplier and Block Supplier buttons in header', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /archive supplier/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /block supplier/i })).toBeInTheDocument();
    });
  });

  it('navigates to archive route when Archive Supplier is clicked', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    const user = userEvent.setup();
    render(<SupplierDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /archive supplier/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /archive supplier/i }));
    expect(mockRouterPush).toHaveBeenCalledWith('/supplier/suppliers/sup-1/archive');
  });

  it('calls PATCH to suspend supplier when Block Supplier is clicked', async () => {
    const patchResponse = {
      ok: true,
      json: async () => ({ success: true }),
    };
    // First call: initial fetch; second call: PATCH block; third call: refetch after block
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            supplier: mockSupplier,
            catalog: mockCatalog,
            performance: mockPerformance,
            recentOrders: [],
          },
        }),
      })
      .mockResolvedValueOnce(patchResponse)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            supplier: { ...mockSupplier, status: 'SUSPENDED' },
            catalog: mockCatalog,
            performance: mockPerformance,
            recentOrders: [],
          },
        }),
      });

    const user = userEvent.setup();
    render(<SupplierDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /block supplier/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /block supplier/i }));

    // Issue 10: use global.fetch consistently
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/supplier/suppliers/sup-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'SUSPENDED' }),
        })
      );
    });
  });

  it('displays reliability score in performance section', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Reliability Score')).toBeInTheDocument();
      // reliabilityScore of 92 should appear (supplier.reliabilityScore)
      const scoreElements = screen.getAllByText('92');
      expect(scoreElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays category breakdown table when data is present', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Performance by Category')).toBeInTheDocument();
      expect(screen.getByText('Grains')).toBeInTheDocument();
      expect(screen.getByText('Dairy')).toBeInTheDocument();
      // on-time % column
      expect(screen.getByText(/97%/)).toBeInTheDocument();
      expect(screen.getByText(/94%/)).toBeInTheDocument();
      // reliability scores formatted to 1 decimal
      expect(screen.getByText('93.5')).toBeInTheDocument();
      expect(screen.getByText('89.0')).toBeInTheDocument();
    });
  });

  it('does not display category breakdown section when no data', async () => {
    const perfWithoutBreakdown = { ...mockPerformance, categoryBreakdown: [] };
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: perfWithoutBreakdown,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText('Performance by Category')).not.toBeInTheDocument();
    });
  });

  it('displays Remove button alongside Edit in catalog rows', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument();
    });
  });

  it('displays Total Orders metric in performance scorecard', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          supplier: mockSupplier,
          catalog: mockCatalog,
          performance: mockPerformance,
          recentOrders: [],
        },
      }),
    });

    render(<SupplierDetailPage />);

    await waitFor(() => {
      // Verify "Total Orders" label is displayed
      expect(screen.getByText('Total Orders')).toBeInTheDocument();

      // Verify the count (12) is displayed
      expect(screen.getByText('12')).toBeInTheDocument();

      // Verify "Last 30 days" subtitle
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });
  });

  it('calls DELETE when Remove catalog button is clicked', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            supplier: mockSupplier,
            catalog: mockCatalog,
            performance: mockPerformance,
            recentOrders: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            supplier: mockSupplier,
            catalog: [],
            performance: mockPerformance,
            recentOrders: [],
          },
        }),
      });

    const user = userEvent.setup();
    render(<SupplierDetailPage />);

    await waitFor(() => expect(screen.getByText('Flour')).toBeInTheDocument());

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons.length).toBeGreaterThan(0);

    await user.click(removeButtons[0]);

    // Issue 10: use global.fetch consistently
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/catalog/cat-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
