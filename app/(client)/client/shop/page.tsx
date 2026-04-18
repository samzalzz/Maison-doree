'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ProductGrid from '@/components/products/ProductGrid'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import { PageSizeSelect } from '@/components/ui/PageSizeSelect'
import { usePagination } from '@/lib/hooks/usePagination'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string
  name: string
  price: number
  category: string
  photos?: string[]
  isFeatured?: boolean
}

interface ProductsApiResponse {
  data: Product[]
  nextCursor: string | null
  pagination: {
    limit: number
    nextCursor: string | null
    hasNextPage: boolean
  }
}

const CATEGORIES = [
  { value: '', label: 'All Products' },
  { value: 'PATES', label: 'Pates' },
  { value: 'COOKIES', label: 'Cookies' },
  { value: 'GATEAU', label: 'Gateau' },
  { value: 'BRIOUATES', label: 'Briouates' },
  { value: 'CHEBAKIA', label: 'Chebakia' },
  { value: 'AUTRES', label: 'Autres' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read initial filter state from URL for bookmarkability
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') ?? '',
  )
  const [showFeatured, setShowFeatured] = useState(
    searchParams.get('featured') === 'true',
  )
  const [pageSize, setPageSize] = useState(
    parseInt(searchParams.get('pageSize') ?? '20', 10) || 20,
  )

  // Mutable ref so fetchFn callback stays stable (avoids stale closures)
  const filtersRef = useRef({ selectedCategory, showFeatured })
  filtersRef.current = { selectedCategory, showFeatured }

  const fetchProducts = useCallback(
    async (cursor: string | null, limit: number) => {
      const { selectedCategory: cat, showFeatured: featured } = filtersRef.current
      const params = new URLSearchParams()
      if (cat) params.set('category', cat)
      if (featured) params.set('featured', 'true')
      params.set('limit', String(limit))
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/products?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch products.')
      const data: ProductsApiResponse = await res.json()

      return {
        items: data.data ?? [],
        nextCursor: data.nextCursor ?? null,
      }
    },
    // intentionally empty — fetchFn must stay stable; filters read via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { items, isLoading, hasMore, loadMore, reset } = usePagination<Product>({
    pageSize,
    fetchFn: fetchProducts,
  })

  // Track which combination of filters was last active
  const prevFiltersKey = useRef<string | null>(null)

  useEffect(() => {
    const key = `${selectedCategory}|${showFeatured}|${pageSize}`

    if (prevFiltersKey.current === null) {
      // First mount — kick off initial load
      prevFiltersKey.current = key
      reset()
      return
    }

    if (prevFiltersKey.current === key) return
    prevFiltersKey.current = key

    // Sync to URL for bookmarking / sharing
    const params = new URLSearchParams()
    if (selectedCategory) params.set('category', selectedCategory)
    if (showFeatured) params.set('featured', 'true')
    if (pageSize !== 20) params.set('pageSize', String(pageSize))
    const qs = params.toString()
    router.replace(`/shop${qs ? `?${qs}` : ''}`, { scroll: false })

    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, showFeatured, pageSize])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Our Products</h1>
          <p className="text-gray-600">
            Discover our delicious selection of traditional Moroccan pastries
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            {/* Category Filter */}
            <div>
              <label
                htmlFor="category-select"
                className="block text-sm font-semibold text-gray-700 mb-3"
              >
                Category
              </label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                aria-label="Filter by product category"
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
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  aria-label="Show featured products only"
                />
                <span className="text-gray-700">Show Featured Only</span>
              </label>
            </div>

            {/* Page Size */}
            <PageSizeSelect
              value={pageSize}
              onChange={(size) => setPageSize(size)}
              options={[12, 20, 40, 80]}
            />
          </div>
        </div>

        {/* Products Grid */}
        <ProductGrid products={items} isLoading={isLoading && items.length === 0} />

        {/* Load More button — visible while there are more pages */}
        {items.length > 0 && (hasMore || (isLoading && items.length > 0)) && (
          <div className="mt-10">
            <LoadMoreButton
              onClick={loadMore}
              isLoading={isLoading}
              label="Load More Products"
            />
          </div>
        )}

        {/* End of results notice */}
        {items.length > 0 && !hasMore && !isLoading && (
          <p
            className="mt-8 text-center text-sm text-gray-500"
            aria-live="polite"
          >
            Showing all {items.length} product{items.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
