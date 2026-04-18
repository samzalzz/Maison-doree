'use client'

import React from 'react'
import Link from 'next/link'

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  actionText?: string
  actionHref?: string
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  actionText,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="bg-amber-600 text-white px-6 py-2 rounded hover:bg-amber-700"
        >
          {actionText}
        </Link>
      )}
    </div>
  )
}
