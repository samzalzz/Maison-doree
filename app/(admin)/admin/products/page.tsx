'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Search,
  Package,
  Trash2,
  Edit2,
  X,
  Loader2,
  Star,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProductCategory =
  | 'PATES'
  | 'COOKIES'
  | 'GATEAU'
  | 'BRIOUATES'
  | 'CHEBAKIA'
  | 'AUTRES'

interface ProductCount {
  orderItems: number
  ratings: number
  packaging: number
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number | string
  category: ProductCategory
  stock: number
  minimumStock: number
  photos: string[]
  isFeatured: boolean
  createdAt: string
  _count?: ProductCount
}

interface ProductFormData {
  name: string
  description: string
  price: string
  category: ProductCategory
  stock: string
  minimumStock: string
  isFeatured: boolean
  photos: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS: ProductCategory[] = [
  'PATES',
  'COOKIES',
  'GATEAU',
  'BRIOUATES',
  'CHEBAKIA',
  'AUTRES',
]

const CATEGORY_BADGE_CLASSES: Record<ProductCategory, string> = {
  PATES: 'bg-blue-100 text-blue-700',
  COOKIES: 'bg-purple-100 text-purple-700',
  GATEAU: 'bg-pink-100 text-pink-700',
  BRIOUATES: 'bg-orange-100 text-orange-700',
  CHEBAKIA: 'bg-amber-100 text-amber-700',
  AUTRES: 'bg-gray-100 text-gray-600',
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  description: '',
  price: '',
  category: 'PATES',
  stock: '0',
  minimumStock: '10',
  isFeatured: false,
  photos: '',
}

// ---------------------------------------------------------------------------
// Helper: parse photos textarea value into a string array
// ---------------------------------------------------------------------------

function parsePhotos(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Category badge
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: ProductCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_BADGE_CLASSES[category]}`}
    >
      {category}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stock badge
// ---------------------------------------------------------------------------

function StockBadge({ stock, minimumStock }: { stock: number; minimumStock: number }) {
  const isLow = stock <= minimumStock
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isLow ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
      }`}
    >
      {isLow && <AlertTriangle className="w-3 h-3" />}
      {stock}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Product Form Modal (Create + Edit)
// ---------------------------------------------------------------------------

interface ProductFormModalProps {
  initial?: Product | null
  onClose: () => void
  onSaved: () => void
}

