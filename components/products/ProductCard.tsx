'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/lib/hooks/useCart'

interface ProductCardProps {
  id: string
  name: string
  price: number
  category: string
  photos?: string[]
  isFeatured?: boolean
}

export default function ProductCard({
  id,
  name,
  price,
  category,
  photos,
  isFeatured,
}: ProductCardProps) {
  const { addItem } = useCart()
  const [isAdding, setIsAdding] = useState(false)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsAdding(true)
    try {
      await addItem(id, 1)
    } finally {
      setIsAdding(false)
    }
  }

  const imageUrl = photos?.[0] || '/images/placeholder.jpg'

  return (
    <Link href={`/products/${id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden h-full flex flex-col">
        {/* Product Image */}
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          {isFeatured && (
            <div className="absolute top-2 right-2 z-10 bg-amber-600 text-white px-3 py-1 rounded text-sm font-semibold">
              Featured
            </div>
          )}
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover hover:scale-105 transition duration-300"
          />
        </div>

        {/* Product Info */}
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-2">
            {name}
          </h3>
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wide">
            {category}
          </p>

          <div className="mt-auto">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-2xl font-bold text-amber-600">
                ${price.toFixed(2)}
              </span>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="w-full bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isAdding ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
