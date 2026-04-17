'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import RatingForm from '@/components/ratings/RatingForm'

interface OrderItem {
  id: string
  productId: string
  quantity: number
  priceAtTime: number
  packaging?: string | null
  product: {
    id: string
    name: string
    price: number
    category: string
    photos?: string[]
  }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  totalPrice: number
  items: OrderItem[]
  delivery?: {
    id: string
    status: string
  }
  createdAt: string
}

interface Rating {
  id: string
  orderId: string
  type: 'PRODUCT' | 'DELIVERY'
  score: number
  comment?: string
  productId?: string
  product?: {
    id: string
    name: string
  }
  order?: {
    id: string
    orderNumber: string
  }
  createdAt: string
}

export default function RatingsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit')
  const [ratingFilter, setRatingFilter] = useState<'ALL' | 'PRODUCT' | 'DELIVERY'>('ALL')
  const [showRatingForm, setShowRatingForm] = useState<string | null>(null)
  const [showProductRatingForm, setShowProductRatingForm] = useState<{
    orderId: string
    productId: string
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [ordersRes, ratingsRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/ratings'),
      ])

      if (!ordersRes.ok || !ratingsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const ordersData = await ordersRes.json()
      const ratingsData = await ratingsRes.json()

      if (ordersData.success && ordersData.data) {
        // Filter for delivered orders
        const deliveredOrders = ordersData.data.filter(
          (order: Order) => order.status === 'DELIVERED',
        )
        setOrders(deliveredOrders)
      }

      if (ratingsData.success && ratingsData.data) {
        setRatings(ratingsData.data)
      }
    } catch (err) {
      console.error('[Ratings Page] Error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load data',
      )
    } finally {
      setLoading(false)
    }
  }

  const hasDeliveryRating = (orderId: string): boolean => {
    return ratings.some(
      (r) => r.orderId === orderId && r.type === 'DELIVERY',
    )
  }

  const hasProductRating = (orderId: string, productId: string): boolean => {
    return ratings.some(
      (r) =>
        r.orderId === orderId &&
        r.type === 'PRODUCT' &&
        r.productId === productId,
    )
  }

  const filteredRatings = ratings.filter((rating) => {
    if (ratingFilter === 'ALL') return true
    return rating.type === ratingFilter
  })

  const getRatingDisplay = (score: number) => {
    return '★'.repeat(score) + '☆'.repeat(5 - score)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-amber-900 mb-4">
              Ratings & Reviews
            </h1>
          </div>
          <div className="bg-white rounded-2xl shadow-lg h-96 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 mb-4">
            Ratings & Reviews
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Share your feedback about our products and delivery service. Your
            reviews help us improve!
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8 text-red-700">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b-2 border-amber-200">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'submit'
                ? 'text-amber-600 border-b-2 border-amber-600 -mb-0.5'
                : 'text-gray-600 hover:text-amber-600'
            }`}
          >
            Submit Rating
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'history'
                ? 'text-amber-600 border-b-2 border-amber-600 -mb-0.5'
                : 'text-gray-600 hover:text-amber-600'
            }`}
          >
            Rating History ({ratings.length})
          </button>
        </div>

        {/* Submit Rating Tab */}
        {activeTab === 'submit' && (
          <div className="space-y-8">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <p className="text-gray-600 mb-6">
                  No delivered orders available for rating
                </p>
                <Link
                  href="/shop"
                  className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-amber-700 transition"
                >
                  Start Shopping
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-lg p-8"
                >
                  {/* Order Header */}
                  <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <h3 className="text-xl font-bold text-amber-900">
                        Order #{order.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-600">
                        {order.totalPrice.toFixed(2)} MAD
                      </p>
                      <p className="text-xs text-gray-500">Total spent</p>
                    </div>
                  </div>

                  {/* Rating Forms Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Product Ratings */}
                    <div>
                      <h4 className="font-bold text-amber-900 mb-4">
                        Rate Products
                      </h4>
                      <div className="space-y-3">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 bg-amber-50 rounded-lg"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <p className="font-semibold text-amber-900">
                                  {item.product.name}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              {hasProductRating(
                                order.id,
                                item.productId,
                              ) && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">
                                  Rated
                                </span>
                              )}
                            </div>
                            {!hasProductRating(
                              order.id,
                              item.productId,
                            ) && (
                              <button
                                onClick={() =>
                                  setShowProductRatingForm({
                                    orderId: order.id,
                                    productId: item.productId,
                                  })
                                }
                                className="text-sm text-amber-600 font-semibold hover:text-amber-700"
                              >
                                Rate this product →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delivery Rating */}
                    <div>
                      <h4 className="font-bold text-amber-900 mb-4">
                        Rate Delivery
                      </h4>
                      {hasDeliveryRating(order.id) ? (
                        <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                          <p className="text-green-700 font-semibold">
                            Delivery already rated
                          </p>
                          <p className="text-sm text-green-600 mt-1">
                            Thank you for your feedback!
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRatingForm(order.id)}
                          className="w-full p-4 bg-amber-50 rounded-lg border-2 border-amber-300 hover:border-amber-600 transition text-amber-600 font-semibold"
                        >
                          Rate Delivery Service
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delivery Rating Form */}
                  {showRatingForm === order.id && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <RatingForm
                        orderId={order.id}
                        orderNumber={order.orderNumber}
                        type="DELIVERY"
                        onSuccess={() => {
                          setShowRatingForm(null)
                          fetchData()
                        }}
                        onCancel={() => setShowRatingForm(null)}
                      />
                    </div>
                  )}

                  {/* Product Rating Form */}
                  {showProductRatingForm &&
                    showProductRatingForm.orderId === order.id && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        {(() => {
                          const product = order.items.find(
                            (item) =>
                              item.productId ===
                              showProductRatingForm.productId,
                          )?.product
                          return (
                            <RatingForm
                              orderId={order.id}
                              orderNumber={order.orderNumber}
                              type="PRODUCT"
                              productId={
                                showProductRatingForm.productId
                              }
                              productName={product?.name}
                              onSuccess={() => {
                                setShowProductRatingForm(null)
                                fetchData()
                              }}
                              onCancel={() =>
                                setShowProductRatingForm(null)
                              }
                            />
                          )
                        })()}
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Rating History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Filter */}
            <div className="flex gap-2">
              {['ALL', 'PRODUCT', 'DELIVERY'].map((filter) => (
                <button
                  key={filter}
                  onClick={() =>
                    setRatingFilter(
                      filter as 'ALL' | 'PRODUCT' | 'DELIVERY',
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    ratingFilter === filter
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-amber-600 border-2 border-amber-300 hover:border-amber-600'
                  }`}
                >
                  {filter === 'ALL'
                    ? 'All Ratings'
                    : filter === 'PRODUCT'
                      ? 'Products'
                      : 'Delivery'}
                </button>
              ))}
            </div>

            {/* Ratings List */}
            {filteredRatings.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <p className="text-gray-600 mb-6">No ratings yet</p>
                <button
                  onClick={() => setActiveTab('submit')}
                  className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-amber-700 transition"
                >
                  Submit Your First Rating
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRatings.map((rating) => (
                  <div
                    key={rating.id}
                    className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-amber-500 text-lg">
                            {getRatingDisplay(rating.score)}
                          </span>
                          <span className="text-gray-600 text-sm">
                            ({rating.score}/5)
                          </span>
                        </div>
                        <p className="font-semibold text-amber-900">
                          {rating.type === 'PRODUCT' ? (
                            <>
                              Product Review: {rating.product?.name}
                            </>
                          ) : (
                            <>
                              Delivery Review
                            </>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Order #{rating.order?.orderNumber}
                        </p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        {new Date(rating.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {rating.comment && (
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {rating.comment}
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          rating.type === 'PRODUCT'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {rating.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
