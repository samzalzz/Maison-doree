'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// Note: reliabilityScore is not on the Prisma Supplier model — it is
// returned from the supplier API as a computed/joined field.
// ---------------------------------------------------------------------------

interface SupplierListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  reliabilityScore?: number | null;
}

export default function SupplierListPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchTerm]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/supplier/suppliers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch suppliers');

      const data = await response.json();
      setSuppliers(data.data.suppliers || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleAddSupplier = () => {
    router.push('/supplier/suppliers/new');
  };

  const handleRowClick = (supplierId: string) => {
    router.push(`/supplier/suppliers/${supplierId}`);
  };

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

  const getReliabilityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Suppliers</h1>
        <button
          onClick={handleAddSupplier}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="w-48">
              <label
                htmlFor="status-filter"
                className="block text-sm font-medium mb-2"
              >
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                aria-label="Status"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="p-4 text-center">Loading suppliers...</div>
        )}
        {error && (
          <div className="p-4 text-center text-red-600">Error: {error}</div>
        )}

        {!loading && suppliers.length === 0 && !error && (
          <div className="p-4 text-center text-gray-500">
            No suppliers found
          </div>
        )}

        {!loading && suppliers.length > 0 && (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Supplier Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Reliability Score
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  onClick={() => handleRowClick(supplier.id)}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm font-medium">
                    {supplier.name}
                  </td>
                  <td className="px-6 py-4 text-sm">{supplier.email}</td>
                  <td className="px-6 py-4 text-sm">
                    {supplier.phone || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(supplier.status)}`}
                    >
                      {supplier.status}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-sm font-semibold ${getReliabilityColor(supplier.reliabilityScore ?? 0)}`}
                  >
                    {supplier.reliabilityScore != null
                      ? `${supplier.reliabilityScore.toFixed(1)}%`
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <Link
                      href={`/supplier/suppliers/${supplier.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </Link>
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
