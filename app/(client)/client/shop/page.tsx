'use client'

import React, { useState, useEffect } from 'react'
import ProductGrid from '@/components/products/ProductGrid'

interface Product {
  id: string
  name: string
  price: number
  category: string
  photos?: string[]
  isFeatured?: boolean
}

const CATEGORIES = [
  { value: '', label: 'All Products' },
  { value: 'PATES', label: 'Pâtes' },
  { value: 'COOKIES', label: 'Cookies' },
  { value: 'GATEAU', label: 'Gâteau' },
  { value: 'BRIOUATES', label: 'Briouates' },
  { value: 'CHEBAKIA', label: 'Chebakia' },
  { value: 'AUTRES', label: 'Autres' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showFeatured, setShowFeatured] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedCategory) params.append('category', selectedCategory)
        if (showFeatured) params.append('featured', 'true')

        const response = await fetch(`/api/products?${params.toString()}`)
        const data = await response.json()

        setProducts(data.data || [])
      } catch (error) {
        console.error('Failed to fetch products:', error)
        setProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [selectedCategory, showFeatured])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Our Products
          </h1>
          <p className="text-gray-600">
            Discover our delicious selection of traditional Moroccan pastries
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Featured Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Filter
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFeatured}
                  onChange={(e) => setShowFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600"
                />
                <span className="text-gray-700">Show Featured Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <ProductGrid products={products} isLoading={isLoading} />
      </div>
    </div>
  )
}
