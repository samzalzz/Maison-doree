'use client'

import React, { useState } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { Tag, X, Loader2 } from 'lucide-react'

interface CouponAppliedProps {
  code: string
  discount: number
  couponId: string
  orderId?: string // Required for server-side removal
  onRemove: () => void
  disabled?: boolean
}

export function CouponApplied({
  code,
  discount,
  orderId,
  onRemove,
  disabled = false,
}: CouponAppliedProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const { success, error: toastError } = useToast()

  const handleRemove = async () => {
    setIsRemoving(true)

    try {
      // If orderId provided, also remove server-side
      if (orderId) {
        const res = await fetch('/api/coupons/apply', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Remove Failed',
            message: json.error?.message ?? 'Could not remove coupon.',
          })
          return
        }
      }

      onRemove()
      success({
        title: 'Coupon Removed',
        message: `Promo code ${code} has been removed.`,
      })
    } catch {
      toastError({
        title: 'Error',
        message: 'Failed to remove coupon. Please try again.',
      })
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-lg px-3 py-2.5">
      {/* Badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-green-100 text-green-800 px-2.5 py-1 rounded-full text-sm font-bold tracking-widest">
          <Tag className="w-3.5 h-3.5" />
          {code}
        </div>
        <span className="text-sm text-green-800 font-medium">
          -{discount.toFixed(2)} MAD
        </span>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemove}
        disabled={disabled || isRemoving}
        className="flex items-center gap-1 text-green-700 hover:text-red-600 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ml-2"
        aria-label={`Remove coupon ${code}`}
      >
        {isRemoving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            <X className="w-3.5 h-3.5" />
            <span>Remove</span>
          </>
        )}
      </button>
    </div>
  )
}
