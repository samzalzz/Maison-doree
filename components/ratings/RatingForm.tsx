'use client'

import React, { useState } from 'react'
import { RatingInput } from '@/lib/validators'

interface RatingFormProps {
  orderId: string
  orderNumber: string
  type: 'PRODUCT' | 'DELIVERY'
  productId?: string
  productName?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function RatingForm({
  orderId,
  orderNumber,
  type,
  productId,
  productName,
  onSuccess,
  onCancel,
}: RatingFormProps) {
  const [score, setScore] = useState<number>(5)
  const [comment, setComment] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload: RatingInput = {
        orderId,
        type,
        score,
        comment: comment.trim() || null,
        ...(type === 'PRODUCT' && { productId }),
      }

      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.error?.message || 'Failed to submit rating',
        )
      }

      // Reset form
      setScore(5)
      setComment('')
      onSuccess?.()
    } catch (err) {
      console.error('[RatingForm] Error:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to submit rating',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Info */}
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-amber-900">Order #{orderNumber}</span>
          {type === 'PRODUCT' && productName && (
            <span className="block text-amber-900">
              Product: <span className="font-semibold">{productName}</span>
            </span>
          )}
          {type === 'DELIVERY' && (
            <span className="block text-amber-900">Rating Type: Delivery</span>
          )}
        </p>
      </div>

      {/* Star Rating */}
      <div>
        <label className="block text-sm font-semibold text-amber-900 mb-3">
          {type === 'PRODUCT' ? 'Product Quality' : 'Delivery Experience'} (1-5 stars)
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setScore(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(null)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <span
                className={`text-4xl transition-colors ${
                  star <= (hoveredStar ?? score)
                    ? 'text-amber-500'
                    : 'text-gray-300'
                }`}
              >
                ★
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          You selected <span className="font-semibold">{hoveredStar ?? score}</span> star
          {hoveredStar ?? score !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Comment */}
      <div>
        <label
          htmlFor="comment"
          className="block text-sm font-semibold text-amber-900 mb-2"
        >
          Comments (Optional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            type === 'PRODUCT'
              ? 'Tell us about the quality, taste, and packaging...'
              : 'Tell us about your delivery experience, driver, and punctuality...'
          }
          maxLength={1000}
          rows={4}
          className="w-full px-4 py-3 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 transition resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          {comment.length}/1000 characters
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Rating'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 border-2 border-amber-600 text-amber-600 px-6 py-3 rounded-lg font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
