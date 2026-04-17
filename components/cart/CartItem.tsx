'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useCart } from '@/lib/hooks/useCart'

interface CartItemProps {
  productId: string
  quantity: number
}

export default function CartItem({ productId, quantity }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart()
  const [product, setProduct] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch product details
    fetch(`/api/products/${productId}`)
      .then((res) => res.json())
      .then((data) => {
        setProduct(data.data || data)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [productId])

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity > 0) {
      updateQuantity(productId, newQuantity)
    }
  }

  const handleRemove = () => {
    removeItem(productId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg animate-pulse">
        <div className="w-20 h-20 bg-gray-300 rounded" />
        <div className="flex-1">
          <div className="h-4 bg-gray-300 rounded w-1/3 mb-2" />
          <div className="h-4 bg-gray-300 rounded w-1/4" />
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <p className="text-gray-500">Product not found</p>
        </div>
        <button
          onClick={handleRemove}
          className="text-red-600 hover:text-red-700 font-medium"
        >
          Remove
        </button>
      </div>
    )
  }

  const imageUrl = product.photos?.[0] || '/images/placeholder.jpg'
  const itemTotal = product.price * quantity

  return (
    <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition">
      {/* Product Image */}
      <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover"
        />
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
        <p className="text-sm text-gray-600">${product.price.toFixed(2)} each</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => handleQuantityChange(quantity - 1)}
            className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
          >
            -
          </button>
          <span className="px-3 py-1 text-sm font-medium">{quantity}</span>
          <button
            onClick={() => handleQuantityChange(quantity + 1)}
            className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded transition"
          >
            +
          </button>
        </div>
      </div>

      {/* Price and Actions */}
      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold text-gray-900">
          ${itemTotal.toFixed(2)}
        </p>
        <button
          onClick={handleRemove}
          className="text-sm text-red-600 hover:text-red-700 font-medium mt-2"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
