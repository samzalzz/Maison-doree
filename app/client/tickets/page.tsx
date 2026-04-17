'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface TicketMessage {
  id: string
  message: string
  createdAt: string
  user?: {
    id: string
    email: string
  } | null
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
  messages?: TicketMessage[]
  order?: {
    id: string
    orderNumber: string
  } | null
}

interface PaginationInfo {
  skip: number
  take: number
  total: number
  hasMore: boolean
}

const STATUS_BADGES: Record<
  string,
  { bg: string; text: string; label: string; icon: string }
> = {
  OPEN: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Open',
    icon: '🔵',
  },
  IN_PROGRESS: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'In Progress',
    icon: '🟠',
  },
  RESOLVED: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Resolved',
    icon: '🟢',
  },
  CLOSED: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: 'Closed',
    icon: '⚪',
  },
}

const PRIORITY_BADGES: Record<string, { color: string; icon: string }> = {
  LOW: { color: 'text-gray-500', icon: '▼' },
  MEDIUM: { color: 'text-yellow-600', icon: '●' },
  HIGH: { color: 'text-orange-600', icon: '▲' },
  URGENT: { color: 'text-red-600', icon: '⚠️' },
}

export default function TicketsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState<PaginationInfo>({
    skip: 0,
    take: 10,
    total: 0,
    hasMore: false,
  })

  // Redirect to login if not authenticated
  useEffect(() => {
    if (session === null) {
      router.push('/login')
    }
  }, [session, router])

  // Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      if (!session?.user) return

      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          skip: pagination.skip.toString(),
          take: pagination.take.toString(),
        })

        if (selectedStatus) {
          params.append('status', selectedStatus)
        }

        const response = await fetch(`/api/tickets?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          // Filter by search query locally
          let filteredTickets = data.data || []
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filteredTickets = filteredTickets.filter(
              (t: Ticket) =>
                t.ticketNumber.toLowerCase().includes(query) ||
                t.title.toLowerCase().includes(query),
            )
          }
          setTickets(filteredTickets)
          setPagination(data.pagination || {})
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error)
        setTickets([])
      } finally {
        setIsLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchTickets()
    }, 300)

    return () => clearTimeout(timer)
  }, [session?.user, selectedStatus, searchQuery, pagination.skip])

  const handleLoadMore = () => {
    setPagination((prev) => ({
      ...prev,
      skip: prev.skip + prev.take,
    }))
  }

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status)
    setPagination((prev) => ({ ...prev, skip: 0 }))
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-600 mt-2">
              Track and manage your support requests
            </p>
          </div>
          <Link
            href="/tickets/new"
            className="inline-block bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition font-medium text-center"
          >
            + Create New Ticket
          </Link>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by ticket number or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Status Filter */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Status</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusFilter('')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedStatus === ''
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Tickets
              </button>
              {Object.entries(STATUS_BADGES).map(([status, { bg, text, label }]) => (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedStatus === status
                      ? `${bg} ${text} ring-2 ring-offset-2 ring-gray-400`
                      : `${bg} ${text} hover:opacity-80`
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No tickets found
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedStatus || searchQuery
                ? 'No tickets match your search or filter.'
                : 'You have not created any support tickets yet.'}
            </p>
            <Link
              href="/tickets/new"
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Create Your First Ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => {
              const statusInfo = STATUS_BADGES[ticket.status] || STATUS_BADGES.OPEN
              const priorityInfo = PRIORITY_BADGES[ticket.priority] || PRIORITY_BADGES.MEDIUM
              const lastMessage = ticket.messages?.[ticket.messages.length - 1]

              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="block bg-white rounded-lg shadow-sm hover:shadow-md transition p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Left: Ticket Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {ticket.ticketNumber}
                        </h3>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${statusInfo.bg} ${statusInfo.text}`}
                        >
                          {statusInfo.icon} {statusInfo.label}
                        </span>
                        <span
                          className={`inline-block text-lg ${priorityInfo.color} whitespace-nowrap`}
                          title={ticket.priority}
                        >
                          {priorityInfo.icon}
                        </span>
                      </div>

                      <p className="text-gray-900 font-medium mb-2 truncate">
                        {ticket.title}
                      </p>

                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {ticket.description}
                      </p>

                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                        {ticket.order && (
                          <span>Order: {ticket.order.orderNumber}</span>
                        )}
                        {ticket.messages && ticket.messages.length > 0 && (
                          <span>{ticket.messages.length} message(s)</span>
                        )}
                      </div>

                      {lastMessage && (
                        <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 mb-1">
                            Last update:
                          </p>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {lastMessage.message}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Arrow */}
                    <div className="text-gray-400 hidden md:flex items-center">
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.hasMore && !isLoading && (
          <div className="mt-8 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Load More Tickets
            </button>
          </div>
        )}

        {/* Info Footer */}
        {pagination.total > 0 && (
          <div className="mt-8 text-center text-sm text-gray-600">
            Showing {Math.min(pagination.skip + pagination.take, pagination.total)} of{' '}
            {pagination.total} tickets
          </div>
        )}
      </div>
    </div>
  )
}
