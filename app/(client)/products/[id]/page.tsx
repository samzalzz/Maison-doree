'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/lib/hooks/useCart'
import { useParams } from 'next/navigation'

interface Product {
  id: string
  name: string
  description?: string
  price: number
  category: string
  photos?: string[]
  stock: number
  isFeatured?: boolean
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const { addItem } = useCart()

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`)
        const data = await response.json()
        setProduct(data.data || data)
      } catch (error) {
        console.error('Failed to fetch product:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const handleAddToCart = async () => {
    if (!product) return

    setIsAddingToCart(true)
    try {
      await addItem(product.id, quantity)
      // Reset quantity after adding
      setQuantity(1)
      // Show success message (could be improved with toast)
      alert('Added to cart!')
    } catch (error) {
      console.error('Failed to add to cart:', error)
    } finally {
      setIsAddingToCart(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-300 rounded-lg h-96 animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-300 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-gray-300 rounded w-1/2 animate-pulse" />
              <div className="h-4 bg-gray-300 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Product not found
            </h1>
            <Link
              href="/products"
              className="text-amber-600 hover:text-amber-700 font-medium"
            >
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const imageUrl = product.photos?.[0] || '/images/placeholder.jpg'
  const isInStock = product.stock > 0

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/products"
            className="text-amber-600 hover:text-amber-700 font-medium"
          >
            ← Back to Products
          </Link>
        </div>

        {/* Product Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-lg p-6 shadow-sm">
          {/* Images */}
          <div className="flex flex-col gap-4">
            <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {product.isFeatured && (
                <div className="absolute top-4 right-4 z-10 bg-amber-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Featured
                </div>
              )}
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>

            {/* Image Thumbnails */}
            {product.photos && product.photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                  >
                    <Image
                      src={photo}
                      alt={`${product.name} ${idx + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>
              <p className="text-amber-600 font-semibold uppercase tracking-wide">
                {product.category}
              </p>
            </div>

            {/* Price and Stock */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-amber-600">
                  ${product.price.toFixed(2)}
                </span>
              </div>
              <div className="mt-2">
                {isInStock ? (
                  <p className="text-green-600 font-semibold">
                    {product.stock} in stock
                  </p>
                ) : (
                  <p className="text-red-600 font-semibold">Out of stock</p>
                )}
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Description
                </h2>
                <p className="text-gray-700 leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Add to Cart */}
            <div className="mt-auto space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-700">
                  Quantity:
                </label>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={!isInStock}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 font-medium">{quantity}</span>
                  <button
                    onClick={() =>
                      setQuantity(Math.min(product.stock, quantity + 1))
                    }
                    disabled={!isInStock || quantity >= product.stock}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!isInStock || isAddingToCart}
                className="w-full bg-amber-600 text-white py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {isAddingToCart
                  ? 'Adding...'
                  : isInStock
                    ? 'Add to Cart'
                    : 'Out of Stock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