function ProductFormModal({ initial, onClose, onSaved }: ProductFormModalProps) {
  const { success, error: toastError } = useToast()
  const isEdit = Boolean(initial)

  const [form, setForm] = useState<ProductFormData>(() => {
    if (!initial) return EMPTY_FORM
    return {
      name: initial.name,
      description: initial.description ?? '',
      price: String(Number(initial.price)),
      category: initial.category,
      stock: String(initial.stock),
      minimumStock: String(initial.minimumStock),
      isFeatured: initial.isFeatured,
      photos: initial.photos.join('\n'),
    }
  })

  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function setField<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate(): boolean {
    const e: Record<string, string> = {}

    if (!form.name.trim()) {
      e.name = 'Product name is required.'
    } else if (form.name.trim().length > 100) {
      e.name = 'Name cannot exceed 100 characters.'
    }

    if (form.description.length > 1000) {
      e.description = 'Description cannot exceed 1000 characters.'
    }

    const priceVal = parseFloat(form.price)
    if (!form.price || isNaN(priceVal) || priceVal <= 0) {
      e.price = 'Price must be a positive number.'
    }

    const stockVal = parseInt(form.stock, 10)
    if (form.stock === '' || isNaN(stockVal) || stockVal < 0) {
      e.stock = 'Stock must be a non-negative integer.'
    }

    const minStockVal = parseInt(form.minimumStock, 10)
    if (form.minimumStock === '' || isNaN(minStockVal) || minStockVal < 0) {
      e.minimumStock = 'Minimum stock must be a non-negative integer.'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price),
        category: form.category,
        stock: parseInt(form.stock, 10),
        minimumStock: parseInt(form.minimumStock, 10),
        isFeatured: form.isFeatured,
        photos: parsePhotos(form.photos),
      }

      const url = isEdit ? `/api/admin/products/${initial!.id}` : '/api/admin/products'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const detail = json.error?.details
          ? Object.values(
              (json.error.details as { fieldErrors?: Record<string, string[]> })
                .fieldErrors ?? {},
            )
              .flat()
              .join(' ')
          : undefined

        toastError({
          title: isEdit ? 'Update Failed' : 'Create Failed',
          message: detail ?? json.error?.message ?? 'An error occurred.',
        })
        return
      }

      success({
        title: isEdit ? 'Product Updated' : 'Product Created',
        message: isEdit
          ? `"${initial!.name}" has been updated.`
          : `"${form.name.trim()}" was created successfully.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? `Edit "${initial!.name}"` : 'Add New Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Cornes de Gazelle"
              maxLength={100}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.name ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Describe the product..."
              rows={3}
              maxLength={1000}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none ${
                errors.description ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-400 mt-0.5 text-right">
              {form.description.length}/1000
            </p>
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description}</p>
            )}
          </div>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Price (MAD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setField('price', e.target.value)}
                  placeholder="45.00"
                  min="0.01"
                  step="0.01"
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors.price ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                <span className="absolute right-3 inset-y-0 flex items-center text-gray-400 text-sm pointer-events-none">
                  MAD
                </span>
              </div>
              {errors.price && <p className="text-xs text-red-600 mt-1">{errors.price}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value as ProductCategory)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock + Minimum Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setField('stock', e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.stock ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.stock && (
                <p className="text-xs text-red-600 mt-1">{errors.stock}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Minimum Stock
              </label>
              <input
                type="number"
                value={form.minimumStock}
                onChange={(e) => setField('minimumStock', e.target.value)}
                placeholder="10"
                min="0"
                step="1"
                className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  errors.minimumStock ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {errors.minimumStock && (
                <p className="text-xs text-red-600 mt-1">{errors.minimumStock}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                Stock alert threshold
              </p>
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Photo URLs
              <span className="text-gray-400 font-normal ml-1 text-xs">(one per line)</span>
            </label>
            <textarea
              value={form.photos}
              onChange={(e) => setField('photos', e.target.value)}
              placeholder={
                'https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg'
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none font-mono"
            />
          </div>

          {/* Featured toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isFeatured"
              checked={form.isFeatured}
              onChange={(e) => setField('isFeatured', e.target.checked)}
              className="w-4 h-4 accent-amber-600"
            />
            <label
              htmlFor="isFeatured"
              className="text-sm font-semibold text-gray-700 cursor-pointer flex items-center gap-1.5"
            >
              <Star className="w-4 h-4 text-amber-500" />
              Featured product (shown on homepage)
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirm Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  product: Product
  onClose: () => void
  onConfirmed: () => void
}

function DeleteConfirmModal({ product, onClose, onConfirmed }: DeleteConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [activeOrderItemCount, setActiveOrderItemCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(true)

  // Fetch the active order item count from the single-product endpoint
  useEffect(() => {
    fetch(`/api/admin/products/${product.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setActiveOrderItemCount(json.data.activeOrderItemCount ?? 0)
        }
      })
      .catch(() => {
        // Non-critical; continue with null
      })
      .finally(() => setLoadingCount(false))
  }, [product.id])

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        const detail =
          json.error?.details?.activeOrderItems !== undefined
            ? `${json.error.details.activeOrderItems} items are in active orders.`
            : undefined

        toastError({
          title: 'Delete Failed',
          message: detail ?? json.error?.message ?? 'Failed to delete product.',
        })
        return
      }

      success({
        title: 'Product Deleted',
        message: `"${product.name}" has been removed.`,
      })
      onConfirmed()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Delete Product</h2>
            <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-gray-700 mb-3">
          You are about to permanently delete{' '}
          <span className="font-bold text-gray-900">"{product.name}"</span>.
        </p>

        {/* Active order warning */}
        {loadingCount ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 p-3 bg-gray-50 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking active orders...
          </div>
        ) : activeOrderItemCount !== null && activeOrderItemCount > 0 ? (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              <span className="font-semibold">{activeOrderItemCount}</span> active order
              item{activeOrderItemCount !== 1 ? 's' : ''} reference this product. Deletion
              will be blocked by the server.
            </p>
          </div>
        ) : (product._count?.orderItems ?? 0) > 0 ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              This product appears in{' '}
              <span className="font-semibold">{product._count!.orderItems}</span> historical
              order item(s). The server will block deletion to preserve order history.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            No active orders reference this product.
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Product'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'ALL'>('ALL')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [total, setTotal] = useState(0)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)

  const { error: toastError } = useToast()

  const fetchProducts = useCallback(
    async (reset = false) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: '25' })
        if (search) params.set('search', search)
        if (categoryFilter !== 'ALL') params.set('category', categoryFilter)
        if (featuredOnly) params.set('featured', 'true')
        if (!reset && nextCursor) params.set('cursor', nextCursor)

        const res = await fetch(`/api/admin/products?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Load Failed',
            message: json.error?.message ?? 'Failed to load products.',
          })
          return
        }

        setProducts((prev) => (reset ? json.data : [...prev, ...json.data]))
        setNextCursor(json.pagination.nextCursor)
        setHasNextPage(json.pagination.hasNextPage)
        setTotal(json.pagination.total)
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, categoryFilter, featuredOnly],
  )

  // Reload on filter / search changes
  useEffect(() => {
    setNextCursor(null)
    fetchProducts(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, featuredOnly])

  const handleSaved = () => {
    setShowCreateModal(false)
    setEditProduct(null)
    setNextCursor(null)
    fetchProducts(true)
  }

  const handleDeleted = () => {
    setDeleteProduct(null)
    setNextCursor(null)
    fetchProducts(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} product{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setNextCursor(null)
              fetchProducts(true)
            }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', ...CATEGORY_OPTIONS] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                categoryFilter === cat
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Featured toggle */}
        <button
          type="button"
          onClick={() => setFeaturedOnly((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            featuredOnly
              ? 'bg-yellow-400 text-yellow-900 border-yellow-400'
              : 'bg-white text-gray-600 border-gray-300 hover:border-yellow-400'
          }`}
        >
          <Star className="w-3 h-3" />
          Featured only
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Featured
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Packaging
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && products.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-gray-500">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium text-gray-700">No products found</p>
                    <p className="text-xs mt-1 text-gray-400">
                      {search || categoryFilter !== 'ALL' || featuredOnly
                        ? 'Try adjusting your filters or search term.'
                        : 'Add your first product to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Product name */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 max-w-[200px] truncate">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">
                          {product.description}
                        </p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <CategoryBadge category={product.category} />
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {Number(product.price).toFixed(2)} MAD
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3">
                      <StockBadge stock={product.stock} minimumStock={product.minimumStock} />
                      <p className="text-xs text-gray-400 mt-0.5">
                        min: {product.minimumStock}
                      </p>
                    </td>

                    {/* Featured */}
                    <td className="px-4 py-3">
                      {product.isFeatured ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Packaging count */}
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {product._count?.packaging ?? 0} option
                      {(product._count?.packaging ?? 0) !== 1 ? 's' : ''}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasNextPage && (
          <div className="px-4 py-4 border-t border-gray-200">
            <LoadMoreButton
              onClick={() => fetchProducts(false)}
              isLoading={isLoading}
              label="Load More Products"
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <ProductFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {editProduct && (
        <ProductFormModal
          initial={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={handleSaved}
        />
      )}

      {deleteProduct && (
        <DeleteConfirmModal
          product={deleteProduct}
          onClose={() => setDeleteProduct(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  )
}
