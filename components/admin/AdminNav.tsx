'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

export default function AdminNav() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Products', href: '/admin/products', icon: '📦' },
    { label: 'Stock', href: '/admin/stocks', icon: '📈' },
    { label: 'Production', href: '/admin/production/dashboard', icon: '🏭' },
    { label: 'Forecasting', href: '/admin/production/forecast', icon: '📅' },
  ]

  return (
    <nav className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold">Maison Dorée</h2>
        <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* User Section & Logout */}
      <div className="p-4 border-t border-gray-800 space-y-3">
        <div className="px-4 py-3 bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-400">Logged in as</p>
          <p className="text-sm font-medium text-white mt-1 truncate">
            admin@maisondoree.com
          </p>
        </div>
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: '/' })}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  )
}
