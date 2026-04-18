'use client'

import React from 'react'

export function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-gray-200 animate-pulse rounded ${className}`}
      {...props}
    />
  )
}
