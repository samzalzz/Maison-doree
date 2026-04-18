'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Edit2,
  X,
  Loader2,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Check,
  User,
  Package,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED'

type PaymentMethod = 'STRIPE' | 'CASH_ON_DELIVERY'
type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

interface UserProfile {
  firstName: string | null
  lastName: string | null
  phone: string | null
}

interface OrderUser {
  id: string
  email: string
  profile: UserProfile | null
}

interface OrderProduct {
  id: string
  name: string
  price: number | string
  category: string
  photos: string[]
}

interface OrderItem {
  id: string
  productId: string
  quantity: number
  priceAtTime: number | string
  packaging: string | null
  packagingPrice: number | string
  product: OrderProduct
}

interface Payment {
  id: string
  amount: number | string
  method: PaymentMethod
  status: PaymentStatus
}

interface Delivery {
  id: string
  status: string
  driver: { id: string; email: string; profile: UserProfile | null } | null
}

interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  subtotal: number | string
  taxAmount: number | string
  totalPrice: number | string
  deliveryAddress: string
  deliveryCity: string
  deliveryZipCode: string
  createdAt: string
  user: OrderUser
  items: OrderItem[]
  payment: Payment | null
  delivery: Delivery | null
}

interface CustomerOption {
  id: string
  email: string
  profile: UserProfile | null
}

interface ProductOption {
  id: string
  name: string
  price: number | string
  stock: number
  category: string
}

interface NewOrderItem {
  productId: string
  productName: string
  price: number
  stock: number
  quantity: number
  packaging: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'ASSIGNED',
  'IN_PROGRESS',
  'DELIVERED',
  'CANCELLED',
]

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  ASSIGNED: 'bg-purple-100 text-purple-800 border-purple-200',
  IN_PROGRESS: 'bg-orange-100 text-orange-800 border-orange-200',
  DELIVERED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

