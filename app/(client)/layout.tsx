export const dynamic = 'force-dynamic'

import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ClientCartProvider from '@/components/ClientCartProvider'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClientCartProvider>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </ClientCartProvider>
  )
}