import React from 'react'
import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-amber-900 text-amber-50 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-bold mb-4">Maison Dorée</h3>
            <p className="text-amber-100 text-sm">
              Plateforme de vente de pâtisseries artisanales marocaines de
              qualité supérieure.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-amber-100 hover:text-amber-50 transition">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-amber-100 hover:text-amber-50 transition">
                  Products
                </Link>
              </li>
              <li>
                <Link href="/orders" className="text-amber-100 hover:text-amber-50 transition">
                  Orders
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="text-amber-100 hover:text-amber-50 transition">
                  Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <p className="text-amber-100 text-sm mb-2">
              Email: info@maisondoree.ma
            </p>
            <p className="text-amber-100 text-sm mb-2">
              Phone: +212 5XX XXX XXX
            </p>
            <p className="text-amber-100 text-sm">
              Marrakech, Morocco
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-amber-800 pt-8">
          <p className="text-center text-amber-100 text-sm">
            &copy; {currentYear} Maison Dorée. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
