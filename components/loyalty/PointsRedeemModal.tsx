'use client'

import React, { useState, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import { REDEMPTION_POINTS_NEEDED, REDEMPTION_DISCOUNT_MAD } from '@/lib/loyalty'

interface PointsRedeemModalProps {
  isOpen: boolean
  onClose: () => void
  availablePoints: number
  /** Called after a successful redemption so parent can refresh balance */
  onSuccess: (pointsRedeemed: number, discountAmount: number) => void
}

export function PointsRedeemModal({
  isOpen,
  onClose,
  availablePoints,
  onSuccess,
}: PointsRedeemModalProps) {
  const { success, error: toastError } = useToast()
  const [pointsInput, setPointsInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const parsedPoints = parseInt(pointsInput, 10)
  const isValidInput =
    !isNaN(parsedPoints) &&
    parsedPoints > 0 &&
    parsedPoints % REDEMPTION_POINTS_NEEDED === 0 &&
    parsedPoints <= availablePoints

  const discountPreview = isValidInput
    ? (parsedPoints / REDEMPTION_POINTS_NEEDED) * REDEMPTION_DISCOUNT_MAD
    : 0

  const maxRedeemable =
    Math.floor(availablePoints / REDEMPTION_POINTS_NEEDED) * REDEMPTION_POINTS_NEEDED

  const handleRedeem = useCallback(async () => {
    if (!isValidInput) return

    setIsLoading(true)
    try {
      // NOTE: orderId is a placeholder — in production, pass the active order ID via props
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: parsedPoints, orderId: 'current' }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? 'Redemption failed')
      }

      success({
        title: 'Points redeemed!',
        message: `${parsedPoints} points redeemed for ${discountPreview.toFixed(2)} MAD discount`,
      })
      onSuccess(parsedPoints, discountPreview)
      setPointsInput('')
      onClose()
    } catch (err) {
      toastError({
        title: 'Redemption failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [isValidInput, parsedPoints, discountPreview, success, toastError, onSuccess, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redeem-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2
            id="redeem-modal-title"
            className="text-lg font-bold text-gray-900"
          >
            Redeem Points
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Rate info */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <p className="font-semibold">Redemption rate</p>
            <p>
              {REDEMPTION_POINTS_NEEDED} points = {REDEMPTION_DISCOUNT_MAD} MAD discount
            </p>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Available points</span>
            <span className="text-xl font-bold text-amber-700">
              {availablePoints}
            </span>
          </div>

          {/* Input */}
          <div>
            <label
              htmlFor="points-input"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Points to redeem (multiples of {REDEMPTION_POINTS_NEEDED})
            </label>
            <input
              id="points-input"
              type="number"
              min={REDEMPTION_POINTS_NEEDED}
              max={maxRedeemable}
              step={REDEMPTION_POINTS_NEEDED}
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              placeholder={`e.g. ${REDEMPTION_POINTS_NEEDED}`}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            {pointsInput && !isValidInput && (
              <p className="mt-1 text-xs text-red-600">
                {isNaN(parsedPoints) || parsedPoints <= 0
                  ? 'Enter a positive number'
                  : parsedPoints > availablePoints
                  ? 'Insufficient points balance'
                  : `Must be a multiple of ${REDEMPTION_POINTS_NEEDED}`}
              </p>
            )}
          </div>

          {/* Discount preview */}
          {isValidInput && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-sm text-green-700">You will receive</p>
              <p className="text-3xl font-bold text-green-800">
                {discountPreview.toFixed(2)} MAD
              </p>
              <p className="text-xs text-green-600 mt-1">discount applied at checkout</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRedeem}
            disabled={!isValidInput || isLoading}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Redeeming...' : 'Redeem Points'}
          </button>
        </div>
      </div>
    </div>
  )
}
