'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react'
import {
  RawMaterial,
  LabWithStock,
  StockAdjustModalProps,
  LabStockSectionProps,
} from '@/lib/types-production'

// Local helper types
type StockEntry = {
  id: string
  labId: string
  materialId: string
  quantity: string | number
  minThreshold: string | number
  lastUpdated: string
  material: RawMaterial
}

type Lab = {
  id: string
  name: string
  type: string
  capacity: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(val: string | number): number {
  if (typeof val === 'number') return val
  return parseFloat(val)
}

// ---------------------------------------------------------------------------
// Stock Adjustment Modal
// ---------------------------------------------------------------------------

function StockAdjustModal({
  labId,
  labName,
  stock,
  onClose,
  onSaved,
}: StockAdjustModalProps) {
  const { success, error: toastError } = useToast()
  const [quantity, setQuantity] = useState<string>(toNumber(stock.quantity).toString())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentQty = toNumber(stock.quantity)
  const newQty = quantity ? parseFloat(quantity) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const val = parseFloat(quantity)
    if (isNaN(val) || val < 0) {
      setError('Quantity must be a non-negative number.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(
        `/api/admin/lab-stock/${labId}/${stock.materialId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: val }),
        },
      )

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Update Failed',
          message: json.error?.message ?? 'Failed to update stock.',
        })
        return
      }

      success({
        title: 'Stock Updated',
        message: `"${stock.material.name}" updated to ${val} ${stock.material.unit}.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjust-stock-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2
              id="adjust-stock-modal-title"
              className="text-xl font-bold text-gray-900"
            >
              Adjust Stock
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {labName} • {stock.material.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current quantity display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-1">Current Quantity</p>
            <p className="text-2xl font-bold text-gray-900">
              {currentQty.toFixed(2)}
              <span className="text-base font-normal text-gray-500 ml-2">
                {stock.material.unit}
              </span>
            </p>
          </div>

          {/* Change preview */}
          {!isNaN(newQty) && newQty !== currentQty && (
            <div
              className={`rounded-lg p-3 flex items-start gap-2 ${
                newQty > currentQty
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5 ${
                  newQty > currentQty ? 'bg-green-500' : 'bg-amber-500'
                }`}
              >
                {newQty > currentQty ? '+' : '-'}
              </div>
              <div>
                <p
                  className={`text-sm font-semibold ${
                    newQty > currentQty ? 'text-green-700' : 'text-amber-700'
                  }`}
                >
                  {newQty > currentQty ? 'Adding' : 'Removing'}{' '}
                  {Math.abs(newQty - currentQty).toFixed(2)} {stock.material.unit}
                </p>
              </div>
            </div>
          )}

          {/* Quantity input */}
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              New Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  setError(null)
                }}
                placeholder="0.00"
                step="0.01"
                min="0"
                className={`flex-1 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  error ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <span className="flex items-center px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                {stock.material.unit}
              </span>
            </div>
            {error && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Quick adjustment buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setQuantity((0).toString())}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Zero
            </button>
            <button
              type="button"
              onClick={() => setQuantity(currentQty.toString())}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setQuantity((currentQty * 2).toString())}
              className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Double
            </button>
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
              disabled={isSaving || isNaN(newQty)}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Stock Modal
// ---------------------------------------------------------------------------

interface AddStockModalProps {
  labId: string
  labName: string
  onClose: () => void
  onSaved: () => void
}

function AddStockModal({
  labId,
  labName,
  onClose,
  onSaved,
}: AddStockModalProps) {
  const { success, error: toastError } = useToast()
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('0')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load available materials on mount
  useEffect(() => {
    const loadMaterials = async () => {
      setIsLoadingMaterials(true)
      try {
        const res = await fetch('/api/admin/raw-materials?take=100')
        const json = await res.json()
        if (json.success) {
          setMaterials(json.data ?? [])
        }
      } catch (err) {
        console.error('Failed to load materials:', err)
      } finally {
        setIsLoadingMaterials(false)
      }
    }
    loadMaterials()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedMaterialId) {
      setError('Please select a material.')
      return
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty < 0) {
      setError('Quantity must be a non-negative number.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(
        `/api/admin/lab-stock/${labId}/${selectedMaterialId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: qty }),
        },
      )

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Save Failed',
          message: json.error?.message ?? 'Failed to add material to stock.',
        })
        return
      }

      const material = materials.find(m => m.id === selectedMaterialId)
      success({
        title: 'Material Added',
        message: `"${material?.name}" added to ${labName} with ${qty} ${material?.unit}.`,
      })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-stock-modal-title"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2
              id="add-stock-modal-title"
              className="text-xl font-bold text-gray-900"
            >
              Add Material
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {labName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Material select */}
          <div>
            <label
              htmlFor="material"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Select Material <span className="text-red-500">*</span>
            </label>
            <select
              id="material"
              value={selectedMaterialId}
              onChange={(e) => {
                setSelectedMaterialId(e.target.value)
                setError(null)
              }}
              disabled={isLoadingMaterials}
              className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                error ? 'border-red-400' : 'border-gray-300'
              } disabled:opacity-50`}
            >
              <option value="">
                {isLoadingMaterials ? 'Loading materials...' : 'Choose a material...'}
              </option>
              {materials.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.name} ({mat.type})
                </option>
              ))}
            </select>
            {error && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Material info */}
          {selectedMaterial && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="text-blue-900">
                <span className="font-semibold">{selectedMaterial.name}</span> — {selectedMaterial.type}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Unit: <span className="font-semibold">{selectedMaterial.unit}</span>
              </p>
            </div>
          )}

          {/* Quantity input */}
          <div>
            <label
              htmlFor="add-quantity"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Initial Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="add-quantity"
                type="number"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  setError(null)
                }}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {selectedMaterial && (
                <span className="flex items-center px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                  {selectedMaterial.unit}
                </span>
              )}
            </div>
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
              disabled={isSaving || !selectedMaterialId || isNaN(parseFloat(quantity))}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Add Material
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
// Lab Stock Section
// ---------------------------------------------------------------------------

function LabStockSection({
  labWithStock,
  onRefresh,
  onAdjustStock,
  onAddStock,
}: LabStockSectionProps) {
  const { lab, stock } = labWithStock
  const [isExpanded, setIsExpanded] = useState(false)
  const { success, error: toastError } = useToast()
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  const lowStockEntries = stock.filter(
    (s) => toNumber(s.quantity) <= toNumber(s.minThreshold),
  )

  const handleDeleteStock = async (stockId: string, materialId: string, materialName: string) => {
    setIsDeletingId(stockId)
    try {
      const res = await fetch(
        `/api/admin/lab-stock/${lab.id}/${materialId}`,
        { method: 'DELETE' },
      )

      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Delete Failed',
          message: json.error?.message ?? 'Failed to remove material from stock.',
        })
        return
      }

      success({
        title: 'Material Removed',
        message: `"${materialName}" removed from ${lab.name}.`,
      })
      onRefresh()
    } catch (err) {
      console.error('Error deleting stock:', err)
      toastError({
        title: 'Delete Failed',
        message: 'An error occurred while removing the material.',
      })
    } finally {
      setIsDeletingId(null)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Lab header (always visible) */}
      <div
        className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsExpanded(!isExpanded)
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{lab.name}</h3>
            <p className="text-xs text-gray-500">
              {stock.length} material{stock.length !== 1 ? 's' : ''}
              {lowStockEntries.length > 0 && (
                <span className="ml-2 font-semibold text-red-600">
                  • {lowStockEntries.length} low stock
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {stock.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <Package className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-500">
                No stock records for this lab yet.
              </p>
            </div>
          ) : (
            stock.map((s) => {
              const qty = toNumber(s.quantity)
              const min = toNumber(s.minThreshold)
              const isLow = qty <= min
              return (
                <div
                  key={s.id}
                  className={`p-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors ${
                    isLow ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {s.material.name}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {s.material.type} • {s.material.unit}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 max-w-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700">
                            {qty.toFixed(2)} {s.material.unit}
                          </span>
                          <span className="text-xs text-gray-500">
                            Min: {min.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isLow ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((qty / Math.max(min, qty)) * 100, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={Math.round(
                              Math.min((qty / Math.max(min, qty)) * 100, 100),
                            )}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status badge and action buttons */}
                  <div className="flex-shrink-0 flex items-center gap-2 min-w-0">
                    {isLow && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Low Stock
                      </span>
                    )}
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => onAdjustStock(s)}
                      className="flex-shrink-0 p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title={`Edit ${s.material.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteStock(s.id, s.materialId, s.material.name)}
                      disabled={isDeletingId === s.id}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title={`Delete ${s.material.name}`}
                    >
                      {isDeletingId === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })
          )}

          {/* Add Material button - always visible when expanded */}
          {onAddStock && stock.length > 0 && (
            <div className="p-4 bg-green-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onAddStock(lab.id, lab.name)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add More Material
              </button>
            </div>
          )}
          {onAddStock && stock.length === 0 && (
            <div className="p-4 bg-green-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => onAddStock(lab.id, lab.name)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Material
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminStockPage() {
  const [labsWithStock, setLabsWithStock] = useState<LabWithStock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filteredLabs, setFilteredLabs] = useState<LabWithStock[]>([])
  const { error: toastError } = useToast()

  // Modal state
  const [selectedStock, setSelectedStock] = useState<StockEntry | null>(null)
  const [selectedLabId, setSelectedLabId] = useState<string>('')
  const [selectedLabName, setSelectedLabName] = useState<string>('')
  const [addStockLabId, setAddStockLabId] = useState<string>('')
  const [addStockLabName, setAddStockLabName] = useState<string>('')

  const fetchStock = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/labs')
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load labs.',
        })
        return
      }

      const labs: Lab[] = json.data ?? []

      // Fetch stock for each lab
      const labsWithStockData: LabWithStock[] = await Promise.all(
        labs.map(async (lab) => {
          try {
            const stockRes = await fetch(`/api/admin/lab-stock?labId=${lab.id}`)
            const stockJson = await stockRes.json()

            const stock: StockEntry[] = stockJson.success ? stockJson.data ?? [] : []
            const lowStockCount = stock.filter(
              (s) => toNumber(s.quantity) <= toNumber(s.minThreshold),
            ).length

            return { lab, stock, lowStockCount }
          } catch {
            return { lab, stock: [], lowStockCount: 0 }
          }
        }),
      )

      setLabsWithStock(labsWithStockData)
      applySearch(labsWithStockData, search)
    } finally {
      setIsLoading(false)
    }
  }, [search, toastError])

  const applySearch = (labs: LabWithStock[], searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredLabs(labs)
      return
    }

    const term = searchTerm.toLowerCase()
    setFilteredLabs(
      labs.filter(
        (lws) =>
          lws.lab.name.toLowerCase().includes(term) ||
          lws.stock.some((s) =>
            s.material.name.toLowerCase().includes(term),
          ),
      ),
    )
  }

  useEffect(() => {
    fetchStock()
  }, [fetchStock])

  useEffect(() => {
    applySearch(labsWithStock, search)
  }, [search, labsWithStock])

  const totalMaterials = labsWithStock.reduce((sum, lws) => sum + lws.stock.length, 0)
  const totalLowStock = labsWithStock.reduce((sum, lws) => sum + lws.lowStockCount, 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalMaterials} material{totalMaterials !== 1 ? 's' : ''} across{' '}
            {labsWithStock.length} lab{labsWithStock.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStock}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh stock data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Alerts */}
      {totalLowStock > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
            <p className="text-sm text-red-700 mt-0.5">
              {totalLowStock} material{totalLowStock !== 1 ? 's' : ''} below minimum
              threshold across all labs. Review and replenish stock soon.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter labs or materials..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Stats cards */}
      {!isLoading && labsWithStock.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold">
              Total Materials
            </p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{totalMaterials}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-600 uppercase tracking-wider font-semibold">
              Labs
            </p>
            <p className="text-2xl font-bold text-amber-900 mt-1">
              {labsWithStock.length}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-600 uppercase tracking-wider font-semibold">
              Low Stock
            </p>
            <p className="text-2xl font-bold text-red-900 mt-1">{totalLowStock}</p>
          </div>
        </div>
      )}

      {/* Labs list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-20 bg-gray-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : filteredLabs.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-900">
              {search.trim() ? 'No results found' : 'No stock data available'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {search.trim()
                ? 'Try a different lab or material name.'
                : 'Start by creating labs and adding materials.'}
            </p>
          </div>
        ) : (
          filteredLabs.map((lws) => (
            <LabStockSection
              key={lws.lab.id}
              labWithStock={lws}
              onRefresh={fetchStock}
              onAdjustStock={(stock) => {
                setSelectedStock(stock)
                setSelectedLabId(lws.lab.id)
                setSelectedLabName(lws.lab.name)
              }}
              onAddStock={(labId, labName) => {
                setAddStockLabId(labId)
                setAddStockLabName(labName)
              }}
            />
          ))
        )}
      </div>

      {/* Modals */}
      {selectedStock && (
        <StockAdjustModal
          labId={selectedLabId}
          labName={selectedLabName}
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onSaved={() => {
            setSelectedStock(null)
            fetchStock()
          }}
        />
      )}

      {addStockLabId && (
        <AddStockModal
          labId={addStockLabId}
          labName={addStockLabName}
          onClose={() => {
            setAddStockLabId('')
            setAddStockLabName('')
          }}
          onSaved={() => {
            setAddStockLabId('')
            setAddStockLabName('')
            fetchStock()
          }}
        />
      )}
    </div>
  )
}
