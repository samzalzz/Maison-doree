'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/hooks/useCart'
import CartItem from '@/components/cart/CartItem'
import CartSummary from '@/components/cart/CartSummary'

export default function CartPage() {
  const { cart, isLoaded, clearCart } = useCart()
  const [isClearingCart, setIsClearingCart] = useState(false)

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-500">Loading cart...</p>
          </div>
        </div>
      </div>
    )
  }

  const handleClearCart = async () => {
    if (
      window.confirm(
        'Are you sure you want to clear your entire cart? This action cannot be undone.',
      )
    ) {
      setIsClearingCart(true)
      try {
        clearCart()
      } finally {
        setIsClearingCart(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600 mt-2">
            {cart.items.length === 0
              ? 'Your cart is empty'
              : `You have ${cart.items.length} item${cart.items.length !== 1 ? 's' : ''} in your cart`}
          </p>
        </div>

        {cart.items.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Your cart is empty
            </h2>
            <p className="text-gray-600 mb-6">
              Start shopping to add items to your cart
            </p>
            <Link
              href="/shop"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition font-semibold"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <CartItem
                    key={item.id}
                    productId={item.id}
                    quantity={item.quantity}
                  />
                ))}
              </div>

              <button
                onClick={handleClearCart}
                disabled={isClearingCart}
                className="mt-6 text-red-600 hover:text-red-700 font-medium text-sm disabled:opacity-50"
              >
                {isClearingCart ? 'Clearing...' : 'Clear Cart'}
              </button>
            </div>

            {/* Cart Summary */}
            <div className="lg:col-span-1">
              <CartSummary />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
