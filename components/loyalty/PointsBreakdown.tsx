'use client'

import React, { useEffect, useState } from 'react'

interface Order {
  id: string
  orderNumber: string
  totalPrice: number
  createdAt: string
}

interface PointsBreakdownProps {
  totalPoints: number
}

export default function PointsBreakdown({
  totalPoints,
}: PointsBreakdownProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/orders')

        if (!response.ok) {
          throw new Error('Failed to fetch orders')
        }

        const data = await response.json()
        if (data.success && data.data) {
          const deliveredOrders = data.data.filter(
            (order: any) => order.status === 'DELIVERED',
          )
          setOrders(deliveredOrders)
        }
      } catch (err) {
        console.error('[PointsBreakdown] Error fetching orders:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load points history',
        )
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-amber-900 mb-6">
          Points History
        </h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-lg h-16 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-red-500">
        <h2 className="text-2xl font-bold text-amber-900 mb-4">
          Points History
        </h2>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-amber-900">Points History</h2>
        <div className="text-right">
          <p className="text-sm text-gray-600">Total Points</p>
          <p className="text-3xl font-bold text-amber-600">{totalPoints}</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No completed orders yet</p>
          <p className="text-sm text-gray-400">
            You'll earn points once you complete your first order
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {orders.map((order) => {
            const points = Math.floor(Number(order.totalPrice))
            const date = new Date(order.createdAt)
            const formattedDate = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })

            return (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-transparent rounded-lg hover:shadow-md transition border-l-4 border-amber-500"
              >
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">
                    Order #{order.orderNumber}
                  </p>
                  <p className="text-sm text-gray-500">{formattedDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-600 font-bold text-lg">
                    +{points}
                  </p>
                  <p className="text-xs text-gray-500">
                    ({order.totalPrice.toFixed(2)} MAD)
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 p-4 bg-amber-50 rounded-lg">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">
              {orders.length} completed order{orders.length !== 1 ? 's' : ''}
            </span>
            <br />
            Points are earned at a rate of 1 point per MAD spent (silver tier:
            1.25, gold tier: 1.5)
          </p>
        </div>
      )}
    </div>
  )
}
