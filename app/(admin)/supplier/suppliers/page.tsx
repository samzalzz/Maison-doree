'use client';

import { useCallback, useDeferredValue, useEffect, useState } from 'react';
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

  // Defer search input so rapid keystrokes don't fire an API call on every
  // character; React 18 schedules the deferred value at lower priority.
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // MAJOR FIX 1: wrap in useCallback so the function reference is stable and
  // can be listed as a useEffect dependency without causing infinite loops.
  // MAJOR FIX 2: AbortController cancels in-flight requests when a newer one
  // starts, preventing stale responses from overwriting fresh data.
  const fetchSuppliers = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (deferredSearchTerm) params.append('search', deferredSearchTerm);

      const response = await fetch(`/api/supplier/suppliers?${params}`, {
        signal,
      });
      if (!response.ok) throw new Error('Failed to fetch suppliers');

      const data = await response.json();
      setSuppliers(data.data.suppliers || []);
      setError(null);
    } catch (err) {
      // Ignore abort errors — they are expected when the effect is cleaned up.
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, deferredSearchTerm]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchSuppliers(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchSuppliers]);

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
        {/* IMPORTANT FIX 8: type="button" prevents accidental form submission */}
        <button
          type="button"
          onClick={() => router.push('/supplier/suppliers/new')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
          Add Supplier
        </button>
      </div>

      {/* IMPORTANT FIX 7: card container matches codebase conventions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              {/* IMPORTANT FIX 10: label connected to input via htmlFor/id */}
              <label
                htmlFor="search-input"
                className="block text-sm font-medium mb-2"
              >
                Search
              </label>
              <input
                id="search-input"
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                onChange={(e) => setStatusFilter(e.target.value)}
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
            {/* IMPORTANT FIX 7: table headers match codebase conventions */}
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Supplier Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Reliability Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                // IMPORTANT FIX 11: removed dual navigation — row no longer has
                // onClick. Navigation is provided exclusively by the "View Details"
                // Link in the actions column.
                <tr
                  key={supplier.id}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-6 py-4 text-sm font-medium">
                    {supplier.name}
                  </td>
                  {/* MAJOR FIX 3: null guard matches phone column pattern */}
                  <td className="px-6 py-4 text-sm">{supplier.email || '-'}</td>
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
                  {/* IMPORTANT FIX 9: no color applied when score is null */}
                  <td
                    className={`px-6 py-4 text-sm font-semibold ${supplier.reliabilityScore != null ? getReliabilityColor(supplier.reliabilityScore) : ''}`}
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
