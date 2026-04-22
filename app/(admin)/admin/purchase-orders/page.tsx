'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { LoadMoreButton } from '@/components/ui/LoadMoreButton'
import {
  Plus,
  Search,
  ShoppingCart,
  XCircle,
  Loader2,
  RefreshCw,
  X,
  PackageCheck,
  Clock,
  Ban,
  Truck,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PoStatus = 'pending' | 'ordered' | 'delivered' | 'cancelled'

interface PurchaseOrderApiItem {
  materialId: string
  material: { id: string; name: string; unit: string }
  quantity: number
  unitPrice: number
  lineTotal: number
}

interface PurchaseOrder {
  id: string
  poNumber: string
  supplierId: string
  supplier: { id: string; name: string }
  items: PurchaseOrderApiItem[]
  totalCost: number
  deliveryDate: string
  status: PoStatus
  createdAt: string
  deliveredAt: string | null
}

interface Supplier {
  id: string
  name: string
  leadTimeDays: number
  categories: string[]
}

interface RawMaterial {
  id: string
  name: string
  unit: string
  type: string
}

interface Lab {
  id: string
  name: string
  type: string
}

interface PurchaseOrderItem {
  materialId: string
  quantity: string
  unitPrice: string
}

interface CreateFormData {
  supplierId: string
  items: PurchaseOrderItem[]
  deliveryDate: string
}

const EMPTY_CREATE_FORM: CreateFormData = {
  supplierId: '',
  items: [{ materialId: '', quantity: '', unitPrice: '' }],
  deliveryDate: '',
}

const EMPTY_ITEM: PurchaseOrderItem = {
  materialId: '',
  quantity: '',
  unitPrice: '',
}

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit / Net Terms' },
]

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helper: format date
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PoStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      )
    case 'ordered':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          <Truck className="w-3 h-3" />
          Ordered
        </span>
      )
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          <PackageCheck className="w-3 h-3" />
          Delivered
        </span>
      )
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
          <Ban className="w-3 h-3" />
          Cancelled
        </span>
      )
  }
}

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  suppliers: Supplier[]
  materials: RawMaterial[]
  onClose: () => void
  onSaved: () => void
}

