/**
 * @jest-environment jsdom
 *
 * tests/integration/supplier-detail.test.tsx
 *
 * Integration tests for the Supplier Detail page.
 * Covers: supplier heading, contact info, performance metrics,
 * catalog entries, edit button, status badge color, and trend indicator.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SupplierDetailPage from '@/app/(admin)/supplier/suppliers/[id]/page';

const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouterPush.mockClear();
    mockRouterBack.mockClear();
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
    await waitFor(() => {
      expect(screen.getByText(/96/)).toBeInTheDocument(); // on-time %
      expect(screen.getByText(/88/)).toBeInTheDocument(); // quality score
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

  it('displays recent purchase orders table with PO details', async () => {
    const mockRecentOrders = [
      {
        id: 'po-1',
        poNumber: 'PO-2026-04-19-001',
        totalAmount: '1250.50',
        status: 'COMPLETED',
        createdAt: '2026-04-15T10:00:00Z',
      },
      {
        id: 'po-2',
        poNumber: 'PO-2026-04-18-001',
        totalAmount: '875.00',
        status: 'PENDING',
        createdAt: '2026-04-14T14:30:00Z',
      },
    ];

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
      // Check PO numbers
      expect(screen.getByText('PO-2026-04-19-001')).toBeInTheDocument();
      expect(screen.getByText('PO-2026-04-18-001')).toBeInTheDocument();

      // Check amounts
      expect(screen.getByText(/1250.50/)).toBeInTheDocument();
      expect(screen.getByText(/875.00/)).toBeInTheDocument();

      // Check statuses are rendered with correct colors.
      // The status text is rendered directly inside the <span> that carries the color classes,
      // so getByText returns the <span> itself.
      const completedBadge = screen.getByText('COMPLETED');
      expect(completedBadge).toHaveClass('bg-green-100', 'text-green-800');

      const pendingBadge = screen.getByText('PENDING');
      expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
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
});
