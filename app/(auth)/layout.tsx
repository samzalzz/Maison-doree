import React from 'react'

/**
 * Auth route group layout.
 *
 * The (auth) route group is intentionally minimal — it simply passes children
 * through without adding extra wrappers. The individual login/register pages
 * own their own full-page centering and card styling so each page can evolve
 * independently.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
