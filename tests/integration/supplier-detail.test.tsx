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

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
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
});
