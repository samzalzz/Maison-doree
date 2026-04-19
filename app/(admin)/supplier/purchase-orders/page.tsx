'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------

interface POSuggestion {
  id: string;
  labId: string;
  labName: string;
  materialId: string;
  materialName: string;
  suggestedQuantity: number;
  bestSupplierId: string;
  bestSupplierName: string;
  expiresAt: string; // ISO date
}

interface ActivePO {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  expectedDeliveryDate: string;
  actualDeliveryDate: string | null;
  status: string; // PENDING, APPROVED, SHIPPED, RECEIVED
  isOverdue: boolean;
}

interface CompletedDelivery {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialName: string;
  orderedQuantity: number;
  receivedQuantity: number;
  deliveryDate: string;
  qcResult: string; // PASS, FAIL, PENDING
  isOnTime: boolean;
}

type ActiveTab = 'PENDING' | 'ACTIVE' | 'HISTORY';

type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function getDaysRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

function getStatusBadgeClass(status: string): string {
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
}

function getQcResultClass(qcResult: string): string {
  switch (qcResult) {
    case 'PASS':
      return 'text-green-700 font-semibold';
    case 'FAIL':
      return 'text-red-700 font-semibold';
    default:
      return 'text-gray-500';
  }
}

// ---------------------------------------------------------------------------
// Approve Modal
// ---------------------------------------------------------------------------

interface ApproveModalProps {
  suggestion: POSuggestion;
  onClose: () => void;
  onConfirm: (supplierId: string, quantity: number) => Promise<void>;
  isSubmitting: boolean;
}

