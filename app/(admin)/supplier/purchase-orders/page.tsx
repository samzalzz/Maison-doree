'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  totalAmount: string;
  status: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string | null;
  createdAt: string;
}

interface POStats {
  total: number;
  pending: number;
}

const getPOStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'APPROVED':
      return 'bg-blue-100 text-blue-800';
    case 'SHIPPED':
      return 'bg-purple-100 text-purple-800';
    case 'RECEIVED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function POTrackingPage() {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<POStats>({ total: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPOs = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/supplier/purchase-orders?${params}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch purchase orders');

      const data = await response.json();
      setPurchaseOrders(data.data.purchaseOrders || []);
      setStats(data.data.stats || { total: 0, pending: 0 });
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPOs(controller.signal);
    return () => controller.abort();
  }, [fetchPOs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Purchase Orders</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-4xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Pending Approval</p>
          <p className="text-4xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="search-po" className="block text-sm font-medium mb-2">
              Search
            </label>
            <input
              id="search-po"
              type="text"
              placeholder="Search by PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="w-48">
            <label htmlFor="status-filter" className="block text-sm font-medium mb-2">
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              aria-label="Status"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="SHIPPED">Shipped</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && (
          <div className="p-6 text-center">Loading purchase orders...</div>
        )}
        {error && (
          <div className="p-6 text-center text-red-600">Error: {error}</div>
        )}

        {!loading && purchaseOrders.length === 0 && !error && (
          <div className="p-6 text-center text-gray-500">No purchase orders found</div>
        )}

        {!loading && purchaseOrders.length > 0 && (
          <table className="w-full">
            <caption className="sr-only">Purchase Orders</caption>
            <thead className="bg-gray-50 border-b">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  PO #
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Supplier
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Material
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Qty
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Amount
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Expected
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Actual
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/supplier/suppliers/${po.supplierId}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {po.supplierName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{po.materialName}</td>
                  <td className="px-4 py-3">
                    {po.quantity} {po.unit}
                  </td>
                  <td className="px-4 py-3">
                    &euro;{parseFloat(po.totalAmount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getPOStatusBadgeColor(po.status)}`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(po.expectedDeliveryDate).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {po.actualDeliveryDate
                      ? new Date(po.actualDeliveryDate).toLocaleDateString('en-US')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/supplier/purchase-orders/${po.id}`)
                      }
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
