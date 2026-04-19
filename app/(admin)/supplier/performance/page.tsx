'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface SupplierPerformance {
  id: string;
  name: string;
  reliabilityScore: number;
  onTimePercentage: number;
  qualityScore: number;
  trend: string; // IMPROVING, STABLE, DECLINING
  riskLevel: string; // LOW, MEDIUM, HIGH
}

interface PerformanceDashboardData {
  totalSuppliers: number;
  averageReliability: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  riskCount: number;
  suppliers: SupplierPerformance[];
}

export default function PerformanceDashboardPage() {
  const [data, setData] = useState<PerformanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch('/api/supplier/performance', { signal });
      if (!response.ok) throw new Error('Failed to fetch performance data');

      const result = await response.json();
      setData(result.data);
      setError(null);
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
    fetchDashboard(controller.signal);
    return () => controller.abort();
  }, [fetchDashboard]);

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return 'text-green-600';
      case 'DECLINING':
        return 'text-red-600';
      case 'STABLE':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) return <div className="p-6 text-center">Loading performance data...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  if (!data) return <div className="p-6 text-center">No data available</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Performance Dashboard</h1>

      {/* Portfolio Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Total Suppliers</p>
          <p className="text-4xl font-bold text-blue-600">{data.totalSuppliers}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Avg Reliability</p>
          <p className="text-4xl font-bold text-purple-600">{data.averageReliability.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">On-Time Rate</p>
          <p className="text-4xl font-bold text-green-600">{data.onTimeDeliveryRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Quality Score</p>
          <p className="text-4xl font-bold text-pink-600">{data.qualityScore.toFixed(1)}%</p>
        </div>
      </div>

      {/* Risk Alert */}
      {data.riskCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-semibold">{data.riskCount} suppliers at risk</p>
          <p className="text-red-700 text-sm">Review their profiles and address quality or delivery issues</p>
        </div>
      )}

      {/* Supplier Performance Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Supplier Performance</h2>
        <div className="grid grid-cols-3 gap-4">
          {data.suppliers.map((supplier) => (
            <Link key={supplier.id} href={`/supplier/suppliers/${supplier.id}`}>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg cursor-pointer transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold">{supplier.name}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskBadgeColor(supplier.riskLevel)}`}
                  >
                    {supplier.riskLevel}
                  </span>
                </div>

                {/* Metrics */}
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-xs text-gray-600">Reliability Score</p>
                    <p className="text-2xl font-bold text-purple-600">{supplier.reliabilityScore}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">On-Time Delivery</p>
                    <p className="text-xl font-semibold text-green-600">{supplier.onTimePercentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Quality Score</p>
                    <p className="text-xl font-semibold text-pink-600">{supplier.qualityScore}%</p>
                  </div>
                </div>

                {/* Trend */}
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600">30-Day Trend</p>
                  <p className={`text-lg font-semibold ${getTrendColor(supplier.trend)}`}>{supplier.trend}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
