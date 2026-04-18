'use client'

import React from 'react'
import { TableRowSkeleton } from './TableRowSkeleton'

export function OrderListSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Commande', 'Date', 'Statut', 'Total', 'Actions'].map((header) => (
              <th key={header} className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRowSkeleton key={i} columns={5} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
