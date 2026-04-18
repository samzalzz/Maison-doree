export const dynamic = 'force-dynamic'

'use client'

import React from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { CartProvider } from '@/lib/context/CartContext'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </CartProvider>
  )
}