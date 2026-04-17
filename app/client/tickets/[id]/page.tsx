'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import TicketMessage from '@/components/tickets/TicketMessage'

interface TicketMessageData {
  id: string
  message: string
  createdAt: string
  userId: string | null
  user?: {
    id: string
    email: string
  } | null
  attachments?: string[]
}

interface Ticket {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
  messages: TicketMessageData[]
  order?: {
    id: string
    orderNumber: string
  } | null
  user: {
    id: string
    email: string
  }
}

const STATUS_BADGES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  OPEN: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Open' },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
  RESOLVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Resolved' },
  CLOSED: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Closed' },
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-gray-100', text: 'text-gray-800' },
  MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-800' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-800' },
}

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const ticketId = params?.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (session === null) {
      router.push('/login')
    }
  }, [session, router])

  // Fetch ticket details
  const fetchTicket = async () => {
    if (!session?.user || !ticketId) return

    try {
      const response = await fetch(`/api/tickets/${ticketId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch ticket')
      }

      setTicket(data.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch ticket:', err)
      setError(err instanceof Error ? err.message : 'Failed to load ticket')
    } finally {
      setIsLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchTicket()
  }, [session?.user, ticketId])

  // Poll for new messages
  useEffect(() => {
    if (!ticket) return

    const interval = setInterval(() => {
      fetchTicket()
    }, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [ticket, ticketId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!messageText.trim()) {
      setError('Message cannot be empty')
      return
    }

    setIsSendingMessage(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send message')
      }

      setMessageText('')
      setSuccessMessage('Message sent successfully!')

      // Fetch updated ticket
      await fetchTicket()

      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSendingMessage(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-gray-500">Loading ticket...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ticket Not Found</h2>
            <p className="text-gray-600 mb-6">The ticket you're looking for doesn't exist.</p>
            <Link
              href="/tickets"
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Back to Tickets
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusInfo = STATUS_BADGES[ticket.status] || STATUS_BADGES.OPEN
  const priorityInfo = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.MEDIUM
  const canRespond = ticket.status !== 'CLOSED'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with back button */}
        <div className="mb-8">
          <Link
            href="/tickets"
            className="inline-flex items-center text-amber-600 hover:text-amber-700 transition mb-4"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Tickets
          </Link>

          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
              <p className="text-gray-600 mt-2">{ticket.title}</p>
            </div>
            <div className="flex gap-2">
              <span
                className={`px-4 py-2 rounded-lg font-medium ${statusInfo.bg} ${statusInfo.text}`}
              >
                {statusInfo.label}
              </span>
              <span
                className={`px-4 py-2 rounded-lg font-medium ${priorityInfo.bg} ${priorityInfo.text}`}
              >
                {ticket.priority}
              </span>
            </div>
          </div>
        </div>

        {/* Ticket Info Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Description</p>
              <p className="text-gray-900 mt-2 whitespace-pre-wrap">{ticket.description}</p>
            </div>
            <div className="space-y-4">
              {ticket.order && (
                <div>
                  <p className="text-sm text-gray-600">Related Order</p>
                  <Link
                    href={`/orders/${ticket.order.id}`}
                    className="text-amber-600 hover:text-amber-700 font-medium mt-1 inline-block"
                  >
                    {ticket.order.orderNumber}
                  </Link>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">
                  {new Date(ticket.createdAt).toLocaleString()}
                </p>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <p className="text-sm text-gray-600">Resolved</p>
                  <p className="text-gray-900 mt-1">
                    {new Date(ticket.resolvedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {successMessage}
            </div>
          )}

          {/* Messages Timeline */}
          <div className="space-y-6 mb-8">
            {ticket.messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No messages yet. Start the conversation below.</p>
              </div>
            ) : (
              ticket.messages.map((msg) => (
                <TicketMessage
                  key={msg.id}
                  id={msg.id}
                  userId={msg.userId}
                  user={msg.user}
                  message={msg.message}
                  createdAt={msg.createdAt}
                  attachments={msg.attachments}
                  currentUserId={session?.user?.email || ''}
                  isAdmin={session?.user?.role === 'ADMIN'}
                />
              ))
            )}
          </div>

          {/* Add Message Form */}
          {canRespond ? (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Your Reply</h3>
              <form onSubmit={handleSendMessage} className="space-y-4">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  maxLength={5000}
                  rows={4}
                  disabled={isSendingMessage}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition disabled:opacity-50"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {messageText.length}/5000 characters
                  </p>
                  <button
                    type="submit"
                    disabled={isSendingMessage || !messageText.trim()}
                    className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="border-t pt-6">
              <p className="text-gray-500 text-sm text-center">
                This ticket is closed. You cannot add new messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
