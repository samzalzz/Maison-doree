'use client';

import { useEffect, useState, useCallback } from 'react';

interface LabMaterial {
  id: string;
  name: string;
  currentQty: number;
  minThreshold: number;
  unit: string;
  dailyUsage: number;
  suggestionQty: number;
}

interface LabInventory {
  id: string;
  name: string;
  materials: LabMaterial[];
}

interface InventoryData {
  labs: LabInventory[];
}

export default function InventoryReplenishmentPage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch('/api/supplier/inventory-replenishment', { signal });
      if (!response.ok) throw new Error('Failed to fetch inventory data');
      const result = await response.json();
      setData(result.data);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchInventory(controller.signal);
    return () => controller.abort();
  }, [fetchInventory]);

  const totalMaterials = data
    ? data.labs.reduce((sum, lab) => sum + lab.materials.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inventory Replenishment</h1>

      {loading && <div className="p-6">Loading...</div>}
      {error && <div className="p-6 text-red-600">Error: {error}</div>}
      {!loading && !error && !data && <div className="p-6">No data</div>}

      {!loading && !error && data && (
        <>
          <p className="text-gray-600">{totalMaterials} materials needing replenishment</p>

          {data.labs.map((lab) => (
            <div key={lab.id} className="space-y-4">
              <h2 className="text-xl font-semibold">{lab.name}</h2>
              <table className="w-full border-collapse">
                <caption className="sr-only">Inventory status for {lab.name}</caption>
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold">Material</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold">Current Qty</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold">Min Threshold</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold">Daily Usage</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold">Suggested Qty</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lab.materials.map((material) => (
                    <tr
                      key={material.id}
                      className={material.currentQty < material.minThreshold ? 'bg-red-50' : ''}
                    >
                      <td className="px-4 py-3">{material.name}</td>
                      <td className="px-4 py-3">{`${material.currentQty} ${material.unit}`}</td>
                      <td className="px-4 py-3">{`${material.minThreshold} ${material.unit}`}</td>
                      <td className="px-4 py-3">{`${material.dailyUsage} ${material.unit}/day`}</td>
                      <td className="px-4 py-3 font-semibold">{`${material.suggestionQty} ${material.unit}`}</td>
                      <td className="px-4 py-3">
                        <button type="button" className="text-blue-600 hover:text-blue-800 text-sm">
                          Create Order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
