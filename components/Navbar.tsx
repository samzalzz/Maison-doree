'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white border-b-2 border-amber-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-bold text-amber-900 hover:text-amber-700 transition"
          >
            Maison Dorée
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/client"
              className="text-gray-700 hover:text-amber-600 transition font-medium"
            >
              Home
            </Link>
            <Link
              href="/client/shop"
              className="text-gray-700 hover:text-amber-600 transition font-medium"
            >
              Shop
            </Link>
            <Link
              href="/client/cart"
              className="text-gray-700 hover:text-amber-600 transition font-medium"
            >
              Cart
            </Link>
            <Link
              href="/client/orders"
              className="text-gray-700 hover:text-amber-600 transition font-medium"
            >
              Orders
            </Link>
            {session && (
              <>
                <Link
                  href="/client/loyalty"
                  className="text-gray-700 hover:text-amber-600 transition font-medium"
                >
                  Loyalty
                </Link>
                <Link
                  href="/client/ratings"
                  className="text-gray-700 hover:text-amber-600 transition font-medium"
                >
                  Ratings
                </Link>
                <Link
                  href="/client/tickets"
                  className="text-gray-700 hover:text-amber-600 transition font-medium"
                >
                  Tickets
                </Link>
              </>
            )}
            <Link
              href="/client/help"
              className="text-gray-700 hover:text-amber-600 transition font-medium"
            >
              Help
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-700 font-medium">
                  {session.user?.name || session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-amber-600 font-medium hover:text-amber-700 transition"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-amber-600 hover:bg-amber-50"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4">
            <Link
              href="/client"
              className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
            >
              Home
            </Link>
            <Link
              href="/client/shop"
              className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
            >
              Shop
            </Link>
            <Link
              href="/client/cart"
              className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
            >
              Cart
            </Link>
            <Link
              href="/client/orders"
              className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
            >
              Orders
            </Link>
            {session && (
              <>
                <Link
                  href="/client/loyalty"
                  className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
                >
                  Loyalty
                </Link>
                <Link
                  href="/client/ratings"
                  className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
                >
                  Ratings
                </Link>
                <Link
                  href="/client/tickets"
                  className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
                >
                  Tickets
                </Link>
              </>
            )}
            <Link
              href="/client/help"
              className="block px-3 py-2 text-gray-700 hover:text-amber-600 transition"
            >
              Help
            </Link>

            <hr className="my-4" />
            {session ? (
              <>
                <div className="px-3 py-2 text-gray-700 font-medium">
                  {session.user?.name || session.user?.email}
                </div>
                <button
                  onClick={() => signOut()}
                  className="block w-full text-left px-3 py-2 text-amber-600 hover:text-amber-700 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block px-3 py-2 text-amber-600 hover:text-amber-700 transition"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="block px-3 py-2 text-amber-600 hover:text-amber-700 transition"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
