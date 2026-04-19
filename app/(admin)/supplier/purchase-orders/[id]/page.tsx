'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface PODetail {
  id: string;
  poNumber: string;
  supplierName: string;
  materialName: string;
  quantity: number;
  unit: string;
  status: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string | null;
  isOverdue: boolean;
}

export default function PODetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [po, setPO] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/supplier/purchase-orders/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load purchase order');
        return res.json();
      })
      .then((json) => {
        setPO(json.data?.purchaseOrder ?? null);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back
        </button>
        <h1 className="text-3xl font-bold">Purchase Order Details</h1>
      </div>

      {loading && (
        <div role="status" className="p-6 text-center text-gray-500">
          Loading order details...
        </div>
      )}

      {error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && !po && (
        <div className="p-6 text-center text-gray-500">Purchase order not found</div>
      )}

      {!loading && !error && po && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">PO Number</p>
              <p className="font-semibold">{po.poNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-semibold">{po.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Supplier</p>
              <p className="font-semibold">{po.supplierName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Material</p>
              <p className="font-semibold">{po.materialName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Quantity</p>
              <p className="font-semibold">
                {po.quantity} {po.unit}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expected Delivery</p>
              <p className="font-semibold">
                {new Date(po.expectedDeliveryDate).toLocaleDateString('en-US')}
              </p>
            </div>
            {po.actualDeliveryDate && (
              <div>
                <p className="text-sm text-gray-500">Actual Delivery</p>
                <p className="font-semibold">
                  {new Date(po.actualDeliveryDate).toLocaleDateString('en-US')}
                </p>
              </div>
            )}
            {po.isOverdue && (
              <div className="col-span-2">
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  OVERDUE
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
