'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useToastContext } from '@/lib/context/ToastContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockProduct {
  id: string
  name: string
  stock: number
  minimumStock: number
}

interface ApiSuccessResponse {
  success: true
  data: StockProduct[]
  pagination?: { nextCursor: string | null; hasNextPage: boolean }
}

interface ApiErrorResponse {
  success: false
  error: { code: string; message: string }
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse

interface AdjustSuccessResponse {
  success: true
  data: StockProduct
}

interface AdjustErrorResponse {
  success: false
  error: { code: string; message: string }
}

type AdjustResponse = AdjustSuccessResponse | AdjustErrorResponse

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StockPage() {
  const { addToast } = useToastContext()

  const [products, setProducts] = useState<StockProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(null)
  const [adjustment, setAdjustment] = useState<number | ''>('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  const adjustmentInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // Fetch all products on mount
  // ---------------------------------------------------------------------------

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      // Fetch up to 100 products; pagination not needed for stock management view
      const res = await fetch('/api/admin/products?limit=100')
      const json: ApiResponse = await res.json()

      if (!json.success) {
        setFetchError((json as ApiErrorResponse).error.message)
        return
      }

      // Sort ascending by stock so low-stock items surface first
      const sorted = [...(json as ApiSuccessResponse).data].sort(
        (a, b) => a.stock - b.stock,
      )
      setProducts(sorted)
    } catch {
      setFetchError('Network error. Could not load products.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------

  function openModal(product: StockProduct) {
    setSelectedProduct(product)
    setAdjustment('')
    setShowModal(true)
    // Focus the input on next tick after the modal renders
    setTimeout(() => adjustmentInputRef.current?.focus(), 50)
  }

  function closeModal() {
    setShowModal(false)
    setSelectedProduct(null)
    setAdjustment('')
  }

  // ---------------------------------------------------------------------------
  // Submit adjustment
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct || adjustment === '' || adjustment === 0) return

    setIsAdjusting(true)
    try {
      const res = await fetch(
        `/api/admin/stocks/${selectedProduct.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adjustment }),
        },
      )
      const json: AdjustResponse = await res.json()

      if (!json.success) {
        addToast({
          type: 'error',
          title: 'Update failed',
          message: (json as AdjustErrorResponse).error.message,
        })
        return
      }

      const updated = (json as AdjustSuccessResponse).data

      // Live-update the product in state, then re-sort
      setProducts((prev) =>
        [...prev.map((p) => (p.id === updated.id ? updated : p))].sort(
          (a, b) => a.stock - b.stock,
        ),
      )

      addToast({ type: 'success', title: 'Stock updated!' })
      closeModal()
    } catch {
      addToast({
        type: 'error',
        title: 'Network error',
        message: 'Could not reach the server. Please try again.',
      })
    } finally {
      setIsAdjusting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const lowStockProducts = products.filter((p) => p.stock <= p.minimumStock)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
        <p className="text-gray-600 mt-1">
          Monitor and adjust inventory levels across all products
        </p>
      </div>

      {/* Low Stock Alert */}
      {!isLoading && lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-2xl mr-4">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
              <p className="text-sm text-red-700 mt-1">
                {lowStockProducts.length} product(s) are at or below minimum
                stock level.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {fetchError}
          <button
            onClick={fetchProducts}
            className="ml-4 underline font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stock Levels Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              Loading products...
            </div>
          ) : products.length === 0 && !fetchError ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No products found.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Minimum Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isLowStock = product.stock <= product.minimumStock
                  const stockPercentage = Math.round(
                    (product.stock /
                      Math.max(product.minimumStock * 2, 1)) *
                      100,
                  )

                  return (
                    <tr
                      key={product.id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isLowStock ? 'bg-red-500' : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(stockPercentage, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="font-semibold text-gray-900 min-w-[2rem]">
                            {product.stock}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {product.minimumStock}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            isLowStock
                              ? 'text-red-600 bg-red-50'
                              : 'text-green-600 bg-green-50'
                          }`}
                        >
                          {isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => openModal(product)}
                          className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Stock Summary */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Products</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {products.length}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
            <p className="text-sm text-green-700">Adequate Stock</p>
            <p className="text-2xl font-bold text-green-900 mt-2">
              {products.filter((p) => p.stock > p.minimumStock).length}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow border border-red-200">
            <p className="text-sm text-red-700">Low Stock</p>
            <p className="text-2xl font-bold text-red-900 mt-2">
              {lowStockProducts.length}
            </p>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showModal && selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              Adjust Stock
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Product name — read only */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Product
                </label>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  {selectedProduct.name}
                </p>
              </div>

              {/* Current stock — read only */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Current Stock
                </label>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                  {selectedProduct.stock} units
                </p>
              </div>

              {/* Adjustment input */}
              <div>
                <label
                  htmlFor="adjustment"
                  className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1"
                >
                  Adjustment
                </label>
                <input
                  id="adjustment"
                  ref={adjustmentInputRef}
                  type="number"
                  value={adjustment}
                  onChange={(e) =>
                    setAdjustment(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  placeholder="e.g. +50 or -10"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                {adjustment !== '' && adjustment !== 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    New stock will be:{' '}
                    <span className="font-semibold text-gray-700">
                      {Math.max(
                        0,
                        selectedProduct.stock + (adjustment as number),
                      )}{' '}
                      units
                    </span>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isAdjusting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isAdjusting || adjustment === '' || adjustment === 0
                  }
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAdjusting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
