'use client'

import { useSearchParams } from 'next/navigation'

/**
 * Reads the ?registered=true query param and renders a success banner.
 * Must be wrapped in <Suspense> by the parent server component because
 * useSearchParams() opts the component into dynamic rendering.
 */
export function RegisteredBanner() {
  const params = useSearchParams()

  if (params.get('registered') !== 'true') return null

  return (
    <div
      role="status"
      className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4"
    >
      Inscription réussie ! Vous pouvez maintenant vous connecter.
    </div>
  )
}
