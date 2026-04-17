'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import DeliveryMap from '@/components/delivery/DeliveryMap'
import DeliveryStatus from '@/components/delivery/DeliveryStatus'

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
  currentLat?: number | string | null
  currentLng?: number | string | null
  locationUpdatedAt?: string | null
  driver?: Driver | null
  driverId?: string | null
  proofPhoto?: string | null
}

interface OrderItem {
  id: string
  productId: string
  quantity: number
  priceAtTime: number
  packaging?: string | null
  product: {
    id: string
    name: string
    photos?: string[]
  }
}

interface Order {
  id: string
  orderNumber: string
  userId: string
  status: string
  deliveryAddress: string
  deliveryCity: string
  deliveryZipCode: string
  items: OrderItem[]
  delivery?: Delivery | null
  createdAt: string
}

const DELIVERY_STATUS_INFO: Record<
  string,
  { bg: string; text: string; label: string; icon: string }
> = {
  UNASSIGNED: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    label: 'Unassigned',
    icon: '📋',
  },
  ASSIGNED: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Assigned',
    icon: '👤',
  },
  ACCEPTED: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    label: 'Accepted',
    icon: '✓',
  },
  IN_PROGRESS: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'On The Way',
    icon: '🚗',
  },
  DELIVERED: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Delivered',
    icon: '📦',
  },
  CANCELLED: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Cancelled',
    icon: '✕',
  },
}

export default function DeliveryTrackingPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eta, setEta] = useState<string | null>(null)

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

          // Calculate ETA if delivery is in progress
          if (
            data.data.delivery?.estimatedDelivery &&
            ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(data.data.delivery.status)
          ) {
            calculateETA(data.data.delivery.estimatedDelivery)
          }
        } else {
          setError(data.error?.message || 'Failed to load delivery')
          setOrder(null)
        }
      } catch (err) {
        console.error('Failed to fetch order:', err)
        setError('Failed to load delivery details')
        setOrder(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()

    // Poll for updates every 15 seconds (real-time ready)
    const interval = setInterval(fetchOrder, 15000)
    return () => clearInterval(interval)
  }, [session?.user, orderId])

  // Update ETA countdown every minute
  useEffect(() => {
    if (!order?.delivery?.estimatedDelivery) return

    const updateETA = () => {
      calculateETA(order.delivery!.estimatedDelivery!)
    }

    const interval = setInterval(updateETA, 60000)
    updateETA() // Initial calculation

    return () => clearInterval(interval)
  }, [order?.delivery?.estimatedDelivery])

  const calculateETA = (estimatedTime: string) => {
    const now = new Date()
    const delivery = new Date(estimatedTime)
    const diff = delivery.getTime() - now.getTime()

    if (diff < 0) {
      setEta('Delivery date has passed')
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
      setEta(`${days}d ${hours}h remaining`)
    } else if (hours > 0) {
      setEta(`${hours}h ${minutes}m remaining`)
    } else {
      setEta(`${minutes}m remaining`)
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
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-64 bg-gray-200 rounded" />
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
              {error || 'Delivery tracking not available'}
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

  // Check if order has delivery info
  if (!order.delivery) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Delivery Not Yet Available
            </h2>
            <p className="text-gray-600 mb-6">
              Delivery tracking will be available once your order is assigned to a driver.
            </p>
            <Link
              href={`/orders/${order.id}`}
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
            >
              View Order Details
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const delivery = order.delivery
  const statusInfo =
    DELIVERY_STATUS_INFO[delivery.status] || DELIVERY_STATUS_INFO.UNASSIGNED
  const hasLocation =
    delivery.currentLat &&
    delivery.currentLng &&
    ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(delivery.status)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/orders/${order.id}`}
            className="text-amber-600 hover:text-amber-700 font-medium inline-flex items-center gap-2 mb-4"
          >
            ← Back to Order
          </Link>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-bold text-gray-900">Delivery Tracking</h1>
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${statusInfo.bg} ${statusInfo.text}`}
            >
              {statusInfo.icon} {statusInfo.label}
            </span>
          </div>
          <p className="text-gray-600">
            Order {order.orderNumber} - {order.deliveryCity}
          </p>
        </div>

        {/* ETA Banner */}
        {eta && ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(delivery.status) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <p className="text-amber-900 font-semibold">
              Estimated Delivery: {eta}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Map */}
            {hasLocation ? (
              <DeliveryMap delivery={delivery} />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="bg-gray-100 rounded-lg h-96 flex flex-col items-center justify-center">
                  <p className="text-gray-500 text-lg mb-2">
                    Map will appear when driver starts delivery
                  </p>
                  <p className="text-gray-400 text-sm">
                    {['ASSIGNED', 'ACCEPTED'].includes(delivery.status)
                      ? 'Waiting for driver to start delivery...'
                      : 'Location not yet available'}
                  </p>
                </div>
              </div>
            )}

            {/* Delivery Status Timeline */}
            <DeliveryStatus delivery={delivery} />

            {/* Order Items Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Order Items
              </h2>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.product.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ${(item.quantity * parseFloat(item.priceAtTime.toString())).toFixed(2)}
                    </p>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Driver Info */}
            {delivery.driver && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Your Driver
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-900">
                      {delivery.driver.profile?.firstName}{' '}
                      {delivery.driver.profile?.lastName || ''}
                    </p>
                  </div>
                  {delivery.driver.profile?.phone && (
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <a
                        href={`tel:${delivery.driver.profile.phone}`}
                        className="font-semibold text-amber-600 hover:text-amber-700"
                      >
                        {delivery.driver.profile.phone}
                      </a>
                    </div>
                  )}
                  <button className="w-full mt-4 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition font-semibold text-sm">
                    Call Driver
                  </button>
                </div>
              </div>
            )}

            {/* Status Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Status Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Current Status</p>
                  <p className="font-semibold text-gray-900">
                    {statusInfo.label}
                  </p>
                </div>

                {delivery.estimatedDelivery && (
                  <div>
                    <p className="text-gray-600">Est. Delivery</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(delivery.estimatedDelivery).toLocaleDateString()} at{' '}
                      {new Date(delivery.estimatedDelivery).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}

                {delivery.actualDelivery && (
                  <div>
                    <p className="text-gray-600">Delivered On</p>
                    <p className="font-semibold text-green-600">
                      {new Date(delivery.actualDelivery).toLocaleDateString()} at{' '}
                      {new Date(delivery.actualDelivery).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}

                {delivery.locationUpdatedAt && hasLocation && (
                  <div>
                    <p className="text-gray-600">Last Location Update</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(delivery.locationUpdatedAt).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold">
                Share Tracking Link
              </button>
              <Link
                href={`/orders/${order.id}`}
                className="block text-center bg-gray-200 text-gray-900 py-3 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                View Order Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
