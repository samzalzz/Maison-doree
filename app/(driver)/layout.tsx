export const dynamic = 'force-dynamic'

import React from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Driver Dashboard - Maison Dorée',
  description: 'Driver dashboard for managing deliveries.',
}

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect driver routes with authentication
  const session = await auth()
  if (!session || !session.user) {
    redirect('/auth/login')
  }

  // Check for DRIVER role
  if (session.user.role !== 'DRIVER') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Maison Dorée Delivery</h1>
          <div className="text-sm text-gray-600">
            Driver ID: <span className="font-medium">{session.user.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}