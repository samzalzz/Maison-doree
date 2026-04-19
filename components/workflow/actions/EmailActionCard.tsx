'use client'

import React from 'react'
import { Mail, AlertCircle, Hash } from 'lucide-react'
import type { WorkflowActionResponse, WorkflowStep, EmailResult } from '../workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailActionCardProps {
  action: WorkflowActionResponse
  step: WorkflowStep
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmailActionCard({ action, step }: EmailActionCardProps) {
  const payload = step.actionPayload ?? {}
  const payloadTo = (payload.to as string) ?? '—'
  const payloadSubject = (payload.subject as string) ?? null

  if (action.status === 'FAILED') {
    return (
      <div
        className="rounded-lg bg-red-50 border border-red-200 p-4"
        data-testid="email-card-failed"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Email Failed</p>
            <p className="text-xs text-red-600 break-words">
              {action.errorMessage ?? 'An error occurred while sending the email.'}
            </p>
          </div>
        </div>
        {payloadTo !== '—' && (
          <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-500">
            Intended recipient:{' '}
            <span className="font-mono" data-testid="email-failed-to">
              {payloadTo}
            </span>
          </div>
        )}
      </div>
    )
  }

  const result = (action.result ?? {}) as Partial<EmailResult>
  const to = result.to ?? payloadTo
  const subject = result.subject ?? payloadSubject
  const messageId = result.messageId ?? null
  const sentAt = result.sentAt ?? action.executedAt

  return (
    <div
      className="rounded-lg bg-teal-50 border border-teal-200 p-4 space-y-3"
      data-testid="email-card-completed"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-teal-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-teal-800">Email Sent</span>
      </div>

      {/* Recipient */}
      <div className="grid grid-cols-1 gap-1.5 text-xs">
        <div className="flex items-start gap-2">
          <span className="text-gray-500 w-14 flex-shrink-0">To</span>
          <span
            className="font-mono text-gray-800 break-all"
            data-testid="email-to"
          >
            {to}
          </span>
        </div>

        {subject && (
          <div className="flex items-start gap-2">
            <span className="text-gray-500 w-14 flex-shrink-0">Subject</span>
            <span
              className="text-gray-800 truncate"
              data-testid="email-subject"
            >
              {subject}
            </span>
          </div>
        )}

        {sentAt && (
          <div className="flex items-start gap-2">
            <span className="text-gray-500 w-14 flex-shrink-0">Sent at</span>
            <span className="text-gray-600">
              {new Date(sentAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Message ID */}
      {messageId && (
        <div className="pt-2 border-t border-teal-200 flex items-center gap-1.5 text-xs text-gray-500">
          <Hash className="w-3 h-3 text-teal-400" />
          <span>Message ID: </span>
          <span
            className="font-mono text-gray-700 truncate"
            data-testid="email-message-id"
          >
            {messageId}
          </span>
        </div>
      )}
    </div>
  )
}
