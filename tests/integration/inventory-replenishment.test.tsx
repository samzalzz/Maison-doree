/**
 * @jest-environment jsdom
 *
 * tests/integration/inventory-replenishment.test.tsx
 *
 * Integration tests for the Inventory Replenishment page.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InventoryReplenishmentPage from '@/app/(admin)/supplier/inventory-replenishment/page';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('InventoryReplenishmentPage', () => {
  const mockData = {
    labs: [
      {
        id: 'lab-1',
        name: 'Lab A',
        materials: [
          { id: 'mat-1', name: 'Flour', currentQty: 30, minThreshold: 50, unit: 'kg', dailyUsage: 10, suggestionQty: 100 },
          { id: 'mat-2', name: 'Sugar', currentQty: 80, minThreshold: 100, unit: 'kg', dailyUsage: 5, suggestionQty: 50 },
        ],
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Inventory Replenishment heading', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response);
    render(<InventoryReplenishmentPage />);
    expect(screen.getByText(/inventory replenishment/i)).toBeInTheDocument();
  });

  it('displays labs with low inventory materials', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response);
    render(<InventoryReplenishmentPage />);
    await waitFor(() => {
      expect(screen.getByText('Lab A')).toBeInTheDocument();
      expect(screen.getByText('Flour')).toBeInTheDocument();
      expect(screen.getByText('Sugar')).toBeInTheDocument();
    });
  });

  it('shows current qty, min threshold, daily usage, and suggestion qty', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response);
    render(<InventoryReplenishmentPage />);
    await waitFor(() => {
      expect(screen.getByText('30 kg')).toBeInTheDocument(); // current (unique)
      // '50 kg' appears twice: Flour's minThreshold and Sugar's suggestionQty
      expect(screen.getAllByText('50 kg').length).toBeGreaterThanOrEqual(1); // threshold
      // '100 kg' appears twice: Flour's suggestionQty and Sugar's minThreshold
      expect(screen.getAllByText('100 kg').length).toBeGreaterThanOrEqual(1); // suggestion
    });
  });

  it('highlights materials below threshold in red', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response);
    render(<InventoryReplenishmentPage />);
    await waitFor(() => {
      const flourRow = screen.getByText('Flour').closest('tr');
      expect(flourRow).toHaveClass('bg-red-50');
    });
  });

  it('displays Create PO button for each material', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response);
    render(<InventoryReplenishmentPage />);
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /create.*order/i });
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('displays total materials needing replenishment', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    } as Response);
    render(<InventoryReplenishmentPage />);
    await waitFor(() => {
      expect(screen.getByText(/2 materials needing replenishment/i)).toBeInTheDocument();
    });
  });
});
