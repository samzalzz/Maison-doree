'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'

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
    description?: string
    price: number
    category: string
    photos?: string[]
  }
}

interface Driver {
  id: string
  email: string
  profile?: {
    firstName?: string
    lastName?: string
    phone?: string
  }
}

interface Delivery {
  id: string
  status: string
  estimatedDelivery?: string | null
  actualDelivery?: string | null
  currentLat?: number | null
  currentLng?: number | null
  locationUpdatedAt?: string | null
  driver?: Driver | null
  driverId?: string | null
  proofPhoto?: string | null
}

interface Payment {
  id: string
  amount: number
  method: string
  status: string
  stripePaymentId?: string | null
  collectedAmount?: number | null
}

interface Rating {
  id: string
  type: string
  score: number
  comment?: string | null
  productId?: string | null
  createdAt: string
}

interface Ticket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  createdAt: string
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
  ratings: Rating[]
  tickets: Ticket[]
  createdAt: string
  updatedAt: string
}

const STATUS_TIMELINE: Record<
  string,
  { order: number; icon: string; label: string }
> = {
  PENDING: { order: 1, icon: '📋', label: 'Order Placed' },
  CONFIRMED: { order: 2, icon: '✓', label: 'Confirmed' },
  ASSIGNED: { order: 3, icon: '👤', label: 'Assigned' },
  IN_PROGRESS: { order: 4, icon: '🚗', label: 'In Progress' },
  DELIVERED: { order: 5, icon: '📦', label: 'Delivered' },
}

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
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

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingData, setRatingData] = useState({
    score: 5,
    comment: '',
  })

  const orderId = params?.id as string

  // Redirect to login if not authenticated
  useEffect(() => {
    if (session === null) {
      router.push('/login')
    }
  }, [session, router])

  // Fetch order details
  useEffect(() => {
    const fetchOrder = async () => {
      if (!session?.user || !orderId) return

      setIsLoading(true)
      try {
        const response = await fetch(`/api/orders/${orderId}`)
        const data = await response.json()

        if (data.success) {
          setOrder(data.data)
          setError(null)
        } else {
          setError(data.error?.message || 'Failed to load order')
          setOrder(null)
        }
      } catch (err) {
        console.error('Failed to fetch order:', err)
        setError('Failed to load order details')
        setOrder(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchOrder, 30000)
    return () => clearInterval(interval)
  }, [session?.user, orderId])

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!order) return

    try {
      // Implementation for rating submission would go here
      // For now, just close the modal
      setShowRatingModal(false)
      alert('Rating submitted successfully!')
    } catch (err) {
      console.error('Failed to submit rating:', err)
      alert('Failed to submit rating')
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
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
            <p className="text-gray-600 mb-6">
              {error || 'Order not found'}
            </p>
            <Link
              href="/orders"
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Back to Orders
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.PENDING
  const isDelivered = order.status === 'DELIVERED'
  const hasDelivery = order.delivery && order.status !== 'CANCELLED'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/orders"
            className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-2 mb-4"
          >
            ← Back to Orders
          </Link>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-bold text-gray-900">
              {order.orderNumber}
            </h1>
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusColor.bg} ${statusColor.text}`}
            >
              {statusColor.label}
            </span>
          </div>
          <p className="text-gray-600">
            Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
            {new Date(order.createdAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Order Timeline */}
        {order.status !== 'CANCELLED' && (
          <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Order Status
            </h2>
            <div className="flex items-center justify-between relative">
              {/* Timeline Line */}
              <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 -z-10">
                <div
                  className="h-full bg-amber-600 transition-all duration-300"
                  style={{
                    width: `${((STATUS_TIMELINE[order.status]?.order || 1) / 5) * 100}%`,
                  }}
                />
              </div>

              {/* Timeline Steps */}
              {Object.entries(STATUS_TIMELINE).map(([status, step]) => {
                const isCompleted = (STATUS_TIMELINE[order.status]?.order || 1) >= step.order
                const isCurrent = order.status === status

                return (
                  <div key={status} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-3 transition ${
                        isCurrent
                          ? 'bg-amber-600 text-white ring-4 ring-amber-200'
                          : isCompleted
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <p
                      className={`text-sm text-center font-medium ${
                        isCurrent
                          ? 'text-gray-900'
                          : isCompleted
                            ? 'text-green-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Order Items */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Order Items
              </h2>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 pb-4 border-b border-gray-200 last:border-b-0"
                  >
                    {item.product.photos && item.product.photos[0] && (
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <img
                          src={`/uploads${item.product.photos[0]}`}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Category: {item.product.category}
                      </p>
                      {item.packaging && (
                        <p className="text-sm text-gray-600">
                          Packaging: {item.packaging}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 mt-2">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${(item.quantity * parseFloat(item.priceAtTime.toString())).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        ${parseFloat(item.priceAtTime.toString()).toFixed(2)} each
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Delivery Address
              </h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-900 font-medium">{order.deliveryAddress}</p>
                <p className="text-gray-600 mt-1">
                  {order.deliveryCity}, {order.deliveryZipCode}
                </p>
              </div>
            </div>

            {/* Delivery Info */}
            {order.delivery && order.status !== 'CANCELLED' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Delivery Details
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status</span>
                    <span className="font-medium text-gray-900">
                      {order.delivery.status}
                    </span>
                  </div>
                  {order.delivery.driver && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Driver</span>
                        <span className="font-medium text-gray-900">
                          {order.delivery.driver.profile?.firstName}{' '}
                          {order.delivery.driver.profile?.lastName}
                        </span>
                      </div>
                      {order.delivery.driver.profile?.phone && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Driver Phone</span>
                          <a
                            href={`tel:${order.delivery.driver.profile.phone}`}
                            className="font-medium text-amber-600 hover:text-amber-700"
                          >
                            {order.delivery.driver.profile.phone}
                          </a>
                        </div>
                      )}
                    </>
                  )}
                  {order.delivery.estimatedDelivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Est. Delivery</span>
                      <span className="font-medium text-gray-900">
                        {new Date(order.delivery.estimatedDelivery).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {order.delivery.actualDelivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivered On</span>
                      <span className="font-medium text-gray-900">
                        {new Date(order.delivery.actualDelivery).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {order.delivery.currentLat && order.delivery.currentLng && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-3">
                      Last Location Update:{' '}
                      {order.delivery.locationUpdatedAt
                        ? new Date(order.delivery.locationUpdatedAt).toLocaleTimeString()
                        : 'N/A'}
                    </p>
                    <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                      <p className="text-gray-500 text-sm">
                        Map coming soon - Lat: {order.delivery.currentLat}, Lng:{' '}
                        {order.delivery.currentLng}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Order Summary
              </h2>
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">
                    ${order.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (20%)</span>
                  <span className="font-medium text-gray-900">
                    ${order.taxAmount.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between mb-6">
                <span className="text-lg font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-amber-600">
                  ${order.totalPrice.toFixed(2)}
                </span>
              </div>

              {/* Payment Status */}
              {order.payment && (
                <div className="pt-6 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Payment
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Method</span>
                      <span className="text-gray-900 font-medium">
                        {order.payment.method === 'CASH_ON_DELIVERY'
                          ? 'Cash on Delivery'
                          : 'Card Payment'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span
                        className={`font-medium ${
                          order.payment.status === 'COMPLETED'
                            ? 'text-green-600'
                            : order.payment.status === 'FAILED'
                              ? 'text-red-600'
                              : 'text-yellow-600'
                        }`}
                      >
                        {order.payment.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rating Button */}
            {isDelivered && (
              <button
                onClick={() => setShowRatingModal(true)}
                className="w-full bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition font-semibold"
              >
                Rate This Order
              </button>
            )}

            {/* Support Button */}
            <Link
              href={`/tickets/new?orderId=${order.id}`}
              className="w-full block text-center bg-gray-200 text-gray-900 py-3 rounded-lg hover:bg-gray-300 transition font-semibold"
            >
              Create Support Ticket
            </Link>
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Rate This Order</h2>

            <form onSubmit={handleRatingSubmit} className="space-y-4">
              {/* Score */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Rating
                </label>
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setRatingData((prev) => ({
                          ...prev,
                          score: star,
                        }))
                      }
                      className={`text-4xl transition ${
                        star <= ratingData.score
                          ? 'text-yellow-400'
                          : 'text-gray-300 hover:text-yellow-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comment (Optional)
                </label>
                <textarea
                  value={ratingData.comment}
                  onChange={(e) =>
                    setRatingData((prev) => ({
                      ...prev,
                      comment: e.target.value,
                    }))
                  }
                  placeholder="Share your experience..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(false)}
                  className="flex-1 bg-gray-200 text-gray-900 py-2 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition font-semibold"
                >
                  Submit Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
