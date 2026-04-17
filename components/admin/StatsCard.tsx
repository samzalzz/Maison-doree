import React from 'react'

interface StatsCardProps {
  title: string
  value: string
  icon: string
  highlight?: boolean
}

export default function StatsCard({
  title,
  value,
  icon,
  highlight = false,
}: StatsCardProps) {
  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${
        highlight ? 'border-l-4 border-red-500' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}
