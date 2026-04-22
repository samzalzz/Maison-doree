'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface NavItem {
  label: string
  href: string
  icon: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    ],
  },
  {
    title: 'Production Management',
    items: [
      { label: 'Supplier',       href: '/admin/suppliers',             icon: '🚚' },
      { label: 'Purchase Order', href: '/admin/purchase-orders',       icon: '📋' },
      { label: 'Stock',          href: '/admin/production/stock',      icon: '📦' },
      { label: 'Recipe',         href: '/admin/recipes',               icon: '👨‍🍳' },
      { label: 'Labs',           href: '/admin/labs',                  icon: '🏭' },
      { label: 'Machine',        href: '/admin/machines',              icon: '⚙️' },
      { label: 'Sell Order',     href: '/admin/sell-orders',           icon: '💼' },
      { label: 'Clients',        href: '/admin/customers',             icon: '👥' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Users',  href: '/admin/settings/users',  icon: '👥' },
      { label: 'Roles',  href: '/admin/settings/roles',  icon: '🔐' },
    ],
  },
]

export default function AdminNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <nav className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold">Maison Doree</h2>
        <p className="text-xs text-gray-400 mt-1">Admin Panel</p>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            {/* Section Header */}
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {section.title}
            </p>

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
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
