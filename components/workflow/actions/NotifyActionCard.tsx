'use client'

import React from 'react'
import { Bell, AlertCircle, MessageSquare } from 'lucide-react'
import type { WorkflowActionResponse, WorkflowStep, NotifyResult } from '../workflow-action-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotifyActionCardProps {
  action: WorkflowActionResponse
  step: WorkflowStep
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  slack: { bg: 'bg-purple-100', text: 'text-purple-700' },
  email: { bg: 'bg-blue-100', text: 'text-blue-700' },
  sms: { bg: 'bg-green-100', text: 'text-green-700' },
}

const DEFAULT_CHANNEL_COLOR = { bg: 'bg-gray-100', text: 'text-gray-600' }

function getChannelColor(channel: string) {
  return CHANNEL_COLORS[channel.toLowerCase()] ?? DEFAULT_CHANNEL_COLOR
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotifyActionCard({ action, step }: NotifyActionCardProps) {
  const payload = step.actionPayload ?? {}
  const message = (payload.message as string) ?? null
  const payloadChannels: string[] = Array.isArray(payload.channels)
    ? (payload.channels as string[])
    : []

  if (action.status === 'FAILED') {
    return (
      <div
        className="rounded-lg bg-red-50 border border-red-200 p-4"
        data-testid="notify-card-failed"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Notification Failed</p>
            <p className="text-xs text-red-600 break-words">
              {action.errorMessage ?? 'An error occurred while sending the notification.'}
            </p>
          </div>
        </div>
        {payloadChannels.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-200 flex flex-wrap gap-1">
            {payloadChannels.map((ch) => {
              const colors = getChannelColor(ch)
              return (
                <span
                  key={ch}
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold opacity-50 ${colors.bg} ${colors.text}`}
                >
                  {ch}
                </span>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const result = (action.result ?? {}) as Partial<NotifyResult>
  const notifiedChannels = result.notifiedChannels ?? payloadChannels
  const truncatedMessage =
    message && message.length > 80 ? `${message.slice(0, 77)}…` : message

  return (
    <div
      className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-3"
      data-testid="notify-card-completed"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-amber-800">
          Notification Sent
        </span>
      </div>

      {/* Channel badges */}
      {notifiedChannels.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="notify-channels">
          {notifiedChannels.map((ch) => {
            const colors = getChannelColor(ch)
            return (
              <span
                key={ch}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}
                data-testid={`channel-badge-${ch}`}
              >
                {ch}
              </span>
            )
          })}
        </div>
      )}

      {/* Message preview */}
      {truncatedMessage && (
        <div className="flex items-start gap-2 pt-2 border-t border-amber-200">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p
            className="text-xs text-gray-600 leading-relaxed"
            data-testid="notify-message-preview"
          >
            {truncatedMessage}
          </p>
        </div>
      )}

      {/* Timestamp from result */}
      {result.timestamp && (
        <p className="text-xs text-gray-400">
          Sent at:{' '}
          {new Date(result.timestamp).toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: 'short',
          })}
        </p>
      )}
    </div>
  )
}
