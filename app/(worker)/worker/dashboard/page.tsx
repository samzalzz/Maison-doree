'use client';

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useToast } from '@/lib/hooks/useToast';
import { Skeleton } from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchAssignment {
  id: string;
  status: string;
  assignedAt: string;
}

interface MyBatch {
  id: string;
  batchNumber: string;
  recipe: { id: string; name: string };
  quantity: number;
  status: string;
  plannedStartTime?: string;
  estimatedCompletionTime?: string;
  actualCompletionTime?: string;
  actualStartTime?: string;
  lab?: { id: string; name: string };
  assignment: BatchAssignment;
}

interface LabBatch {
  id: string;
  batchNumber: string;
  recipe: { id: string; name: string };
  assignedWorker?: { id: string; name: string } | null;
  status: string;
}

interface DashboardStats {
  myAssignedToday: number;
  myCompletedToday: number;
  labTotalInProgress: number;
  labTotalCompleted: number;
}

interface DashboardData {
  myBatches: MyBatch[];
  labBatches: LabBatch[];
  stats: DashboardStats;
}

interface CompletionFormState {
  actualQuantity: string;
  notes: string;
  actualCompletionTime: string;
}

// ---------------------------------------------------------------------------
// Time formatting utilities
// ---------------------------------------------------------------------------

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  const minutes = diff / 60000;
  if (minutes < 60) return `in ${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `in ${Math.round(hours)}h`;
  return `in ${Math.round(hours / 24)}d`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = diff / 60000;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isSameDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED': return 'bg-green-100 text-green-800';
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
    case 'PAUSED': return 'bg-yellow-100 text-yellow-800';
    case 'PLANNED': return 'bg-gray-100 text-gray-700';
    case 'CANCELLED': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function humanStatus(status: string): string {
  switch (status) {
    case 'IN_PROGRESS': return 'In Progress';
    case 'PLANNED': return 'Planned';
    case 'COMPLETED': return 'Completed';
    case 'PAUSED': return 'Paused';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
}

// ---------------------------------------------------------------------------
// Batch Completion Modal
// ---------------------------------------------------------------------------

interface CompletionModalProps {
  batch: MyBatch;
  onClose: () => void;
  onSuccess: () => void;
}

function CompletionModal({ batch, onClose, onSuccess }: CompletionModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CompletionFormState>({
    actualQuantity: String(batch.quantity),
    notes: '',
    actualCompletionTime: toLocalDatetimeValue(new Date()),
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError(null);
  };

  const validate = (): string | null => {
    const qty = Number(form.actualQuantity);
    if (!form.actualQuantity || isNaN(qty) || qty <= 0) {
      return 'Actual quantity must be a positive number.';
    }
    if (qty > batch.quantity) {
      return `Actual quantity cannot exceed planned quantity (${batch.quantity}).`;
    }
    if (!form.actualCompletionTime) {
      return 'Completion time is required.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const completionTime = new Date(form.actualCompletionTime).toISOString();

      const response = await fetch(`/api/admin/production/batches/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          actualCompletionTime: completionTime,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const msg = result?.error?.message ?? 'Failed to mark batch as complete.';
        setFormError(msg);
        toastError({ title: 'Update failed', message: msg });
        return;
      }

      toastSuccess({ title: 'Batch completed!', message: `${batch.batchNumber} has been marked as complete.` });
      onSuccess();
    } catch {
      const msg = 'An unexpected error occurred. Please try again.';
      setFormError(msg);
      toastError({ title: 'Error', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              Mark Batch Complete
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{batch.batchNumber} — {batch.recipe.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="actualQuantity" className="block text-sm font-medium text-gray-700 mb-1">
              Actual Quantity Produced <span className="text-red-500">*</span>
            </label>
            <input
              id="actualQuantity"
              name="actualQuantity"
              type="number"
              min="1"
              max={batch.quantity}
              value={form.actualQuantity}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Planned quantity: {batch.quantity}</p>
          </div>

          <div>
            <label htmlFor="actualCompletionTime" className="block text-sm font-medium text-gray-700 mb-1">
              Completion Time <span className="text-red-500">*</span>
            </label>
            <input
              id="actualCompletionTime"
              name="actualCompletionTime"
              type="datetime-local"
              value={form.actualCompletionTime}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              placeholder="Any remarks about this batch..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {submitting ? 'Saving...' : 'Mark Complete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <Skeleton className="h-4 w-40 mb-3" />
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derived metric helpers (client-side, from myBatches data)
// ---------------------------------------------------------------------------

interface TimeMetrics {
  hoursWorkedToday: number;
  batchesCompletedToday: number;
  avgMinutesPerBatch: number | null;
}

function computeTimeMetrics(batches: MyBatch[]): TimeMetrics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedToday = batches.filter((b) => {
    if (b.status !== 'COMPLETED' || !b.actualCompletionTime) return false;
    return isSameDay(b.actualCompletionTime);
  });

  let totalMinutes = 0;
  let counted = 0;

  for (const b of completedToday) {
    if (b.actualStartTime && b.actualCompletionTime) {
      const start = new Date(b.actualStartTime).getTime();
      const end = new Date(b.actualCompletionTime).getTime();
      const diff = (end - start) / 60000;
      if (diff > 0) {
        totalMinutes += diff;
        counted++;
      }
    }
  }

  return {
    hoursWorkedToday: totalMinutes / 60,
    batchesCompletedToday: completedToday.length,
    avgMinutesPerBatch: counted > 0 ? totalMinutes / counted : null,
  };
}

interface PerformanceMetrics {
  onTimeRate: number | null;
  avgCycleMinutes: number | null;
  completedThisWeek: number;
}

function computePerformanceMetrics(batches: MyBatch[]): PerformanceMetrics {
  const weekStart = startOfWeek(new Date());

  const allCompleted = batches.filter((b) => b.status === 'COMPLETED');

  const completedThisWeek = allCompleted.filter((b) => {
    if (!b.actualCompletionTime) return false;
    return new Date(b.actualCompletionTime) >= weekStart;
  }).length;

  const withEstimate = allCompleted.filter(
    (b) => b.estimatedCompletionTime && b.actualCompletionTime
  );

  const onTimeBatches = withEstimate.filter((b) => {
    const actual = new Date(b.actualCompletionTime!).getTime();
    const estimated = new Date(b.estimatedCompletionTime!).getTime();
    return actual <= estimated;
  });

  const onTimeRate =
    withEstimate.length > 0 ? (onTimeBatches.length / withEstimate.length) * 100 : null;

  const withCycle = allCompleted.filter(
    (b) => b.plannedStartTime && b.actualCompletionTime
  );

  let totalCycleMinutes = 0;
  for (const b of withCycle) {
    const start = new Date(b.plannedStartTime!).getTime();
    const end = new Date(b.actualCompletionTime!).getTime();
    totalCycleMinutes += (end - start) / 60000;
  }

  const avgCycleMinutes = withCycle.length > 0 ? totalCycleMinutes / withCycle.length : null;

  return { onTimeRate, avgCycleMinutes, completedThisWeek };
}

interface ActivityItem {
  batchNumber: string;
  action: string;
  time: string;
  status: string;
}

function buildActivityTimeline(batches: MyBatch[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const b of batches) {
    if (b.actualCompletionTime) {
      items.push({
        batchNumber: b.batchNumber,
        action: 'marked complete',
        time: b.actualCompletionTime,
        status: 'COMPLETED',
      });
    }
    if (b.actualStartTime) {
      items.push({
        batchNumber: b.batchNumber,
        action: 'started',
        time: b.actualStartTime,
        status: 'IN_PROGRESS',
      });
    }
    if (b.assignment?.assignedAt) {
      items.push({
        batchNumber: b.batchNumber,
        action: 'assigned',
        time: b.assignment.assignedAt,
        status: 'PLANNED',
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function WorkerDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { error: toastError } = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [timeRange, setTimeRange] = useState('Today');
  const [completingBatch, setCompletingBatch] = useState<MyBatch | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (
      status === 'authenticated' &&
      (session?.user?.role as string) !== 'WORKER' &&
      (session?.user?.role as string) !== 'MANAGER'
    ) {
      router.push('/admin/production/dashboard');
    }
  }, [status, session, router]);

  const fetchDashboard = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const response = await fetch('/api/worker/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      setData(result.data);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      setError(msg);
      toastError({ title: 'Refresh failed', message: msg });
    } finally {
      setLoading(false);
    }
  }, [status, toastError]);

  // Initial fetch + 30s auto-refresh
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleCompletionSuccess = useCallback(() => {
    setCompletingBatch(null);
    fetchDashboard();
  }, [fetchDashboard]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => <KpiCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && !data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-700 font-semibold">Error loading dashboard</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchDashboard(); }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const filteredMyBatches = data.myBatches.filter((b) => {
    if (statusFilter !== 'All' && b.assignment.status !== statusFilter) return false;
    if (timeRange === 'Today') {
      const assignedAt = new Date(b.assignment.assignedAt);
      return isSameDay(assignedAt.toISOString());
    }
    // "This Week"
    const weekStart = startOfWeek(new Date());
    return new Date(b.assignment.assignedAt) >= weekStart;
  });

  const actionableBatches = data.myBatches.filter(
    (b) => b.status === 'IN_PROGRESS' || b.status === 'PAUSED'
  );

  const upcomingBatches = data.myBatches
    .filter((b) => b.status === 'PLANNED' && b.plannedStartTime)
    .sort((a, b) => new Date(a.plannedStartTime!).getTime() - new Date(b.plannedStartTime!).getTime())
    .slice(0, 3);

  const timeMetrics = computeTimeMetrics(data.myBatches);
  const perfMetrics = computePerformanceMetrics(data.myBatches);
  const activityTimeline = buildActivityTimeline(data.myBatches);

  const productivityScore =
    timeMetrics.hoursWorkedToday > 0
      ? Math.min(100, Math.round((timeMetrics.batchesCompletedToday / Math.max(timeMetrics.hoursWorkedToday, 1)) * 25))
      : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Batch Completion Modal */}
      {completingBatch && (
        <CompletionModal
          batch={completingBatch}
          onClose={() => setCompletingBatch(null)}
          onSuccess={handleCompletionSuccess}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}! Here's your production overview.
              </p>
            </div>
            <div className="text-xs text-gray-400 text-right mt-1">
              Auto-refreshes every 30s
              {lastFetchRef.current > 0 && (
                <span className="block">Last updated: {new Date(lastFetchRef.current).toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 1: Core Stats Cards                                        */}
          {/* ----------------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">My Assignments Today</div>
              <div className="mt-2 text-3xl font-bold text-amber-600">{data.stats.myAssignedToday}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Completed Today</div>
              <div className="mt-2 text-3xl font-bold text-green-600">{data.stats.myCompletedToday}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Lab In Progress</div>
              <div className="mt-2 text-3xl font-bold text-blue-600">{data.stats.labTotalInProgress}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-600">Lab Completed</div>
              <div className="mt-2 text-3xl font-bold text-purple-600">{data.stats.labTotalCompleted}</div>
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 2: Time Tracking Widget                                    */}
          {/* ----------------------------------------------------------------- */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Time Tracking — Today</h2>
            </div>
            {timeMetrics.batchesCompletedToday === 0 ? (
              <p className="text-gray-500 text-sm">0h — no batches completed yet today.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hours Worked</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {timeMetrics.hoursWorkedToday > 0
                      ? formatDuration(timeMetrics.hoursWorkedToday * 60)
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">from completed batches</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Batches Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{timeMetrics.batchesCompletedToday}</p>
                  <p className="text-xs text-gray-400 mt-0.5">today</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Time / Batch</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {timeMetrics.avgMinutesPerBatch !== null
                      ? formatDuration(timeMetrics.avgMinutesPerBatch)
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">per completed batch</p>
                </div>
              </div>
            )}
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 3: Performance KPI Cards                                   */}
          {/* ----------------------------------------------------------------- */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Stats</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* On-time completion rate */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {perfMetrics.onTimeRate !== null ? `${Math.round(perfMetrics.onTimeRate)}%` : '—'}
                </p>
                <p className="text-sm font-medium text-gray-500 mt-1">On-time Completion Rate</p>
                {perfMetrics.onTimeRate === null && (
                  <p className="text-xs text-gray-400 mt-0.5">No data yet</p>
                )}
              </div>

              {/* Avg cycle time */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M17 2.1l4 4-4 4" />
                      <path d="M3 12.2v-2a4 4 0 014-4h12.8" />
                      <path d="M7 21.9l-4-4 4-4" />
                      <path d="M21 11.8v2a4 4 0 01-4 4H4.2" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {perfMetrics.avgCycleMinutes !== null ? formatDuration(perfMetrics.avgCycleMinutes) : '—'}
                </p>
                <p className="text-sm font-medium text-gray-500 mt-1">Avg Batch Cycle Time</p>
                {perfMetrics.avgCycleMinutes === null && (
                  <p className="text-xs text-gray-400 mt-0.5">No completed batches</p>
                )}
              </div>

              {/* Completed this week */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{perfMetrics.completedThisWeek}</p>
                <p className="text-sm font-medium text-gray-500 mt-1">Completed This Week</p>
                <p className="text-xs text-gray-400 mt-0.5">since Monday</p>
              </div>

              {/* Productivity score */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {productivityScore !== null ? `${productivityScore}/100` : '—'}
                </p>
                <p className="text-sm font-medium text-gray-500 mt-1">Productivity Score</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {productivityScore !== null ? 'batches per hour (today)' : 'No data yet'}
                </p>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 4: Filters                                                 */}
          {/* ----------------------------------------------------------------- */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
                >
                  <option value="All">All</option>
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PAUSED">Paused</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 text-sm"
                >
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                </select>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 5: My Assignments Table (with Mark Complete)               */}
          {/* ----------------------------------------------------------------- */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">My Assignments</h2>
                {actionableBatches.length > 0 && (
                  <p className="text-sm text-amber-600 mt-0.5 font-medium">
                    {actionableBatches.length} batch{actionableBatches.length > 1 ? 'es' : ''} ready to complete
                  </p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Batch #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Recipe</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMyBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        {statusFilter !== 'All' || timeRange !== 'Today'
                          ? 'No assignments match the current filters.'
                          : 'No assignments yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredMyBatches.map((batch) => {
                      const isActionable = batch.status === 'IN_PROGRESS' || batch.status === 'PAUSED';
                      return (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">{batch.batchNumber}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{batch.recipe.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{batch.quantity}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(batch.assignment.status)}`}>
                              {humanStatus(batch.assignment.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-3">
                              <a
                                href={`/worker/batches/${batch.id}`}
                                className="text-amber-600 hover:text-amber-700 font-medium"
                              >
                                View
                              </a>
                              {isActionable && (
                                <button
                                  type="button"
                                  onClick={() => setCompletingBatch(batch)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-5.121-5.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Mark Complete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 6: Two-column — Upcoming Batches + Recent Activity          */}
          {/* ----------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Upcoming Batches */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Batches</h2>
                <p className="text-sm text-gray-500 mt-0.5">Next scheduled work</p>
              </div>
              <div className="divide-y divide-gray-100">
                {upcomingBatches.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500 text-sm">
                    No upcoming batches scheduled.
                  </div>
                ) : (
                  upcomingBatches.map((batch) => (
                    <div key={batch.id} className="px-6 py-4 flex items-start justify-between hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 font-mono">{batch.batchNumber}</p>
                        <p className="text-sm text-gray-600 truncate">{batch.recipe.name}</p>
                        {batch.lab && (
                          <p className="text-xs text-gray-400 mt-0.5">{batch.lab.name}</p>
                        )}
                        {batch.plannedStartTime && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(batch.plannedStartTime).toLocaleString([], {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(batch.status)}`}>
                          {humanStatus(batch.status)}
                        </span>
                        {batch.plannedStartTime && (
                          <span className="text-xs font-medium text-amber-600">
                            {timeUntil(batch.plannedStartTime)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <p className="text-sm text-gray-500 mt-0.5">Your latest batch actions</p>
              </div>
              <div className="px-6 py-4">
                {activityTimeline.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-4">No recent activity recorded.</p>
                ) : (
                  <ol className="relative border-l border-gray-200 space-y-0" aria-label="Recent activity">
                    {activityTimeline.map((item, idx) => (
                      <li key={idx} className="mb-5 ml-4">
                        <div
                          className={`absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white ${
                            item.status === 'COMPLETED'
                              ? 'bg-green-500'
                              : item.status === 'IN_PROGRESS'
                              ? 'bg-blue-500'
                              : 'bg-gray-400'
                          }`}
                          aria-hidden="true"
                        />
                        <p className="text-sm text-gray-800">
                          <span className="font-semibold font-mono">{item.batchNumber}</span>{' '}
                          <span className="text-gray-600">{item.action}</span>{' '}
                          <span className="font-medium">at {formatTime(item.time)}</span>
                        </p>
                        <time
                          dateTime={item.time}
                          className="text-xs text-gray-400 mt-0.5 block"
                        >
                          {timeAgo(item.time)}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* Section 7: Lab Batches Table                                       */}
          {/* ----------------------------------------------------------------- */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Lab Batches (All)</h2>
              <p className="text-sm text-gray-600 mt-1">View what your team is working on</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Batch #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Recipe</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Worker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.labBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No lab batches
                      </td>
                    </tr>
                  ) : (
                    data.labBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">{batch.batchNumber}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{batch.recipe.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{batch.assignedWorker?.name ?? '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(batch.status)}`}>
                            {humanStatus(batch.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <a
                            href={`/worker/batches/${batch.id}`}
                            className="text-amber-600 hover:text-amber-700 font-medium"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
