'use client'

import React from 'react'
import { Skeleton } from './Skeleton'

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Skeleton className="w-full h-48" />
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex justify-between items-center pt-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-10 w-1/4" />
        </div>
      </div>
    </div>
  )
}
