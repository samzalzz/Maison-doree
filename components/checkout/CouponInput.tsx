'use client'

import React, { useState, useRef } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { Tag, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface ValidationState {
  status: 'idle' | 'validating' | 'valid' | 'invalid'
  message?: string
  discount?: number
  couponData?: {
    id: string
    code: string
    name: string
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
    discountValue: number
  }
}

interface CouponInputProps {
  cartTotal: number
  cartItemIds: string[]
  onCouponApplied: (data: {
    code: string
    discount: number
    couponId: string
  }) => void
  orderId?: string // If the order already exists, auto-apply on validate
  disabled?: boolean
}

export function CouponInput({
  cartTotal,
  cartItemIds,
  onCouponApplied,
  orderId,
  disabled = false,
}: CouponInputProps) {
  const [code, setCode] = useState('')
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [isApplying, setIsApplying] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { success, error: toastError } = useToast()

  const normalise = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = normalise(e.target.value)
    setCode(val)

    // Reset validation when user types
    if (validation.status !== 'idle') {
      setValidation({ status: 'idle' })
    }

    // Clear pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Auto-validate when code reaches minimum length
    if (val.length >= 8) {
      debounceRef.current = setTimeout(() => {
        handleValidate(val)
      }, 600)
    }
  }

  const handleValidate = async (codeToValidate?: string) => {
    const finalCode = codeToValidate ?? code
    if (finalCode.length < 8) {
      setValidation({
        status: 'invalid',
        message: 'Code must be at least 8 characters.',
      })
      return
    }

    setValidation({ status: 'validating' })

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: finalCode,
          cartTotal,
          cartItemIds,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setValidation({
          status: 'invalid',
          message: json.error?.message ?? 'Invalid coupon code.',
        })
        return
      }

      const { data } = json as {
        data: {
          valid: boolean
          discount?: number
          reason?: string
          coupon?: {
            id: string
            code: string
            name: string
            discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
            discountValue: number
          }
        }
      }

      if (!data.valid) {
        setValidation({
          status: 'invalid',
          message: data.reason ?? 'This coupon is not valid.',
        })
        return
      }

      setValidation({
        status: 'valid',
        message: `${data.coupon?.name} — Save ${data.coupon?.discountType === 'PERCENTAGE' ? `${data.coupon.discountValue}%` : `${data.discount?.toFixed(2)} MAD`}`,
        discount: data.discount,
        couponData: data.coupon,
      })
    } catch {
      setValidation({
        status: 'invalid',
        message: 'Unable to validate coupon. Please try again.',
      })
    }
  }

  const handleApply = async () => {
    if (validation.status !== 'valid' || !validation.couponData) return

    setIsApplying(true)

    try {
      // If orderId is provided, apply server-side immediately
      if (orderId) {
        const res = await fetch('/api/coupons/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            code: validation.couponData.code,
            discountAmount: validation.discount ?? 0,
          }),
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          toastError({
            title: 'Coupon Failed',
            message: json.error?.message ?? 'Failed to apply coupon.',
          })
          setValidation({
            status: 'invalid',
            message: json.error?.message ?? 'Failed to apply coupon.',
          })
          return
        }
      }

      // Notify parent component
      onCouponApplied({
        code: validation.couponData.code,
        discount: validation.discount ?? 0,
        couponId: validation.couponData.id,
      })

      success({
        title: 'Coupon Applied',
        message: `${validation.couponData.code} — ${validation.couponData.discountType === 'PERCENTAGE' ? `${validation.couponData.discountValue}% off` : `${(validation.discount ?? 0).toFixed(2)} MAD off`}`,
      })
    } catch {
      toastError({
        title: 'Error',
        message: 'Failed to apply coupon. Please try again.',
      })
    } finally {
      setIsApplying(false)
    }
  }

  const isValidating = validation.status === 'validating'
  const isValid = validation.status === 'valid'
  const isInvalid = validation.status === 'invalid'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        Promo Code
      </label>

      <div className="flex gap-2">
        {/* Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Tag className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={code}
            onChange={handleChange}
            onBlur={() => code.length >= 8 && validation.status === 'idle' && handleValidate()}
            placeholder="Enter promo code"
            maxLength={12}
            disabled={disabled}
            className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 transition-colors ${
              isValid
                ? 'border-green-400 bg-green-50 focus:ring-green-300 text-green-800'
                : isInvalid
                  ? 'border-red-400 bg-red-50 focus:ring-red-300 text-red-800'
                  : 'border-gray-300 bg-white focus:ring-amber-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {/* Status icon inside input */}
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            {isValidating && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
            {isValid && <CheckCircle className="w-4 h-4 text-green-500" />}
            {isInvalid && <XCircle className="w-4 h-4 text-red-500" />}
          </div>
        </div>

        {/* Apply button */}
        <button
          type="button"
          onClick={isValid ? handleApply : () => handleValidate()}
          disabled={
            disabled ||
            isValidating ||
            isApplying ||
            code.length < 8
          }
          className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
            isValid
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          {isApplying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isValid ? (
            'Apply'
          ) : (
            'Check'
          )}
        </button>
      </div>

      {/* Feedback message */}
      {validation.status !== 'idle' && !isValidating && (
        <p
          className={`text-xs font-medium ${
            isValid ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {isValid && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {validation.message}
            </span>
          )}
          {isInvalid && (
            <span className="inline-flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {validation.message}
            </span>
          )}
        </p>
      )}

      {/* Discount preview when valid */}
      {isValid && validation.discount !== undefined && validation.discount > 0 && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-green-800 font-medium">Discount preview</span>
          <span className="text-green-700 font-bold">
            -{validation.discount.toFixed(2)} MAD
          </span>
        </div>
      )}
    </div>
  )
}
