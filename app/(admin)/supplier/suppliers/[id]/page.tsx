'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getStatusBadgeColor } from '@/lib/helpers/badge-colors';

interface SupplierDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  address: string | null;
  reliabilityScore: number | null;
}

interface CatalogEntry {
  id: string;
  materialId: string;
  materialName: string;
  pricePerUnit: string;
  minOrderQuantity: number;
  leadTimeDays: number;
}

interface PerformanceMetrics {
  onTimeDeliveryPercentage: number;
  qualityScore: number;
  trend: string;
  ordersCompleted30Days: number;
  averageLeadTime: number;
  reliabilityScore?: number;
  categoryBreakdown?: Array<{
    categoryId: string;
    categoryName: string;
    onTimePercentage: number;
    qualityScore: number;
    reliabilityScore: number;
  }>;
}

interface RecentOrder {
  id: string;
  poNumber: string;
  materialName: string;
  quantity: number;
  unit: string;
  status: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string | null;
  isOnTime: boolean;
}

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();

  // Issue 7: type-guard params.id instead of a bare cast
  const supplierId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to the latest AbortController so mutation handlers
  // can pass the signal when re-fetching after a PATCH / DELETE.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Issue 1: signal is passed in from the useEffect; the return-value
  // pattern was dead code — cleanup is now owned by the effect itself.
  const fetchSupplierDetail = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/supplier/suppliers/${supplierId}`, {
        signal,
      });
      if (!response.ok) throw new Error('Failed to fetch supplier');

      const data = await response.json();
      setSupplier(data.data.supplier);
      setCatalog(data.data.catalog || []);
      setPerformance(data.data.performance || null);
      setRecentOrders(data.data.recentOrders || []);
      setError(null);
    } catch (err) {
      // Ignore abort errors — expected on cleanup or fast navigation.
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchSupplierDetail(controller.signal);
    return () => controller.abort();   // cleanup properly registered
  }, [fetchSupplierDetail]);

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return 'text-green-600';
      case 'STABLE':
        return 'text-blue-600';
      case 'DECLINING':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Issue 3: thresholds aligned with list page (90 / 70)
  const getReliabilityColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-gray-600';
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Issue 2: confirmation guard + disabled state via the shared loading flag
  const handleBlockSupplier = async () => {
    if (!window.confirm('Are you sure? This will block the supplier and prevent future orders.')) {
      return;
    }
    try {
      const response = await fetch(`/api/supplier/suppliers/${supplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SUSPENDED' }),
      });
      if (!response.ok) throw new Error('Failed to block supplier');
      const controller = new AbortController();
      abortControllerRef.current = controller;
      await fetchSupplierDetail(controller.signal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block supplier');
    }
  };

  // Issue 2: confirmation guard for destructive catalog removal
  const handleRemoveCatalogEntry = async (catalogId: string) => {
    if (!window.confirm('Remove this material from the catalog?')) {
      return;
    }
    try {
      const response = await fetch(
        `/api/supplier/suppliers/${supplierId}/catalog/${catalogId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to remove catalog entry');
      const controller = new AbortController();
      abortControllerRef.current = controller;
      await fetchSupplierDetail(controller.signal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove material');
    }
  };

  // Issue 7: guard for missing supplierId
  if (!supplierId) return <div>Invalid supplier ID</div>;

  if (loading) return <div className="p-6 text-center">Loading supplier details...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  if (!supplier) return <div className="p-6 text-center">Supplier not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/supplier/suppliers" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
            ← Back to Suppliers
          </Link>
          <h1 className="text-3xl font-bold">{supplier.name}</h1>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(supplier.status)}`}>
            {supplier.status}
          </span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/supplier/suppliers/${supplierId}/edit`)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Edit Supplier
          </button>
          <button
            type="button"
            onClick={() => router.push(`/supplier/suppliers/${supplierId}/archive`)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg"
          >
            Archive Supplier
          </button>
          {/* Issue 2: disabled during async operations to prevent double-submit */}
          <button
            type="button"
            onClick={handleBlockSupplier}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Block Supplier
          </button>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{supplier.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium">{supplier.phone || '-'}</p>
          </div>
          {supplier.address && (
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-medium">{supplier.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      {performance && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Performance Metrics (30 days)</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600">On-Time Delivery</p>
              <p className="text-3xl font-bold text-blue-600">{performance.onTimeDeliveryPercentage}%</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-sm text-gray-600">Quality Score</p>
              <p className="text-3xl font-bold text-purple-600">{performance.qualityScore}%</p>
            </div>
            <div className="border-l-4 border-pink-500 pl-4">
              <p className="text-sm text-gray-600">Reliability Score</p>
              <p className={`text-3xl font-bold ${getReliabilityColor(performance?.reliabilityScore ?? supplier.reliabilityScore)}`}>
                {supplier.reliabilityScore ?? 'N/A'}
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm text-gray-600">Trend</p>
              <p className={`text-2xl font-bold ${getTrendColor(performance.trend)}`}>{performance.trend}</p>
              <p className="text-xs text-gray-500 mt-1">Avg lead: {performance.averageLeadTime}d</p>
            </div>
            <div className="border-l-4 border-amber-500 pl-4">
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-3xl font-bold text-amber-600">{performance.ordersCompleted30Days}</p>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {performance?.categoryBreakdown && performance.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Performance by Category</h2>
          {/* Issue 6: caption for screen readers + scope on th elements */}
          <table className="w-full">
            <caption className="sr-only">Category Breakdown</caption>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">On-Time %</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quality %</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Score</th>
              </tr>
            </thead>
            <tbody>
              {performance.categoryBreakdown.map((cat) => (
                <tr key={cat.categoryId} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{cat.categoryName}</td>
                  <td className="px-4 py-3">{cat.onTimePercentage}%</td>
                  <td className="px-4 py-3">{cat.qualityScore}%</td>
                  <td className={`px-4 py-3 font-semibold ${getReliabilityColor(cat.reliabilityScore)}`}>
                    {cat.reliabilityScore.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Catalog Entries */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Materials Supplied</h2>
          <button
            type="button"
            onClick={() => router.push(`/supplier/suppliers/${supplierId}/add-catalog`)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm"
          >
            Add Material
          </button>
        </div>

        {catalog.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No materials in catalog</p>
        ) : (
          /* Issue 6: caption for screen readers + scope on th elements */
          <table className="w-full">
            <caption className="sr-only">Materials Supplied</caption>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price per Unit</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Min Order</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lead Time</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((entry) => (
                <tr key={entry.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{entry.materialName}</td>
                  {/* Issue 4: guard against NaN before calling toFixed */}
                  <td className="px-4 py-3">
                    €{entry.pricePerUnit && !isNaN(parseFloat(entry.pricePerUnit))
                      ? parseFloat(entry.pricePerUnit).toFixed(2)
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3">{entry.minOrderQuantity} units</td>
                  <td className="px-4 py-3">{entry.leadTimeDays} days</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/supplier/suppliers/${supplierId}/catalog/${entry.id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCatalogEntry(entry.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Purchase Orders</h2>
          {/* Issue 6: caption for screen readers + scope on th elements */}
          <table className="w-full">
            <caption className="sr-only">Recent Purchase Orders</caption>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PO #</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expected</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actual</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">On-Time?</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{order.poNumber}</td>
                  <td className="px-4 py-3">{order.materialName}</td>
                  <td className="px-4 py-3">{order.quantity} {order.unit}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{order.actualDeliveryDate ? new Date(order.actualDeliveryDate).toLocaleDateString() : '-'}</td>
                  {/* Issue 8: aria-label makes the symbol meaningful to screen readers */}
                  <td
                    className="px-4 py-3 text-center"
                    aria-label={order.isOnTime ? 'On time' : 'Late'}
                  >
                    {order.isOnTime ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
