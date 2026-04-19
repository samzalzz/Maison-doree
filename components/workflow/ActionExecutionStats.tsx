'use client'

import React from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Timer,
  Activity,
} from 'lucide-react'
import type { WorkflowActionResponse, Workflow } from './workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionExecutionStatsProps {
  actions: WorkflowActionResponse[]
  workflow: Workflow
}

type OverallStatus = 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeOverallStatus(actions: WorkflowActionResponse[]): OverallStatus {
  if (actions.length === 0) return 'PENDING'
  if (actions.some((a) => a.status === 'IN_PROGRESS')) return 'RUNNING'
  if (actions.some((a) => a.status === 'FAILED')) return 'FAILED'
  if (actions.every((a) => a.status === 'COMPLETED')) return 'SUCCESS'
  return 'RUNNING'
}

function formatTotalDuration(actions: WorkflowActionResponse[]): string {
  const executed = actions.filter((a) => a.executedAt)
  if (executed.length === 0) return '—'

  const allTimes = actions.map((a) => new Date(a.createdAt).getTime())
  const endTimes = executed.map((a) => new Date(a.executedAt!).getTime())

  const earliest = Math.min(...allTimes)
  const latest = Math.max(...endTimes)
  const ms = latest - earliest
  if (ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60000)}m`
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

// ---------------------------------------------------------------------------
// Sub-component: stat cell
// ---------------------------------------------------------------------------

interface StatCellProps {
  label: string
  value: string | number
  Icon: React.ElementType
  iconClass: string
  valueClass?: string
  testId?: string
}

function StatCell({ label, value, Icon, iconClass, valueClass = 'text-gray-900', testId }: StatCellProps) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3"
      data-testid={testId}
    >
      <div className={`p-2 rounded-lg bg-gray-50 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
        <p className={`text-xl font-bold leading-none ${valueClass}`}>{value}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionExecutionStats({ actions, workflow }: ActionExecutionStatsProps) {
  const total = workflow.steps?.filter((s) => s.type === 'ACTION').length ?? actions.length
  const completed = actions.filter((a) => a.status === 'COMPLETED').length
  const failed = actions.filter((a) => a.status === 'FAILED').length
  const pending = actions.filter((a) => a.status === 'PENDING').length
  const inProgress = actions.filter((a) => a.status === 'IN_PROGRESS').length

  const overallStatus = computeOverallStatus(actions)
  const duration = formatTotalDuration(actions)

  // Find earliest start and latest end across all actions
  const sortedByCreated = [...actions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const startTime = sortedByCreated[0]?.createdAt ?? null
  const executedActions = actions.filter((a) => a.executedAt)
  const sortedByExecuted = [...executedActions].sort(
    (a, b) => new Date(b.executedAt!).getTime() - new Date(a.executedAt!).getTime(),
  )
  const endTime = sortedByExecuted[0]?.executedAt ?? null

  const OVERALL_STATUS_CONFIG: Record<
    OverallStatus,
    { label: string; bg: string; text: string; dot: string; Icon: React.ElementType }
  > = {
    SUCCESS: {
      label: 'All Steps Completed',
      bg: 'bg-green-50',
      text: 'text-green-800',
      dot: 'bg-green-500',
      Icon: CheckCircle2,
    },
    FAILED: {
      label: 'Execution Failed',
      bg: 'bg-red-50',
      text: 'text-red-800',
      dot: 'bg-red-500',
      Icon: XCircle,
    },
    RUNNING: {
      label: 'Execution Running',
      bg: 'bg-yellow-50',
      text: 'text-yellow-800',
      dot: 'bg-yellow-400',
      Icon: Activity,
    },
    PENDING: {
      label: 'Awaiting Execution',
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      dot: 'bg-gray-300',
      Icon: Clock,
    },
  }

  const overallCfg = OVERALL_STATUS_CONFIG[overallStatus]
  const OverallIcon = overallCfg.Icon

  return (
    <div className="space-y-4" data-testid="action-execution-stats">
      {/* Overall status banner */}
      <div
        className={`rounded-xl border ${overallCfg.bg} px-4 py-3 flex items-center gap-3`}
        data-testid="overall-status-banner"
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${overallCfg.dot}`} />
        <OverallIcon className={`w-4 h-4 flex-shrink-0 ${overallCfg.text}`} />
        <span className={`text-sm font-semibold ${overallCfg.text}`}>
          {overallCfg.label}
        </span>
        <span className="ml-auto text-xs text-gray-400">
          {workflow.name}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCell
          label="Total Steps"
          value={total}
          Icon={Layers}
          iconClass="text-gray-500"
          testId="stat-total"
        />
        <StatCell
          label="Completed"
          value={completed}
          Icon={CheckCircle2}
          iconClass="text-green-600"
          valueClass="text-green-700"
          testId="stat-completed"
        />
        <StatCell
          label="Failed"
          value={failed}
          Icon={XCircle}
          iconClass="text-red-500"
          valueClass={failed > 0 ? 'text-red-700' : 'text-gray-900'}
          testId="stat-failed"
        />
        <StatCell
          label={inProgress > 0 ? 'In Progress' : 'Pending'}
          value={inProgress > 0 ? inProgress : pending}
          Icon={inProgress > 0 ? Activity : Clock}
          iconClass={inProgress > 0 ? 'text-yellow-500' : 'text-gray-400'}
          testId="stat-pending"
        />
        <StatCell
          label="Duration"
          value={duration}
          Icon={Timer}
          iconClass="text-blue-500"
          testId="stat-duration"
        />
      </div>

      {/* Time range */}
      {(startTime || endTime) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <span>
            Start:{' '}
            <span className="font-medium text-gray-700">{formatTime(startTime)}</span>
          </span>
          <span>
            End:{' '}
            <span className="font-medium text-gray-700">{formatTime(endTime)}</span>
          </span>
          <span>
            Total duration:{' '}
            <span className="font-medium text-gray-700" data-testid="total-duration-text">
              {duration}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
