'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/hooks/useCart'
import { useSession } from 'next-auth/react'

interface CheckoutFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  postalCode: string
  country: string
  paymentMethod: 'card' | 'cash'
}

export default function CheckoutPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { cart, isLoaded, clearCart } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subtotal, setSubtotal] = useState(0)
  const [cartTotal, setCartTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: session?.user?.name?.split(' ')[0] || '',
    lastName: session?.user?.name?.split(' ')[1] || '',
    email: session?.user?.email || '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Morocco',
    paymentMethod: 'cash',
  })

  // Calculate cart total
  useEffect(() => {
    const calculateTotal = async () => {
      if (cart.items.length === 0) {
        setSubtotal(0)
        setCartTotal(0)
        setIsLoading(false)
        return
      }

      try {
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

        const shipping = total > 50 ? 0 : 5
        const tax = total * 0.1
        setCartTotal(total + shipping + tax)
      } finally {
        setIsLoading(false)
      }
    }

    calculateTotal()
  }, [cart.items])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (cart.items.length === 0) {
      alert('Your cart is empty. Please add items before checking out.')
      return
    }

    setIsSubmitting(true)

    try {
      // Map cart items to order items format
      const orderItems = cart.items.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      }))

      // Map payment method to expected enum
      const paymentMethod =
        formData.paymentMethod === 'card' ? 'STRIPE' : 'CASH_ON_DELIVERY'

      // Create order
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderItems,
          deliveryAddress: `${formData.address}, ${formData.city}, ${formData.country}`,
          deliveryCity: formData.city,
          deliveryZipCode: formData.postalCode,
          paymentMethod,
        }),
      })

      if (!orderResponse.ok) {
        const error = await orderResponse.json()
        throw new Error(error.error?.message || 'Failed to create order')
      }

      const orderData = await orderResponse.json()

      // Clear cart
      clearCart()

      // Redirect to order confirmation
      router.push(`/orders/${orderData.data.id}`)
    } catch (error) {
      console.error('Checkout error:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'An error occurred during checkout. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-gray-500">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Your cart is empty
            </h1>
            <p className="text-gray-600 mb-6">
              Please add items to your cart before checking out.
            </p>
            <Link
              href="/products"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition"
            >
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const shipping = subtotal > 50 ? 0 : 5
  const tax = subtotal * 0.1

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Checkout</h1>
          <Link
            href="/cart"
            className="text-amber-600 hover:text-amber-700 font-medium mt-2 inline-block"
          >
            ← Back to Cart
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Shipping Address
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      required
                      value={formData.postalCode}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Payment Method
                </h2>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={formData.paymentMethod === 'cash'}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 font-medium">
                      Cash on Delivery
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={formData.paymentMethod === 'card'}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-700 font-medium">
                      Credit/Debit Card
                    </span>
                  </label>
                </div>

                {formData.paymentMethod === 'card' && (
                  <p className="text-sm text-gray-500 mt-4">
                    Card payment processing will be available soon. Please select
                    Cash on Delivery for now.
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || formData.paymentMethod === 'card'}
                className="w-full bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-20">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Order Summary
              </h2>

              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
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

                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>

                  {subtotal <= 50 && subtotal > 0 && (
                    <p className="text-xs text-gray-500 text-center mt-3">
                      Free shipping on orders over $50!
                    </p>
                  )}

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Order Items ({cart.items.length})
                    </h3>
                    <div className="space-y-2 text-sm">
                      {cart.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-gray-600">
                          <span>Item #{item.id.substring(0, 8)}</span>
                          <span>Qty: {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
