export const dynamic = 'force-dynamic'

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

interface PaginationInfo {
  skip: number
  take: number
  total: number
  hasMore: boolean
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Pending',
  },
  CONFIRMED: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Confirmed',
  },
  ASSIGNED: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    label: 'Assigned',
  },
  IN_PROGRESS: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'In Progress',
  },
  DELIVERED: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Delivered',
  },
  CANCELLED: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Cancelled',
  },
}

export default function OrdersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
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

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
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

        const response = await fetch(`/api/orders?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          setOrders(data.data || [])
          setPagination(data.pagination || {})
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error)
        setOrders([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [session?.user, selectedStatus, pagination.skip])

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
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Order History</h1>
          <p className="text-gray-600 mt-2">
            View and track all your orders
          </p>
        </div>

        {/* Status Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter by Status</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleStatusFilter('')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedStatus === ''
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Orders
            </button>
            {Object.entries(STATUS_BADGES).map(([status, { bg, text }]) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedStatus === status
                    ? `${bg} ${text} ring-2 ring-offset-2 ring-gray-400`
                    : `${bg} ${text} hover:opacity-80`
                }`}
              >
                {STATUS_BADGES[status].label}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No orders found
            </h3>
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
          <div className="space-y-4">
            {orders.map((order) => {
              const badgeInfo = STATUS_BADGES[order.status] || STATUS_BADGES.PENDING
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block bg-white rounded-lg shadow-sm hover:shadow-md transition p-6"
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
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        {' '}
                        | {order.deliveryCity}
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

                    {/* Right: Amount & Arrow */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Total</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${order.totalPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-gray-400 hidden md:block">
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
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.hasMore && (
          <div className="mt-8 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
            >
              Load More Orders
            </button>
          </div>
        )}

        {/* Info Footer */}
        {pagination.total > 0 && (
          <div className="mt-8 text-center text-sm text-gray-600">
            Showing {Math.min(pagination.skip + pagination.take, pagination.total)} of{' '}
            {pagination.total} orders
          </div>
        )}
      </div>
    </div>
  )
}
