'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProductCardSkeleton } from '@/components/ui/ProductCardSkeleton'
import { OrderListSkeleton } from '@/components/ui/OrderListSkeleton'
import { TableRowSkeleton } from '@/components/ui/TableRowSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function SkeletonsTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-16">

        <header>
          <h1 className="text-3xl font-bold text-gray-900">
            Phase 2H — Skeleton Loaders &amp; Empty States
          </h1>
          <p className="mt-2 text-gray-600">
            Visual test page for all skeleton and empty state components.
          </p>
        </header>

        {/* Generic Skeleton */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            1. Generic Skeleton
          </h2>
          <div className="space-y-3 max-w-md bg-white p-6 rounded-lg shadow-sm">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-1/3 mt-2" />
          </div>
        </section>

        {/* Product Card Skeletons */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            2. Product Card Skeletons (grid of 3)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </div>
        </section>

        {/* Order List Skeleton */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            3. Order List Skeleton (6 rows, 5 columns)
          </h2>
          <div className="bg-white rounded-lg shadow-sm">
            <OrderListSkeleton />
          </div>
        </section>

        {/* Table Row Skeleton — standalone */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            4. Table Row Skeleton (configurable columns)
          </h2>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Col 1', 'Col 2', 'Col 3'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableRowSkeleton columns={3} />
                <TableRowSkeleton columns={3} />
                <TableRowSkeleton columns={3} />
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Default is 4 columns; above uses <code className="bg-gray-100 px-1 rounded">columns=&#123;3&#125;</code>.
          </p>
        </section>

        {/* Empty States */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            5. Empty States
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Empty state without CTA */}
            <div className="bg-white rounded-lg shadow-sm">
              <EmptyState
                icon="🛒"
                title="Votre panier est vide"
                description="Ajoutez des produits pour commencer votre commande."
              />
            </div>

            {/* Empty state with CTA */}
            <div className="bg-white rounded-lg shadow-sm">
              <EmptyState
                icon="📦"
                title="Aucune commande"
                description="Vous n'avez pas encore passé de commande."
                actionText="Découvrir nos produits"
                actionHref="/products"
              />
            </div>

          </div>
        </section>

        <footer className="text-sm text-gray-400 pb-8">
          Test page — Phase 2H | Maison Dorée
        </footer>

      </div>
    </div>
  )
}
