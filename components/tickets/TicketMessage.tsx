'use client'

import React from 'react'

interface TicketMessageProps {
  id: string
  userId: string | null | undefined
  user?: {
    id: string
    email: string
  } | null
  message: string
  createdAt: string
  attachments?: string[]
  currentUserId: string
  isAdmin?: boolean
}

export default function TicketMessage({
  id,
  userId,
  user,
  message,
  createdAt,
  attachments,
  currentUserId,
  isAdmin,
}: TicketMessageProps) {
  const isCurrentUser = userId === currentUserId
  const messageDate = new Date(createdAt)
  const formattedDate = messageDate.toLocaleString()
  const timeAgo = getTimeAgo(messageDate)

  const userType = isAdmin && !isCurrentUser ? 'admin' : 'user'

  return (
    <div
      className={`flex gap-4 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar + Message for others' messages */}
      {!isCurrentUser && (
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
            userType === 'admin' ? 'bg-purple-500' : 'bg-gray-400'
          }`}>
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-md ${
          isCurrentUser
            ? 'bg-amber-100 border border-amber-300 rounded-2xl rounded-tr-none text-gray-900'
            : userType === 'admin'
              ? 'bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-none text-gray-900'
              : 'bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-none text-gray-900'
        } px-4 py-3`}
      >
        {/* Header with user info and timestamp */}
        {!isCurrentUser && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              {user?.email || 'Unknown User'}
              {userType === 'admin' && (
                <span className="ml-2 px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs font-bold">
                  ADMIN
                </span>
              )}
            </p>
          </div>
        )}

        {/* Message text */}
        <p className="text-sm whitespace-pre-wrap break-words">{message}</p>

        {/* Attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-opacity-20">
            <p className="text-xs font-medium text-gray-600 mb-2">Attachments:</p>
            <div className="space-y-1">
              {attachments.map((attachment, index) => (
                <a
                  key={index}
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-600 hover:text-amber-700 underline block truncate"
                  title={attachment}
                >
                  📎 {getFileName(attachment)}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-2 text-xs opacity-70" title={formattedDate}>
          {timeAgo}
        </p>
      </div>
    </div>
  )
}

/**
 * Calculate time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

/**
 * Extract filename from path
 */
function getFileName(path: string): string {
  return path.split('/').pop() || 'attachment'
}
