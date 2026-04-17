'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/hooks/useCart'

export default function CartSummary() {
  const { cart } = useCart()
  const [subtotal, setSubtotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const calculateTotal = async () => {
      if (cart.items.length === 0) {
        setSubtotal(0)
        setIsLoading(false)
        return
      }

      try {
        // Fetch all product details to calculate total
        const productIds = cart.items.map((item) => item.id)
        const responses = await Promise.all(
          productIds.map((id) => fetch(`/api/products/${id}`)),
        )

        const products = await Promise.all(responses.map((r) => r.json()))

        let total = 0
        cart.items.forEach((item) => {
          const product = products.find((p) => p.data?.id === item.id || p.id === item.id)
          if (product) {
            const price = product.data?.price || product.price || 0
            total += price * item.quantity
          }
        })

        setSubtotal(total)
      } finally {
        setIsLoading(false)
      }
    }

    calculateTotal()
  }, [cart.items])

  const shipping = subtotal > 50 ? 0 : 5
  const tax = subtotal * 0.1
  const total = subtotal + shipping + tax

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-gray-700">
          <span>Subtotal</span>
          <span>
            {isLoading ? (
              <span className="animate-pulse">...</span>
            ) : (
              `$${subtotal.toFixed(2)}`
            )}
          </span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>Shipping</span>
          <span className="text-green-600 font-medium">
            {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
          </span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>Tax (10%)</span>
          <span>${tax.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-gray-300 pt-4 mb-6">
        <div className="flex justify-between text-lg font-bold text-gray-900">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="w-full bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition font-semibold text-center block"
      >
        Proceed to Checkout
      </Link>

      <Link
        href="/products"
        className="w-full bg-gray-200 text-gray-900 py-3 rounded-lg hover:bg-gray-300 transition font-semibold text-center block mt-2"
      >
        Continue Shopping
      </Link>

      {subtotal <= 50 && subtotal > 0 && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Free shipping on orders over $50!
        </p>
      )}
    </div>
  )
}
