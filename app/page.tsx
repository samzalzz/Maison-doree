import React from 'react'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const products = await prisma.product.findMany({
    take: 12,
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-amber-900 to-amber-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Maison Dorée
            </h1>
            <p className="text-xl md:text-2xl text-amber-100 mb-6">
              Pâtisseries Artisanales Marocaines de Qualité Supérieure
            </p>
            <p className="text-lg text-amber-50 max-w-2xl mx-auto mb-8">
              Découvrez notre collection exclusive de délices marocains traditionnels, préparés avec les meilleurs ingrédients et savoir-faire artisanal.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/register"
                className="bg-white text-amber-900 px-8 py-3 rounded-lg font-semibold hover:bg-amber-50 transition"
              >
                S'inscrire
              </Link>
              <Link
                href="/login"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-800 transition"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="flex-1 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Nos Produits
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Chaque produit est confectionné avec soin par nos maîtres pâtissiers.
              Commandez dès maintenant et goûtez l'authenticité marocaine.
            </p>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden"
                >
                  {product.image && (
                    <div className="h-48 bg-gray-200 overflow-hidden">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {product.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {product.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-amber-600">
                        {String(product.price)} DH
                      </span>
                      <Link
                        href="/login"
                        className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition text-sm font-medium"
                      >
                        Acheter
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">
                Aucun produit disponible pour le moment.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🏪</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Livraison Rapide
              </h3>
              <p className="text-gray-600">
                Vos commandes livrées rapidement et en parfait état
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Qualité Garantie
              </h3>
              <p className="text-gray-600">
                Ingrédients premium et recettes traditionnelles marocaines
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Paiement Sécurisé
              </h3>
              <p className="text-gray-600">
                Transactions protégées et données confidentielles
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
