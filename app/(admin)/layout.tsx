export const dynamic = 'force-dynamic'

import React from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/AdminNav'

export const metadata = {
  title: 'Admin Dashboard - Maison Dorée',
  description: 'Admin dashboard for managing products, orders, and deliveries.',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Protect admin routes with authentication
  const session = await auth()
  if (!session || !session.user) {
    redirect('/auth/login')
  }

  // Check for ADMIN role
  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Admin Sidebar */}
      <AdminNav />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
    </div>
  )
}