function ApproveModal({ suggestion, onClose, onConfirm, isSubmitting }: ApproveModalProps) {
  const [quantity, setQuantity] = useState(suggestion.suggestedQuantity);
  const [supplierId, setSupplierId] = useState(suggestion.bestSupplierId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="approve-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 id="approve-modal-title" className="text-lg font-semibold mb-4">
          Approve Purchase Order
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Material: <span className="font-medium">{suggestion.materialName}</span>
        </p>
        <div className="mb-4">
          <label htmlFor="approve-supplier" className="block text-sm font-medium mb-1">
            Supplier
          </label>
          <input
            id="approve-supplier"
            type="text"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="approve-quantity" className="block text-sm font-medium mb-1">
            Quantity
          </label>
          <input
            id="approve-quantity"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(supplierId, quantity)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Approving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reject Modal
// ---------------------------------------------------------------------------

interface RejectModalProps {
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting: boolean;
}

function RejectModal({ onClose, onConfirm, isSubmitting }: RejectModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 id="reject-modal-title" className="text-lg font-semibold mb-4">
          Reject Suggestion
        </h2>
        <div className="mb-6">
          <label htmlFor="reject-reason" className="block text-sm font-medium mb-1">
            Reason for rejection
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Enter rejection reason..."
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting || !reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mark Received Modal
// ---------------------------------------------------------------------------

interface MarkReceivedModalProps {
  po: ActivePO;
  onClose: () => void;
  onConfirm: (actualDeliveryDate: string) => Promise<void>;
  isSubmitting: boolean;
}

function MarkReceivedModal({ po, onClose, onConfirm, isSubmitting }: MarkReceivedModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-received-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 id="mark-received-modal-title" className="text-lg font-semibold mb-4">
          Mark as Received
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          PO: <span className="font-medium">{po.poNumber}</span>
        </p>
        <div className="mb-6">
          <label htmlFor="received-date" className="block text-sm font-medium mb-1">
            Actual Delivery Date
          </label>
          <input
            id="received-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(`${date}T00:00:00Z`)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cancel Modal
// ---------------------------------------------------------------------------

interface CancelModalProps {
  po: ActivePO;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  isSubmitting: boolean;
}

function CancelModal({ po, onClose, onConfirm, isSubmitting }: CancelModalProps) {
  const [reason, setReason] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h2 id="cancel-modal-title" className="text-lg font-semibold mb-4">
          Cancel Order
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Cancel PO <span className="font-medium">{po.poNumber}</span>?
        </p>
        <div className="mb-6">
          <label htmlFor="cancel-reason" className="block text-sm font-medium mb-1">
            Reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Enter cancellation reason..."
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function POTrackingPage() {
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('PENDING');

  // Stats
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  // Tab A: Pending Approvals
  const [suggestions, setSuggestions] = useState<POSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  // Tab B: Active Orders
  const [activeOrders, setActiveOrders] = useState<ActivePO[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);

  // Tab C: Delivery History
  const [history, setHistory] = useState<CompletedDelivery[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historySortBy, setHistorySortBy] = useState('deliveryDate');
  const [historySortOrder, setHistorySortOrder] = useState<SortOrder>('desc');

  // Modal states
  const [approvingSuggestion, setApprovingSuggestion] = useState<POSuggestion | null>(null);
  const [rejectingSuggestion, setRejectingSuggestion] = useState<POSuggestion | null>(null);
  const [markingReceived, setMarkingReceived] = useState<ActivePO | null>(null);
  const [cancellingPO, setCancellingPO] = useState<ActivePO | null>(null);

  // Action in-flight flags
  const [actionLoading, setActionLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch('/api/supplier/po-tracking/suggestions');
      if (!res.ok) throw new Error('Failed to load pending approvals');
      const json = await res.json();
      setSuggestions(json.data.suggestions ?? []);
      setPendingApprovalCount(json.data.stats?.pendingApproval ?? 0);
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  const fetchActiveOrders = useCallback(async () => {
    setActiveLoading(true);
    setActiveError(null);
    try {
      const res = await fetch('/api/supplier/po-tracking/active');
      if (!res.ok) throw new Error('Failed to load active orders');
      const json = await res.json();
      setActiveOrders(json.data.activeOrders ?? []);
      setActiveOrdersCount(json.data.stats?.activeOrders ?? 0);
      setOverdueCount(json.data.stats?.overdue ?? 0);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActiveLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params = new URLSearchParams();
      if (historySearch) params.set('search', historySearch);
      params.set('sortBy', historySortBy);
      params.set('order', historySortOrder);
      const res = await fetch(`/api/supplier/po-tracking/history?${params}`);
      if (!res.ok) throw new Error('Failed to load delivery history');
      const json = await res.json();
      setHistory(json.data.history ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historySortBy, historySortOrder]);

  // Fetch data when tab becomes active (or search/sort changes for history)
  useEffect(() => {
    if (activeTab === 'PENDING') fetchSuggestions();
  }, [activeTab, fetchSuggestions]);

  useEffect(() => {
    if (activeTab === 'ACTIVE') fetchActiveOrders();
  }, [activeTab, fetchActiveOrders]);

  useEffect(() => {
    if (activeTab === 'HISTORY') fetchHistory();
  }, [activeTab, fetchHistory]);

  // Also fetch stats for the stats bar on first load
  useEffect(() => {
    fetchSuggestions();
    fetchActiveOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleApprove = async (supplierId: string, quantity: number) => {
    if (!approvingSuggestion) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/supplier/po-tracking/suggestions/${approvingSuggestion.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supplierId, quantity }),
        }
      );
      if (!res.ok) throw new Error('Failed to approve suggestion');
      setApprovingSuggestion(null);
      fetchSuggestions();
      fetchActiveOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectingSuggestion) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/supplier/po-tracking/suggestions/${rejectingSuggestion.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) throw new Error('Failed to reject suggestion');
      setRejectingSuggestion(null);
      fetchSuggestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async (actualDeliveryDate: string) => {
    if (!markingReceived) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/supplier/purchase-orders/${markingReceived.id}/mark-received`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actualDeliveryDate }),
        }
      );
      if (!res.ok) throw new Error('Failed to mark as received');
      setMarkingReceived(null);
      fetchActiveOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark received');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!cancellingPO) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/supplier/purchase-orders/${cancellingPO.id}/cancel`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) throw new Error('Failed to cancel order');
      setCancellingPO(null);
      fetchActiveOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setActionLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // History sort toggle
  // ---------------------------------------------------------------------------

  const handleHistorySort = (column: string) => {
    if (historySortBy === column) {
      setHistorySortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setHistorySortBy(column);
      setHistorySortOrder('asc');
    }
  };

  const sortIndicator = (column: string) => {
    if (historySortBy !== column) return ' ';
    return historySortOrder === 'asc' ? ' \u25b2' : ' \u25bc';
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Purchase Order Tracking</h1>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Pending Approval</p>
          <p className="text-4xl font-bold text-yellow-600" data-testid="stat-pending">
            {pendingApprovalCount}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Active Orders</p>
          <p className="text-4xl font-bold text-blue-600" data-testid="stat-active">
            {activeOrdersCount}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600">Overdue</p>
          <p className="text-4xl font-bold text-red-600" data-testid="stat-overdue">
            {overdueCount}
          </p>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PENDING'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          aria-selected={activeTab === 'PENDING'}
          role="tab"
        >
          Pending Approvals
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'ACTIVE'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          aria-selected={activeTab === 'ACTIVE'}
          role="tab"
        >
          Active Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('HISTORY')}
          className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'HISTORY'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
          aria-selected={activeTab === 'HISTORY'}
          role="tab"
        >
          Delivery History
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB A: Pending Approvals                                             */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'PENDING' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {suggestionsLoading && (
            <div role="status" className="p-6 text-center text-gray-500">
              Loading pending approvals...
            </div>
          )}
          {suggestionsError && !suggestionsLoading && (
            <div className="p-6 text-center">
              <p className="text-red-600 mb-3">{suggestionsError}</p>
              <button
                type="button"
                onClick={fetchSuggestions}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          )}
          {!suggestionsLoading && !suggestionsError && suggestions.length === 0 && (
            <div className="p-6 text-center text-gray-500">No pending approvals</div>
          )}
          {!suggestionsLoading && !suggestionsError && suggestions.length > 0 && (
            <table className="w-full">
              <caption className="sr-only">Pending PO Suggestions</caption>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lab</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Suggested Qty</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Best Supplier</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expires In</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr key={suggestion.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{suggestion.labName}</td>
                    <td className="px-4 py-3">{suggestion.materialName}</td>
                    <td className="px-4 py-3">{suggestion.suggestedQuantity}</td>
                    <td className="px-4 py-3">{suggestion.bestSupplierName}</td>
                    <td className="px-4 py-3 text-sm">{getDaysRemaining(suggestion.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setApprovingSuggestion(suggestion)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingSuggestion(suggestion)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB B: Active Orders                                                 */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'ACTIVE' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {activeLoading && (
            <div role="status" className="p-6 text-center text-gray-500">
              Loading active orders...
            </div>
          )}
          {activeError && !activeLoading && (
            <div className="p-6 text-center">
              <p className="text-red-600 mb-3">{activeError}</p>
              <button
                type="button"
                onClick={fetchActiveOrders}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          )}
          {!activeLoading && !activeError && activeOrders.length === 0 && (
            <div className="p-6 text-center text-gray-500">No active orders</div>
          )}
          {!activeLoading && !activeError && activeOrders.length > 0 && (
            <table className="w-full">
              <caption className="sr-only">Active Purchase Orders</caption>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PO #</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Material</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expected Delivery</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((po) => (
                  <tr
                    key={po.id}
                    data-testid={po.isOverdue ? 'overdue-row' : 'active-row'}
                    className={
                      po.isOverdue
                        ? 'border-b bg-red-50 border-l-4 border-red-500'
                        : 'border-b hover:bg-gray-50'
                    }
                  >
                    <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                    <td className="px-4 py-3">{po.supplierName}</td>
                    <td className="px-4 py-3">{po.materialName}</td>
                    <td className="px-4 py-3">
                      {po.quantity} {po.unit}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(po.expectedDeliveryDate).toLocaleDateString('en-US')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setMarkingReceived(po)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Mark Received
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/supplier/purchase-orders/${po.id}`)}
                          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancellingPO(po)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB C: Delivery History                                               */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <input
              type="text"
              placeholder="Search by PO number or supplier name..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              aria-label="Search delivery history"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {historyLoading && (
              <div role="status" className="p-6 text-center text-gray-500">
                Loading delivery history...
              </div>
            )}
            {historyError && !historyLoading && (
              <div className="p-6 text-center">
                <p className="text-red-600 mb-3">{historyError}</p>
                <button
                  type="button"
                  onClick={fetchHistory}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            )}
            {!historyLoading && !historyError && history.length === 0 && (
              <div className="p-6 text-center text-gray-500">No delivery history</div>
            )}
            {!historyLoading && !historyError && history.length > 0 && (
              <table className="w-full">
                <caption className="sr-only">Delivery History</caption>
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[
                      { key: 'poNumber', label: 'PO #' },
                      { key: 'supplierName', label: 'Supplier' },
                      { key: 'materialName', label: 'Material' },
                      { key: 'orderedQuantity', label: 'Qty' },
                      { key: 'deliveryDate', label: 'Delivery Date' },
                      { key: 'receivedQuantity', label: 'Received Qty' },
                      { key: 'qcResult', label: 'QC Result' },
                      { key: 'isOnTime', label: 'On-Time?' },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        scope="col"
                        onClick={() => handleHistorySort(key)}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        aria-sort={
                          historySortBy === key
                            ? historySortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        {label}{sortIndicator(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((delivery) => (
                    <tr key={delivery.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{delivery.poNumber}</td>
                      <td className="px-4 py-3">{delivery.supplierName}</td>
                      <td className="px-4 py-3">{delivery.materialName}</td>
                      <td className="px-4 py-3">{delivery.orderedQuantity}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(delivery.deliveryDate).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-3">{delivery.receivedQuantity}</td>
                      <td className={`px-4 py-3 text-sm ${getQcResultClass(delivery.qcResult)}`}>
                        {delivery.qcResult}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {delivery.isOnTime ? (
                          <span className="text-green-600 font-semibold" aria-label="On time">
                            &#10003;
                          </span>
                        ) : (
                          <span className="text-red-600 font-semibold" aria-label="Late">
                            &#10007;
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                               */}
      {/* ------------------------------------------------------------------ */}
      {approvingSuggestion && (
        <ApproveModal
          suggestion={approvingSuggestion}
          onClose={() => setApprovingSuggestion(null)}
          onConfirm={handleApprove}
          isSubmitting={actionLoading}
        />
      )}
      {rejectingSuggestion && (
        <RejectModal
          onClose={() => setRejectingSuggestion(null)}
          onConfirm={handleReject}
          isSubmitting={actionLoading}
        />
      )}
      {markingReceived && (
        <MarkReceivedModal
          po={markingReceived}
          onClose={() => setMarkingReceived(null)}
          onConfirm={handleMarkReceived}
          isSubmitting={actionLoading}
        />
      )}
      {cancellingPO && (
        <CancelModal
          po={cancellingPO}
          onClose={() => setCancellingPO(null)}
          onConfirm={handleCancel}
          isSubmitting={actionLoading}
        />
      )}
    </div>
  );
}
