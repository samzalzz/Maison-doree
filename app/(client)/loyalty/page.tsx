'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { TierBadge } from '@/components/loyalty/TierBadge'
import { TierProgressBar } from '@/components/loyalty/TierProgressBar'
import { PointsRedeemModal } from '@/components/loyalty/PointsRedeemModal'
import { useToast } from '@/lib/hooks/useToast'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoyaltyCard {
  id: string
  userId: string
  points: number
  totalSpent: number
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  createdAt: string
  updatedAt: string
}

interface ProgressInfo {
  currentTier: 'BRONZE' | 'SILVER' | 'GOLD'
  nextTier: string | null
  spendToNextTier: number | null
  progressPercent: number
}

interface ExpiryInfo {
  expiresAt: string
  points: number
}

interface LoyaltyData {
  card: LoyaltyCard
  progress: ProgressInfo
  expiry: ExpiryInfo | null
}

interface Transaction {
  id: string
  type: string
  points: number
  reason: string
  orderId: string | null
  expiresAt: string | null
  createdAt: string
}

interface TierBenefitData {
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  earnRate: string
  bonus: string
  minSpend: number
  maxSpend: number | null
  perks: string[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PURCHASE: { label: 'Purchase', color: 'text-green-700 bg-green-50' },
  REDEMPTION: { label: 'Redemption', color: 'text-red-700 bg-red-50' },
  BONUS: { label: 'Bonus', color: 'text-blue-700 bg-blue-50' },
  EXPIRY: { label: 'Expiry', color: 'text-gray-600 bg-gray-100' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoyaltyPage() {
  const { error: toastError, success } = useToast()

  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [currentPage, setCurrentPage] = useState(0) // 0-based offset
  const [benefits, setBenefits] = useState<TierBenefitData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingTx, setIsLoadingTx] = useState(false)
  const [isRedeemOpen, setIsRedeemOpen] = useState(false)

  // Fetch loyalty card data
  const fetchLoyalty = useCallback(async () => {
    try {
      const res = await fetch('/api/loyalty')
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message)
      setLoyaltyData(data.data)
    } catch (err) {
      toastError({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to load loyalty data.',
      })
    }
  }, [toastError])

  // Fetch transactions (paginated)
  const fetchTransactions = useCallback(
    async (offset: number) => {
      setIsLoadingTx(true)
      try {
        const res = await fetch(
          `/api/loyalty/transactions?limit=${PAGE_SIZE}&offset=${offset}`,
        )
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error?.message)
        setTransactions(data.data.transactions)
        setTotalTransactions(data.data.total)
      } catch (err) {
        toastError({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to load transactions.',
        })
      } finally {
        setIsLoadingTx(false)
      }
    },
    [toastError],
  )

  // Fetch tier benefits
  const fetchBenefits = useCallback(async () => {
    try {
      const res = await fetch('/api/loyalty/tier-benefits')
      const data = await res.json()
      if (data.success) setBenefits(data.data)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await Promise.all([fetchLoyalty(), fetchTransactions(0), fetchBenefits()])
      setIsLoading(false)
    }
    init()
  }, [fetchLoyalty, fetchTransactions, fetchBenefits])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    fetchTransactions(newPage * PAGE_SIZE)
  }

  const handleRedeemSuccess = (pointsRedeemed: number, discountAmount: number) => {
    success({
      title: 'Redeemed!',
      message: `${pointsRedeemed} pts for ${discountAmount.toFixed(2)} MAD discount`,
    })
    // Refresh loyalty card after redemption
    fetchLoyalty()
    fetchTransactions(currentPage * PAGE_SIZE)
  }

  const totalPages = Math.ceil(totalTransactions / PAGE_SIZE)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white h-40 animate-pulse shadow" />
          ))}
        </div>
      </div>
    )
  }

  if (!loyaltyData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Unable to load loyalty data.</p>
          <button
            onClick={fetchLoyalty}
            className="mt-4 rounded-lg bg-amber-600 px-5 py-2 text-white hover:bg-amber-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { card, progress, expiry } = loyaltyData
  const currentBenefits = benefits.find((b) => b.tier === card.tier)

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Loyalty Program</h1>
            <p className="text-gray-500 text-sm mt-1">
              Earn points on every order and unlock exclusive rewards
            </p>
          </div>
          <TierBadge tier={card.tier} size="lg" />
        </div>

        {/* Points balance card */}
        <div className="rounded-2xl bg-white shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Points balance
              </p>
              <p className="text-5xl font-bold text-amber-600 mt-1">{card.points}</p>
              <p className="text-sm text-gray-500 mt-1">
                {Math.floor(card.points / 100) * 20} MAD redeemable value
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <button
                onClick={() => setIsRedeemOpen(true)}
                disabled={card.points < 100}
                className="rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Redeem Points
              </button>
              {card.points < 100 && (
                <p className="text-xs text-gray-400">
                  Need {100 - card.points} more points to redeem
                </p>
              )}
            </div>
          </div>

          {/* Expiry info */}
          {expiry && (
            <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-2.5 text-sm text-orange-700">
              <strong>{expiry.points} points</strong> will expire on{' '}
              {new Date(expiry.expiresAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          )}
        </div>

        {/* Tier progress */}
        <div className="rounded-2xl bg-white shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tier Progress</h2>
          <TierProgressBar
            currentTier={progress.currentTier}
            nextTier={progress.nextTier}
            progressPercent={progress.progressPercent}
            spendToNextTier={progress.spendToNextTier}
            totalSpent={card.totalSpent}
          />
          <p className="mt-3 text-sm text-gray-500">
            Total spent:{' '}
            <strong className="text-gray-800">{card.totalSpent.toFixed(2)} MAD</strong>
          </p>
        </div>

        {/* Tier benefits */}
        <div className="rounded-2xl bg-white shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tier Benefits</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {benefits.map((benefit) => (
              <div
                key={benefit.tier}
                className={`rounded-xl border-2 p-4 transition ${
                  benefit.tier === card.tier
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-gray-100 bg-gray-50 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <TierBadge tier={benefit.tier} size="sm" />
                  {benefit.tier === card.tier && (
                    <span className="text-xs font-medium text-amber-700">Current</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-500 mb-2">{benefit.earnRate}</p>
                <ul className="space-y-1.5">
                  {benefit.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                      <span className="text-amber-500 mt-0.5 shrink-0">+</span>
                      {perk}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-gray-400">
                  {benefit.maxSpend !== null
                    ? `${benefit.minSpend}–${benefit.maxSpend} MAD spent`
                    : `${benefit.minSpend}+ MAD spent`}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction history */}
        <div className="rounded-2xl bg-white shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
            <span className="text-sm text-gray-400">{totalTransactions} total</span>
          </div>

          {isLoadingTx ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400">No transactions yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Make your first purchase to earn points!
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {transactions.map((tx) => {
                  const typeStyle = TYPE_LABELS[tx.type] ?? {
                    label: tx.type,
                    color: 'text-gray-600 bg-gray-100',
                  }
                  const isPositive = tx.points > 0

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyle.color}`}
                        >
                          {typeStyle.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-700 truncate">{tx.reason}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {tx.expiresAt && (
                              <span className="ml-2 text-orange-500">
                                expires{' '}
                                {new Date(tx.expiresAt).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-base font-bold ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage + 1 >= totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Redeem modal */}
      <PointsRedeemModal
        isOpen={isRedeemOpen}
        onClose={() => setIsRedeemOpen(false)}
        availablePoints={card.points}
        onSuccess={handleRedeemSuccess}
      />
    </div>
  )
}
