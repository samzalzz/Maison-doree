'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

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
}

interface RecentOrder {
  id: string;
  poNumber: string;
  totalAmount: string;
  status: string;
  createdAt: string;
}

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSupplierDetail = useCallback(async () => {
    const controller = new AbortController();
    try {
      setLoading(true);
      const response = await fetch(`/api/supplier/suppliers/${supplierId}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Failed to fetch supplier');

      const data = await response.json();
      setSupplier(data.data.supplier);
      setCatalog(data.data.catalog || []);
      setPerformance(data.data.performance || null);
      setRecentOrders(data.data.recentOrders || []);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [supplierId]);

  useEffect(() => {
    fetchSupplierDetail();
  }, [fetchSupplierDetail]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

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
        <button
          type="button"
          onClick={() => router.push(`/supplier/suppliers/${supplierId}/edit`)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Edit Supplier
        </button>
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
          <div className="grid grid-cols-3 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600">On-Time Delivery</p>
              <p className="text-3xl font-bold text-blue-600">{performance.onTimeDeliveryPercentage}%</p>
              <p className="text-xs text-gray-500 mt-1">{performance.ordersCompleted30Days} orders</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-sm text-gray-600">Quality Score</p>
              <p className="text-3xl font-bold text-purple-600">{performance.qualityScore}%</p>
              <p className="text-xs text-gray-500 mt-1">Based on inspections</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm text-gray-600">Trend</p>
              <p className={`text-2xl font-bold ${getTrendColor(performance.trend)}`}>{performance.trend}</p>
              <p className="text-xs text-gray-500 mt-1">Avg lead: {performance.averageLeadTime}d</p>
            </div>
          </div>
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
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price per Unit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Min Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lead Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((entry) => (
                <tr key={entry.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{entry.materialName}</td>
                  <td className="px-4 py-3">€{parseFloat(entry.pricePerUnit).toFixed(2)}</td>
                  <td className="px-4 py-3">{entry.minOrderQuantity} units</td>
                  <td className="px-4 py-3">{entry.leadTimeDays} days</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/supplier/suppliers/${supplierId}/catalog/${entry.id}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
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
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PO Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{order.poNumber}</td>
                  <td className="px-4 py-3">€{parseFloat(order.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
