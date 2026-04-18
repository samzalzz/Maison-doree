'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { PageSizeSelect } from '@/components/ui/PageSizeSelect'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  id: string
  productId: string
  quantity: number
  priceAtTime: number
  packaging?: string | null
  packagingPrice?: number
  product: {
    id: string
    name: string
    price: number
    category: string
    photos?: string[]
  }
}

interface Payment {
  id: string
  amount: number
  method: string
  status: string
}

interface Delivery {
  id: string
  status: string
  estimatedDelivery?: string | null
  actualDelivery?: string | null
  driverId?: string | null
}

interface Order {
  id: string
  orderNumber: string
  userId: string
  subtotal: number
  taxAmount: number
  totalPrice: number
  status: string
  deliveryAddress: string
  deliveryCity: string
  deliveryZipCode: string
  items: OrderItem[]
  payment?: Payment | null
  delivery?: Delivery | null
  createdAt: string
  updatedAt: string
}

interface CursorPagination {
  limit: number
  nextCursor: string | null
  hasNextPage: boolean
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Confirmed' },
  ASSIGNED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Assigned' },
  IN_PROGRESS: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
  DELIVERED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const router = useRouter()
  const { data: session } = useSession()

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState(10)

  // Cursor stack — index 0 always = null (first page), index N = cursor for page N+1
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [pagination, setPagination] = useState<CursorPagination | null>(null)

  const currentCursor = cursorStack[currentPageIndex] ?? null
  const currentPage = currentPageIndex + 1

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (session === null) {
      router.push('/login')
    }
  }, [session, router])

  // Fetch the current page
  const fetchOrders = useCallback(async () => {
    if (!session?.user) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(pageSize) })
      if (currentCursor) params.set('cursor', currentCursor)
      if (selectedStatus) params.set('status', selectedStatus)

      const res = await fetch(`/api/orders?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data ?? [])
        setPagination(data.pagination ?? null)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [session?.user, currentCursor, selectedStatus, pageSize])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // When filters change, reset to first page
  const prevFiltersKey = useRef<string | null>(null)
  useEffect(() => {
    const key = `${selectedStatus}|${pageSize}`
    if (prevFiltersKey.current === null) {
      prevFiltersKey.current = key
      return
    }
    if (prevFiltersKey.current === key) return
    prevFiltersKey.current = key

    setCursorStack([null])
    setCurrentPageIndex(0)
    setPagination(null)
  }, [selectedStatus, pageSize])

  const handleNext = () => {
    if (!pagination?.nextCursor) return
    const nextIndex = currentPageIndex + 1
    setCursorStack((prev) => {
      const copy = [...prev]
      copy[nextIndex] = pagination.nextCursor
      return copy
    })
    setCurrentPageIndex(nextIndex)
  }

  const handlePrevious = () => {
    if (currentPageIndex === 0) return
    setCurrentPageIndex((prev) => prev - 1)
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

  const hasPrevious = currentPageIndex > 0
  const hasNext = pagination?.hasNextPage === true

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Order History</h1>
            <p className="text-gray-600 mt-2">View and track all your orders</p>
          </div>
          <PageSizeSelect
            value={pageSize}
            onChange={(size) => setPageSize(size)}
            options={[5, 10, 20, 50]}
          />
        </div>

        {/* Status Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter by Status</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Order status filter">
            <button
              onClick={() => setSelectedStatus('')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedStatus === ''
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              aria-pressed={selectedStatus === ''}
            >
              All Orders
            </button>
            {Object.entries(STATUS_BADGES).map(([status, { bg, text, label }]) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedStatus === status
                    ? `${bg} ${text} ring-2 ring-offset-2 ring-gray-400`
                    : `${bg} ${text} hover:opacity-80`
                }`}
                aria-pressed={selectedStatus === status}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-500">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600 mb-6">
              {selectedStatus
                ? 'No orders with this status yet.'
                : 'You have not placed any orders yet.'}
            </p>
            <Link
              href="/shop"
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Order list">
            {orders.map((order) => {
              const badgeInfo = STATUS_BADGES[order.status] ?? STATUS_BADGES['PENDING']
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block bg-white rounded-lg shadow-sm hover:shadow-md transition p-6"
                  role="listitem"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left: Order Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {order.orderNumber}
                        </h3>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${badgeInfo.bg} ${badgeInfo.text}`}
                        >
                          {badgeInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} | {order.deliveryCity}
                      </p>
                      <div className="text-sm text-gray-600">
                        <p>Ordered: {new Date(order.createdAt).toLocaleDateString()}</p>
                        {order.delivery?.estimatedDelivery && (
                          <p>
                            Est. Delivery:{' '}
                            {new Date(order.delivery.estimatedDelivery).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {Number(order.totalPrice).toFixed(2)} MAD
                        </p>
                      </div>
                      <div className="text-gray-400 hidden md:block" aria-hidden="true">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {(hasPrevious || hasNext) && (
          <div className="mt-10">
            <PaginationControls
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onPrevious={handlePrevious}
              onNext={handleNext}
              currentPage={currentPage}
            />
          </div>
        )}

        {/* Page info */}
        {orders.length > 0 && (
          <p className="mt-4 text-center text-sm text-gray-500" aria-live="polite">
            Page {currentPage} — showing {orders.length} order{orders.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
