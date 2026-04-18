import React from 'react'
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Maison Dorée - Pâtisseries Maroc',
  description: 'Plateforme de vente de pâtisseries artisanales marocaines',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