const TAX_RATE = 0.2

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number | string): string {
  return `${Number(value).toFixed(2)} MAD`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function customerName(user: OrderUser): string {
  const { firstName, lastName } = user.profile ?? {}
  if (firstName || lastName) return `${firstName ?? ''} ${lastName ?? ''}`.trim()
  return user.email
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status Update Modal
// ---------------------------------------------------------------------------

interface StatusModalProps {
  order: Order
  onClose: () => void
  onUpdated: (updated: Order) => void
}

function StatusModal({ order, onClose, onUpdated }: StatusModalProps) {
  const { success, error: toastError } = useToast()
  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [isSaving, setIsSaving] = useState(false)

  const updatableStatuses = STATUS_OPTIONS.filter((s) => s !== 'CANCELLED')

  const handleSave = async () => {
    if (status === order.status) { onClose(); return }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toastError({ title: 'Update Failed', message: json.error?.message ?? 'Failed to update status.' })
        return
      }
      success({ title: 'Status Updated', message: `Order ${order.orderNumber} is now ${STATUS_LABELS[status]}.` })
      onUpdated(json.data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Update Order Status</h2>
            <p className="text-sm text-gray-500 mt-0.5">{order.orderNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">New Status</label>
            <div className="space-y-2">
              {updatableStatuses.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    status === s
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      status === s ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                    }`}
                  >
                    {status === s && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <StatusBadge status={s} />
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || status === order.status}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : 'Save Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel Confirm Modal
// ---------------------------------------------------------------------------

interface CancelModalProps {
  order: Order
  onClose: () => void
  onCancelled: (updated: Order) => void
}

function CancelModal({ order, onClose, onCancelled }: CancelModalProps) {
  const { success, error: toastError } = useToast()
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toastError({ title: 'Cancel Failed', message: json.error?.message ?? 'Failed to cancel order.' })
        return
      }
      success({ title: 'Order Cancelled', message: `${order.orderNumber} cancelled. Stock has been restored.` })
      onCancelled(json.data)
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cancel Order</h2>
            <p className="text-sm text-gray-500 mt-0.5">{order.orderNumber}</p>
          </div>
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Cancelling this order will <span className="font-semibold">restore stock</span> for
              all {order.items.length} item{order.items.length !== 1 ? 's' : ''}. The order record
              will be kept for audit purposes.
            </p>
          </div>
        </div>

        <div className="mb-5 space-y-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm text-gray-700">
              <span className="truncate max-w-[220px]">{item.product.name}</span>
              <span className="text-gray-500 ml-2">+{item.quantity} returned</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isCancelling ? <><Loader2 className="w-4 h-4 animate-spin" />Cancelling...</> : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New Order Modal
// ---------------------------------------------------------------------------

interface NewOrderModalProps {
  onClose: () => void
  onCreated: (order: Order) => void
}

function NewOrderModal({ onClose, onCreated }: NewOrderModalProps) {
  const { success, error: toastError } = useToast()

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Product search
  const [productSearch, setProductSearch] = useState('')
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Order items
  const [orderItems, setOrderItems] = useState<NewOrderItem[]>([])

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY')

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Debounce refs
  const customerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const productDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search customers
  useEffect(() => {
    if (customerDebounce.current) clearTimeout(customerDebounce.current)
    if (!customerSearch.trim()) { setCustomers([]); return }

    customerDebounce.current = setTimeout(async () => {
      setLoadingCustomers(true)
      try {
        const res = await fetch(
          `/api/admin/users?search=${encodeURIComponent(customerSearch)}&limit=10`,
        )
        const json = await res.json()
        if (json.success) setCustomers(json.data ?? [])
      } catch { /* silent */ } finally {
        setLoadingCustomers(false)
      }
    }, 300)
  }, [customerSearch])

  // Search products
  useEffect(() => {
    if (productDebounce.current) clearTimeout(productDebounce.current)
    if (!productSearch.trim()) { setProductOptions([]); return }

    productDebounce.current = setTimeout(async () => {
      setLoadingProducts(true)
      try {
        const res = await fetch(
          `/api/admin/products?search=${encodeURIComponent(productSearch)}&limit=10`,
        )
        const json = await res.json()
        if (json.success) setProductOptions(json.data ?? [])
      } catch { /* silent */ } finally {
        setLoadingProducts(false)
      }
    }, 300)
  }, [productSearch])

  // Computed totals
  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const taxAmount = subtotal * TAX_RATE
  const totalPrice = subtotal + taxAmount

  function addProduct(product: ProductOption) {
    setProductSearch('')
    setProductOptions([])
    setShowProductDropdown(false)

    setOrderItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        // Increment if already added
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
            : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          price: Number(product.price),
          stock: product.stock,
          quantity: 1,
          packaging: '',
        },
      ]
    })
  }

  function updateQuantity(productId: string, qty: number) {
    setOrderItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) }
          : i,
      ),
    )
  }

  function removeItem(productId: string) {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!selectedCustomer) e.customer = 'Please select a customer.'
    if (orderItems.length === 0) e.items = 'Add at least one product.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const payload = {
        userId: selectedCustomer!.id,
        items: orderItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          packaging: i.packaging || null,
        })),
        paymentMethod,
      }

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        const msg = json.error?.message ?? 'Failed to create order.'
        toastError({ title: 'Create Failed', message: msg })
        return
      }

      success({ title: 'Order Created', message: `${json.data.orderNumber} created successfully.` })
      onCreated(json.data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">New Order</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* --- Customer --- */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Customer <span className="text-red-500">*</span>
              </label>

              {selectedCustomer ? (
                <div className="flex items-center justify-between px-4 py-3 border border-green-300 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {customerName(selectedCustomer)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="ml-3 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search by email or name..."
                      className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        errors.customer ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {loadingCustomers && (
                      <Loader2 className="absolute right-3 inset-y-0 my-auto w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </div>

                  {showCustomerDropdown && customers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c)
                            setCustomerSearch('')
                            setCustomers([])
                            setShowCustomerDropdown(false)
                            setErrors((prev) => { const next = { ...prev }; delete next.customer; return next })
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {customerName(c)}
                          </p>
                          <p className="text-xs text-gray-500">{c.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {errors.customer && <p className="text-xs text-red-600 mt-1">{errors.customer}</p>}
            </div>

            {/* --- Products --- */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Products <span className="text-red-500">*</span>
              </label>

              {/* Product search */}
              <div className="relative mb-3">
                <div className="relative">
                  <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true) }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Search products to add..."
                    className={`w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      errors.items ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {loadingProducts && (
                    <Loader2 className="absolute right-3 inset-y-0 my-auto w-4 h-4 animate-spin text-gray-400" />
                  )}
                </div>

                {showProductDropdown && productOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p)}
                        disabled={p.stock === 0}
                        className="w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.category}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">{Number(p.price).toFixed(2)} MAD</p>
                          <p className={`text-xs ${p.stock === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {errors.items && <p className="text-xs text-red-600 mb-2">{errors.items}</p>}

              {/* Items list */}
              {orderItems.length > 0 ? (
                <div className="space-y-2">
                  {orderItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500">{Number(item.price).toFixed(2)} MAD each</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                        {(item.price * item.quantity).toFixed(2)} MAD
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-400 border border-dashed border-gray-300 rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No products added yet</p>
                </div>
              )}
            </div>

            {/* --- Payment Method --- */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                {(['CASH_ON_DELIVERY', 'STRIPE'] as PaymentMethod[]).map((method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      paymentMethod === method
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        paymentMethod === method ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                      }`}
                    >
                      {paymentMethod === method && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {method === 'CASH_ON_DELIVERY' ? 'Cash on Delivery' : 'Stripe'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* --- Order Summary --- */}
            {orderItems.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Order Summary</h3>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{subtotal.toFixed(2)} MAD</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax (20%)</span>
                  <span>{taxAmount.toFixed(2)} MAD</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{totalPrice.toFixed(2)} MAD</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Creating...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Order
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)

  // Modal state
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null)

  const { error: toastError } = useToast()

  const fetchOrders = useCallback(
    async (reset = false) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ limit: '20' })
        if (search) params.set('search', search)
        if (statusFilter !== 'ALL') params.set('status', statusFilter)
        if (!reset && nextCursor) params.set('cursor', nextCursor)

        const res = await fetch(`/api/admin/orders?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({ title: 'Load Failed', message: json.error?.message ?? 'Failed to load orders.' })
          return
        }

        setOrders((prev) => (reset ? json.data : [...prev, ...json.data]))
        setNextCursor(json.pagination.nextCursor)
        setHasNextPage(json.pagination.hasNextPage)
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, statusFilter],
  )

  // Refetch when filters change
  useEffect(() => {
    setNextCursor(null)
    fetchOrders(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  function handleOrderCreated(order: Order) {
    setShowNewOrderModal(false)
    setOrders((prev) => [order, ...prev])
  }

  function handleOrderUpdated(updated: Order) {
    setEditOrder(null)
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  function handleOrderCancelled(updated: Order) {
    setCancelOrder(null)
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer orders and stock deductions</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setNextCursor(null); fetchOrders(true) }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowNewOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order # or email..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === s
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Order #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Products
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && orders.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                    <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium text-gray-700">No orders found</p>
                    <p className="text-xs mt-1 text-gray-400">
                      {search || statusFilter !== 'ALL'
                        ? 'Try adjusting your filters or search term.'
                        : 'Create the first order using the "New Order" button.'}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    {/* Order # */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {order.orderNumber}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs max-w-[160px] truncate">
                        {customerName(order.user)}
                      </p>
                      <p className="text-xs text-gray-400 max-w-[160px] truncate">
                        {order.user.email}
                      </p>
                    </td>

                    {/* Products */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5 max-w-[200px]">
                        {order.items.slice(0, 2).map((item) => (
                          <p key={item.id} className="text-xs text-gray-700 truncate">
                            {item.quantity}x {item.product.name}
                          </p>
                        ))}
                        {order.items.length > 2 && (
                          <p className="text-xs text-gray-400">
                            +{order.items.length - 2} more
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap text-xs">
                      {formatCurrency(order.totalPrice)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-3">
                      {order.payment ? (
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              order.payment.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : order.payment.status === 'FAILED'
                                ? 'bg-red-100 text-red-700'
                                : order.payment.status === 'REFUNDED'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {order.payment.status}
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {order.payment.method === 'CASH_ON_DELIVERY' ? 'COD' : 'Stripe'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                          <button
                            type="button"
                            onClick={() => setEditOrder(order)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                            title="Update status"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (
                          <button
                            type="button"
                            onClick={() => setCancelOrder(order)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Cancel order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {(order.status === 'CANCELLED' || order.status === 'DELIVERED') && (
                          <span className="text-xs text-gray-400 px-2">
                            {order.status === 'DELIVERED' ? 'Delivered' : 'Cancelled'}
                          </span>
                        )}
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
              onClick={() => fetchOrders(false)}
              isLoading={isLoading}
              label="Load More Orders"
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewOrderModal && (
        <NewOrderModal
          onClose={() => setShowNewOrderModal(false)}
          onCreated={handleOrderCreated}
        />
      )}

      {editOrder && (
        <StatusModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onUpdated={handleOrderUpdated}
        />
      )}

      {cancelOrder && (
        <CancelModal
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onCancelled={handleOrderCancelled}
        />
      )}
    </div>
  )
}