function CreatePurchaseOrderModal({
  suppliers,
  materials,
  onClose,
  onSaved,
}: CreateModalProps) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState<CreateFormData>(EMPTY_CREATE_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function setField<K extends keyof CreateFormData>(key: K, value: CreateFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function setItemField(index: number, field: keyof PurchaseOrderItem, value: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }))
  }

  function removeItem(index: number) {
    if (form.items.length === 1) return // Must have at least 1 item
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}

    if (!form.supplierId) e.supplierId = 'Supplier is required.'

    if (form.items.length === 0) {
      e.items = 'At least one item is required.'
    } else {
      form.items.forEach((item, index) => {
        if (!item.materialId) {
          e[`item_${index}_material`] = 'Material is required.'
        }

        const qty = parseFloat(item.quantity)
        if (!item.quantity || isNaN(qty) || qty <= 0) {
          e[`item_${index}_quantity`] = 'Quantity must be a positive number.'
        }

        const price = parseFloat(item.unitPrice)
        if (!item.unitPrice || isNaN(price) || price <= 0) {
          e[`item_${index}_price`] = 'Unit price must be a positive number.'
        }
      })

      // Check for duplicate materials
      const materialIds = form.items.map((item) => item.materialId).filter(Boolean)
      const uniqueIds = new Set(materialIds)
      if (materialIds.length !== uniqueIds.size) {
        e.items = 'Duplicate materials in order - select different materials for each item.'
      }
    }

    if (!form.deliveryDate) {
      e.deliveryDate = 'Delivery date is required.'
    } else {
      const deliveryMs = new Date(form.deliveryDate).getTime()
      if (deliveryMs <= Date.now()) {
        e.deliveryDate = 'Delivery date must be in the future.'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      // Build payload with explicit NaN checks
      const payload = {
        supplierId: form.supplierId,
        items: form.items.map((item, idx) => {
          const qty = parseFloat(item.quantity)
          const price = parseFloat(item.unitPrice)

          // Safety check - if values are NaN, report the actual state
          if (isNaN(qty) || isNaN(price)) {
            console.error(`Item ${idx} has invalid values:`, { quantity: item.quantity, unitPrice: item.unitPrice, qty, price })
          }

          return {
            materialId: item.materialId,
            quantity: qty,
            unitPrice: price,
          }
        }),
        deliveryDate: new Date(form.deliveryDate).toISOString(),
      }

      const res = await fetch('/api/admin/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Create Failed',
          message: json.error?.message ?? 'Failed to create purchase order.',
        })
        return
      }

      success({
        title: 'Order Created',
        message: `Purchase order ${json.data.poNumber} has been created with ${json.data.items?.length ?? 1} item(s).`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const selectedMaterial = materials.find((m) => m.id === form.materialId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">New Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Supplier */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Supplier <span className="text-red-500">*</span>
            </label>
            <select
              value={form.supplierId}
              onChange={(e) => setField('supplierId', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.supplierId ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Select a supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.leadTimeDays}d lead time)
                </option>
              ))}
            </select>
            {errors.supplierId && (
              <p className="text-xs text-red-600 mt-1">{errors.supplierId}</p>
            )}
          </div>

          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                Order Items <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addItem}
                disabled={form.items.length >= materials.length}
                title={form.items.length >= materials.length ? 'All materials selected' : 'Add another item'}
                className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3 h-3 inline mr-1" /> Add Item
              </button>
            </div>

            {errors.items && (
              <p className="text-xs text-red-600 mb-2">{errors.items}</p>
            )}

            <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
              {form.items.map((item, idx) => {
                const selectedMaterial = materials.find((m) => m.id === item.materialId)
                const usedMaterialIds = form.items.map((i) => i.materialId).filter(Boolean)
                const availableMaterials = materials.filter(
                  (m) => !usedMaterialIds.includes(m.id) || m.id === item.materialId
                )
                const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice) || 0

                return (
                  <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                    {/* Material Selection */}
                    <select
                      value={item.materialId}
                      onChange={(e) => setItemField(idx, 'materialId', e.target.value)}
                      className={`w-full px-3 py-2 border rounded text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        errors[`item_${idx}_material`] ? 'border-red-400' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select material...</option>
                      {availableMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                    </select>
                    {errors[`item_${idx}_material`] && (
                      <p className="text-xs text-red-600 mb-2">{errors[`item_${idx}_material`]}</p>
                    )}

                    {/* Quantity & Unit Price */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Qty</label>
                        <input
                          type="text"
                          value={item.quantity}
                          onChange={(e) => setItemField(idx, 'quantity', e.target.value)}
                          placeholder="0"
                          className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                            errors[`item_${idx}_quantity`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {errors[`item_${idx}_quantity`] && (
                          <p className="text-xs text-red-600 mt-0.5">{errors[`item_${idx}_quantity`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Unit Price</label>
                        <input
                          type="text"
                          value={item.unitPrice}
                          onChange={(e) => setItemField(idx, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                            errors[`item_${idx}_price`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {errors[`item_${idx}_price`] && (
                          <p className="text-xs text-red-600 mt-0.5">{errors[`item_${idx}_price`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Total</label>
                        <div className="px-2 py-1 bg-gray-100 rounded text-sm font-medium text-gray-700">
                          {lineTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Remove Button */}
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="w-full text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Remove Item
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Expected Delivery Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={(e) => setField('deliveryDate', e.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                errors.deliveryDate ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.deliveryDate && (
              <p className="text-xs text-red-600 mt-1">{errors.deliveryDate}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Payment Method
              <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>
            </label>
            <select
              defaultValue=""
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select payment method...</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.label}
                </option>
              ))}
            </select>
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
                  Creating...
                </>
              ) : (
                'Create Order'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Receive Delivery Modal
// ---------------------------------------------------------------------------

interface ReceiveDeliveryModalProps {
  order: PurchaseOrder
  labs: Lab[]
  onClose: () => void
  onDelivered: () => void
}

function ReceiveDeliveryModal({
  order,
  labs,
  onClose,
  onDelivered,
}: ReceiveDeliveryModalProps) {
  const { success, error: toastError } = useToast()
  const [labId, setLabId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [labError, setLabError] = useState('')

  const selectedLab = labs.find((l) => l.id === labId)

  const handleDeliver = async () => {
    if (!labId) {
      setLabError('Please select a lab to receive the stock.')
      return
    }
    setLabError('')
    setIsSaving(true)
    try {
      const payload: Record<string, unknown> = {
        status: 'delivered',
        labId,
      }

      const res = await fetch(`/api/admin/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delivery Failed',
          message: json.error?.message ?? 'Failed to mark order as delivered.',
        })
        return
      }

      success({
        title: 'Delivery Received',
        message: `${order.items.length} item${order.items.length !== 1 ? 's' : ''} received and added to ${selectedLab!.name}.`,
      })
      onDelivered()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Receive Delivery</h2>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">{order.poNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Order summary */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Supplier</span>
              <span className="font-medium text-gray-900">{order.supplier.name}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1.5">Items to receive</span>
              <div className="space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600">{item.material.name}</span>
                    <span className="font-bold text-amber-700">
                      {Number(item.quantity).toLocaleString()} {item.material.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lab selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Destination Lab <span className="text-red-500">*</span>
            </label>
            <select
              value={labId}
              onChange={(e) => {
                setLabId(e.target.value)
                setLabError('')
              }}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                labError ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Select a lab...</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.type}
                </option>
              ))}
            </select>
            {labError && (
              <p className="text-xs text-red-600 mt-1">{labError}</p>
            )}
          </div>

          {/* Stock preview */}
          {selectedLab ? (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <PackageCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-green-800">
                <span className="font-semibold">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>{' '}
                will be added to{' '}
                <span className="font-semibold">{selectedLab.name}</span> stock
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <FlaskConical className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700">
                Select a lab above to receive{' '}
                <span className="font-semibold">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>.
              </p>
            </div>
          )}

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
              onClick={handleDeliver}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PackageCheck className="w-4 h-4" />
                  Confirm Delivery
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel Confirmation Modal
// ---------------------------------------------------------------------------

