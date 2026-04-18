export const dynamic = 'force-dynamic'

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import LoyaltyCard from '@/components/loyalty/LoyaltyCard'
import PointsBreakdown from '@/components/loyalty/PointsBreakdown'
import { LoyaltyCard as LoyaltyCardType } from '@/lib/types'

export default function LoyaltyPage() {
  const [card, setCard] = useState<LoyaltyCardType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLoyaltyCard = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/loyalty')

        if (!response.ok) {
          throw new Error('Failed to fetch loyalty card')
        }

        const data = await response.json()
        if (data.success && data.data) {
          setCard(data.data)
        }
      } catch (err) {
        console.error('[Loyalty Page] Error fetching card:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load loyalty card',
        )
      } finally {
        setLoading(false)
      }
    }

    fetchLoyaltyCard()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-amber-900 mb-4">
              Loyalty Card
            </h1>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg h-96 animate-pulse" />
            </div>
            <div>
              <div className="bg-white rounded-2xl shadow-lg h-96 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-amber-900 mb-4">
              Loyalty Card
            </h1>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <p className="text-red-700 mb-4">
              {error || 'Failed to load loyalty card'}
            </p>
            <Link
              href="/shop"
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-amber-700 transition"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 mb-4">
            Your Loyalty Card
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Earn points with every purchase and unlock exclusive rewards as you
            climb the tiers.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Loyalty Card - Spans 2 columns on large screens */}
          <div className="lg:col-span-2">
            <LoyaltyCard card={card} />
          </div>

          {/* Quick Stats Sidebar */}
          <div className="space-y-6">
            {/* Tier Guide */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-amber-900 mb-4">
                Tier Guide
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                  <p className="font-semibold text-amber-900">
                    BRONZE (0-99 MAD)
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Starter tier with basic benefits
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-slate-500">
                  <p className="font-semibold text-slate-900">
                    SILVER (100-499 MAD)
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Enhanced benefits and priority support
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                  <p className="font-semibold text-yellow-900">
                    GOLD (500+ MAD)
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Premium tier with VIP benefits
                  </p>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-amber-900 mb-4">
                How It Works
              </h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="font-bold text-amber-600 flex-shrink-0">
                    1.
                  </span>
                  <span>Shop and earn 1 point per MAD spent</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-amber-600 flex-shrink-0">
                    2.
                  </span>
                  <span>Reach tier thresholds to unlock benefits</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-amber-600 flex-shrink-0">
                    3.
                  </span>
                  <span>Get more points per MAD at higher tiers</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-amber-600 flex-shrink-0">
                    4.
                  </span>
                  <span>Redeem points for exclusive rewards</span>
                </li>
              </ol>
            </div>

            {/* Call to Action */}
            <Link
              href="/shop"
              className="block w-full bg-amber-600 text-white text-center px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition"
            >
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* Points History */}
        <PointsBreakdown totalPoints={card.points} />

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-amber-900 mb-6">
            Loyalty Program Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-amber-900 mb-3">Point Earning</h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">✓</span>
                  <span>
                    <strong>Bronze:</strong> 1 point per MAD spent
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">✓</span>
                  <span>
                    <strong>Silver:</strong> 1.25 points per MAD spent
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">✓</span>
                  <span>
                    <strong>Gold:</strong> 1.5 points per MAD spent
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">✓</span>
                  <span>Points earned only for delivered orders</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-amber-900 mb-3">
                Tier Benefits
              </h3>
              <ul className="space-y-2 text-gray-700 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">★</span>
                  <span>Exclusive member-only promotions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">★</span>
                  <span>Birthday discounts increase by tier</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">★</span>
                  <span>Early access to new products (Silver+)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">★</span>
                  <span>VIP customer support (Gold)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
