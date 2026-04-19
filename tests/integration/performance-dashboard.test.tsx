/**
 * @jest-environment jsdom
 *
 * tests/integration/performance-dashboard.test.tsx
 *
 * Integration tests for the Performance Dashboard page.
 * Covers: heading, portfolio metrics, supplier grid, risk badges,
 * trend indicators, risk alert summary, and supplier card links.
 */

// ---------------------------------------------------------------------------
// Module mocks — must come before any import
// ---------------------------------------------------------------------------

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
import '@testing-library/jest-dom';
import PerformanceDashboardPage from '@/app/(admin)/supplier/performance/page';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockDashboard = {
  totalSuppliers: 12,
  averageReliability: 87.5,
  onTimeDeliveryRate: 94.2,
  qualityScore: 89.1,
  riskCount: 2,
  suppliers: [
    {
      id: 'sup-1',
      name: 'Premier Foods',
      reliabilityScore: 92,
      onTimePercentage: 96,
      qualityScore: 88,
      trend: 'IMPROVING',
      riskLevel: 'LOW',
    },
    {
      id: 'sup-2',
      name: 'Sugar Co',
      reliabilityScore: 75,
      onTimePercentage: 85,
      qualityScore: 80,
      trend: 'DECLINING',
      riskLevel: 'HIGH',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PerformanceDashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Performance Dashboard heading', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/performance dashboard/i)).toBeInTheDocument();
    });
  });

  it('displays portfolio metrics: total suppliers, avg reliability, on-time rate, quality score', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // total suppliers
      expect(screen.getByText(/87.5/)).toBeInTheDocument(); // avg reliability
      expect(screen.getByText(/94.2/)).toBeInTheDocument(); // on-time rate
      expect(screen.getByText(/89.1/)).toBeInTheDocument(); // quality score
    });
  });

  it('displays supplier performance grid with cards', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Premier Foods')).toBeInTheDocument();
      expect(screen.getByText('Sugar Co')).toBeInTheDocument();
    });
  });

  it('displays risk alert badge for suppliers with HIGH or MEDIUM risk', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      const highRiskBadge = screen.getByText('HIGH');
      expect(highRiskBadge).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  it('displays trend indicator with color (IMPROVING green, DECLINING red, STABLE blue)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      const improvingTrend = screen.getByText('IMPROVING');
      expect(improvingTrend).toHaveClass('text-green-600');

      const decliningTrend = screen.getByText('DECLINING');
      expect(decliningTrend).toHaveClass('text-red-600');
    });
  });

  it('displays risk alert summary (X suppliers at risk)', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/2.*at risk/i)).toBeInTheDocument();
    });
  });

  it('links supplier cards to supplier detail page', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockDashboard }),
    });

    render(<PerformanceDashboardPage />);
    await waitFor(() => {
      const supplierLink = screen.getByRole('link', { name: /premier foods/i });
      expect(supplierLink).toHaveAttribute('href', '/supplier/suppliers/sup-1');
    });
  });
});