interface CancelConfirmModalProps {
  order: PurchaseOrder
  onClose: () => void
  onConfirmed: () => void
}

function CancelConfirmModal({ order, onClose, onConfirmed }: CancelConfirmModalProps) {
  const { success, error: toastError } = useToast()
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await fetch(`/api/admin/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Cancellation Failed',
          message: json.error?.message ?? 'Failed to cancel purchase order.',
        })
        return
      }

      success({
        title: 'Order Cancelled',
        message: `${order.poNumber} has been cancelled.`,
      })
      onConfirmed()
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        {/* Warning icon + title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Cancel Purchase Order</h2>
            <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-1">
          Are you sure you want to cancel{' '}
          <span className="font-bold text-gray-900 font-mono">{order.poNumber}</span>?
        </p>
        <div className="text-sm text-gray-500 mb-6 space-y-1">
          <p>
            Order contains{' '}
            <span className="font-medium text-gray-700">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </span>{' '}
            from <span className="font-medium text-gray-700">{order.supplier.name}</span>:
          </p>
          <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
            {order.items.map((item, i) => (
              <li key={i}>
                {Number(item.quantity).toLocaleString()} {item.material.unit} of{' '}
                {item.material.name}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Keep Order
          </button>
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Order'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminPurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [labs, setLabs] = useState<Lab[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<PoStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  // Pagination
  const [skip, setSkip] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [cancelOrder, setCancelOrder] = useState<PurchaseOrder | null>(null)

  const { error: toastError } = useToast()

  // ---------------------------------------------------------------------------
  // Fetch reference data (suppliers, materials, labs) on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const fetchRef = async () => {
      try {
        const [supRes, matRes, labRes] = await Promise.all([
          fetch('/api/admin/suppliers?take=100'),
          fetch('/api/admin/raw-materials?take=100'),
          fetch('/api/admin/labs'),
        ])
        const [supJson, matJson, labJson] = await Promise.all([
          supRes.json(),
          matRes.json(),
          labRes.json(),
        ])

        if (supJson.success) setSuppliers(supJson.data ?? [])
        if (matJson.success) setMaterials(matJson.data ?? [])
        if (labJson.success) setLabs(labJson.data ?? [])
      } catch {
        // non-blocking — dropdowns will be empty
      }
    }
    fetchRef()
  }, [])

  // ---------------------------------------------------------------------------
  // Fetch purchase orders
  // ---------------------------------------------------------------------------

  const fetchOrders = useCallback(
    async (resetSkip = false) => {
      setIsLoading(true)
      const currentSkip = resetSkip ? 0 : skip
      try {
        const params = new URLSearchParams({
          skip: String(currentSkip),
          take: String(PAGE_SIZE),
          status: statusFilter,
        })

        const res = await fetch(`/api/admin/purchase-orders?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Load Failed',
            message: json.error?.message ?? 'Failed to load purchase orders.',
          })
          return
        }

        const fetched: PurchaseOrder[] = json.data ?? []

        setOrders((prev) => (resetSkip ? fetched : [...prev, ...fetched]))
        setTotal(json.pagination.total)
        setHasMore(json.pagination.hasMore)
        if (resetSkip) setSkip(PAGE_SIZE)
        else setSkip(currentSkip + PAGE_SIZE)
      } finally {
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skip, statusFilter, toastError],
  )

  // Initial load and reload when status filter changes
  useEffect(() => {
    setOrders([])
    setSkip(0)
    fetchOrders(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const handleSaved = () => {
    setShowCreateModal(false)
    setOrders([])
    setSkip(0)
    fetchOrders(true)
  }

  const handleDelivered = () => {
    setReceiveOrder(null)
    setOrders([])
    setSkip(0)
    fetchOrders(true)
  }

  const handleCancelled = () => {
    setCancelOrder(null)
    setOrders([])
    setSkip(0)
    fetchOrders(true)
  }

  // ---------------------------------------------------------------------------
  // Client-side search filter
  // ---------------------------------------------------------------------------

  const filteredOrders = search.trim()
    ? orders.filter((o) => {
        const q = search.toLowerCase()
        const materialMatch = o.items.some((item) =>
          item.material.name.toLowerCase().includes(q)
        )
        return (
          o.poNumber.toLowerCase().includes(q) ||
          o.supplier.name.toLowerCase().includes(q) ||
          materialMatch
        )
      })
    : orders

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} order{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setOrders([])
              setSkip(0)
              fetchOrders(true)
            }}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PO#, supplier, material..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'pending', 'ordered', 'delivered', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                statusFilter === s
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Delivery Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && orders.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No purchase orders found</p>
                    <p className="text-xs mt-1">
                      {search
                        ? 'Try a different search term.'
                        : statusFilter !== 'all'
                          ? `No ${statusFilter} orders.`
                          : 'Create your first purchase order.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const canReceive =
                    order.status === 'pending' || order.status === 'ordered'
                  const canCancel =
                    order.status !== 'delivered' && order.status !== 'cancelled'

                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      {/* PO Number */}
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs tracking-wide">
                          {order.poNumber}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3 text-gray-700 font-medium">
                        {order.supplier.name}
                      </td>

                      {/* Material */}
                      <td className="px-4 py-3">
                        {order.items.length === 1 ? (
                          <>
                            <span className="text-gray-900">{order.items[0].material.name}</span>
                            <span className="text-gray-400 text-xs ml-1">
                              ({order.items[0].material.unit})
                            </span>
                          </>
                        ) : (
                          <div className="text-sm">
                            <div className="text-gray-900 font-medium">{order.items.length} materials</div>
                            <div className="text-gray-500 text-xs mt-1">
                              {order.items.slice(0, 2).map((item) => item.material.name).join(', ')}
                              {order.items.length > 2 && '...'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3 text-gray-900 font-medium tabular-nums">
                        {order.items.length === 1 ? (
                          <>
                            {Number(order.items[0].quantity).toLocaleString()}{' '}
                            <span className="text-gray-400 text-xs">{order.items[0].material.unit}</span>
                          </>
                        ) : (
                          <div className="text-xs text-gray-600">
                            {order.items.map((item, i) => (
                              <div key={i}>
                                {Number(item.quantity).toLocaleString()} {item.material.unit}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Delivery Date */}
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <div>{formatDate(order.deliveryDate)}</div>
                        {order.deliveredAt && (
                          <div className="text-green-600 mt-0.5">
                            Delivered: {formatDate(order.deliveredAt)}
                          </div>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="px-4 py-3">
                        {order.totalCost !== null && order.totalCost !== undefined ? (
                          <span className="font-semibold text-amber-700">
                            {Number(order.totalCost).toFixed(2)} MAD
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Receive Delivery button — only for pending/ordered */}
                          {canReceive && (
                            <button
                              onClick={() => setReceiveOrder(order)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                              title="Receive delivery"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              Receive
                            </button>
                          )}

                          {/* Cancel button */}
                          <button
                            onClick={() => setCancelOrder(order)}
                            disabled={!canCancel}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Cancel order"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && !search && (
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
      {showCreateModal && (
        <CreatePurchaseOrderModal
          suppliers={suppliers}
          materials={materials}
          onClose={() => setShowCreateModal(false)}
          onSaved={handleSaved}
        />
      )}

      {receiveOrder && (
        <ReceiveDeliveryModal
          order={receiveOrder}
          labs={labs}
          onClose={() => setReceiveOrder(null)}
          onDelivered={handleDelivered}
        />
      )}

      {cancelOrder && (
        <CancelConfirmModal
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onConfirmed={handleCancelled}
        />
      )}
    </div>
  )
}
