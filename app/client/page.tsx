'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import CountdownTimer from '@/components/CountdownTimer'

// Launch date - configure this as needed (May 1, 2026 in this example)
const LAUNCH_DATE = new Date('2026-05-01T00:00:00Z')

export default function HomePage() {
  const [isLaunched, setIsLaunched] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if launch date has passed
    const now = new Date().getTime()
    const launchTime = LAUNCH_DATE.getTime()
    if (now >= launchTime) {
      setIsLaunched(true)
    }
  }, [])

  const handleLaunchDateReached = () => {
    setIsLaunched(true)
  }

  if (!mounted) {
    return <div className="min-h-screen" />
  }

  if (isLaunched) {
    // Post-launch content
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-bold text-amber-900 mb-4">
              Maison Dorée
            </h1>
            <p className="text-2xl text-amber-700 font-semibold mb-4">
              Authentic Moroccan Pastries
            </p>
            <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
              Discover our exquisite collection of hand-crafted pastries made
              with love and the finest ingredients.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/products"
                className="inline-block bg-amber-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-amber-700 transition text-lg"
              >
                Shop Now
              </Link>
              <Link
                href="/countdown"
                className="inline-block border-2 border-amber-600 text-amber-600 px-8 py-4 rounded-lg font-semibold hover:bg-amber-50 transition text-lg"
              >
                Learn More
              </Link>
            </div>
          </div>
        </section>

        {/* Featured Products Preview */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-4xl font-bold text-center text-amber-900 mb-12">
            Featured Products
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                name: 'Pâte Feuilletée',
                description: 'Crispy layered pastry with almond filling',
                emoji: '🥐',
              },
              {
                name: 'Chebakia',
                description: 'Honey-coated floral pastry with sesame',
                emoji: '🍯',
              },
              {
                name: 'Briouat',
                description: 'Golden pastry envelopes with meat or cheese',
                emoji: '📦',
              },
              {
                name: 'Gâteau Mille-Feuille',
                description: 'Classic cream-layered pastry',
                emoji: '🎂',
              },
              {
                name: 'Makrout',
                description: 'Semolina cookies with dates',
                emoji: '🍪',
              },
              {
                name: 'Cornes de Gazelle',
                description: 'Crescent pastries with almond paste',
                emoji: '🌙',
              },
            ].map((product, index) => (
              <div
                key={index}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition border-t-4 border-amber-600"
              >
                <div className="text-5xl mb-4 text-center">{product.emoji}</div>
                <h3 className="text-xl font-bold text-amber-900 mb-2">
                  {product.name}
                </h3>
                <p className="text-gray-600 mb-4">{product.description}</p>
                <button className="w-full bg-amber-600 text-white py-2 rounded hover:bg-amber-700 transition font-semibold">
                  View Details
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/products"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-700 transition"
            >
              View All Products
            </Link>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="bg-amber-900 text-amber-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-center mb-12">
              Why Choose Us
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-5xl mb-4">✨</div>
                <h3 className="text-xl font-bold mb-2">Premium Quality</h3>
                <p>
                  Hand-crafted with traditional recipes passed down through
                  generations.
                </p>
              </div>

              <div className="text-center">
                <div className="text-5xl mb-4">🚚</div>
                <h3 className="text-xl font-bold mb-2">Fast Delivery</h3>
                <p>Fresh pastries delivered to your doorstep within 24 hours.</p>
              </div>

              <div className="text-center">
                <div className="text-5xl mb-4">❤️</div>
                <h3 className="text-xl font-bold mb-2">Made with Love</h3>
                <p>
                  Every pastry is prepared with care and the finest ingredients.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-lg shadow-lg p-8 sm:p-12 border-t-4 border-amber-600">
            <h2 className="text-3xl font-bold text-amber-900 mb-2 text-center">
              Get Special Offers
            </h2>
            <p className="text-gray-600 text-center mb-8">
              Subscribe to our newsletter for exclusive deals and new product
              announcements.
            </p>

            <form className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 transition"
                  required
                />
                <button
                  type="submit"
                  className="bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-700 transition whitespace-nowrap"
                >
                  Subscribe
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    )
  }

  // Pre-launch content with countdown
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-amber-900 mb-4">
            Maison Dorée
          </h1>
          <p className="text-2xl text-amber-700 font-semibold mb-4">
            Coming Soon
          </p>
          <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
            Experience the authentic taste of Moroccan pastries. We're preparing
            something special for you.
          </p>
        </div>
      </section>

      {/* Countdown Timer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <CountdownTimer
            launchDate={LAUNCH_DATE}
            onLaunchDateReached={handleLaunchDateReached}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <Link
            href="/countdown"
            className="inline-block bg-amber-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-amber-700 transition text-lg"
          >
            Learn More About Our Launch
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-center text-amber-900 mb-12">
          What to Expect
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg p-8 shadow-md text-center hover:shadow-lg transition">
            <div className="text-4xl mb-4">🥐</div>
            <h4 className="text-xl font-bold text-amber-900 mb-2">
              Authentic Pastries
            </h4>
            <p className="text-gray-600">
              Hand-crafted Moroccan pastries using traditional recipes and the
              finest ingredients.
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-md text-center hover:shadow-lg transition">
            <div className="text-4xl mb-4">🚚</div>
            <h4 className="text-xl font-bold text-amber-900 mb-2">
              Fast Delivery
            </h4>
            <p className="text-gray-600">
              Fresh pastries delivered to your doorstep. We ensure quality from
              kitchen to table.
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-md text-center hover:shadow-lg transition">
            <div className="text-4xl mb-4">⭐</div>
            <h4 className="text-xl font-bold text-amber-900 mb-2">
              Premium Quality
            </h4>
            <p className="text-gray-600">
              Each pastry is carefully prepared to meet our highest standards of
              excellence.
            </p>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow-lg p-8 sm:p-12 border-t-4 border-amber-600">
          <h2 className="text-3xl font-bold text-amber-900 mb-2 text-center">
            Be the First to Know
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Sign up for exclusive updates and special launch offers.
          </p>

          <form className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 transition"
                required
              />
              <button
                type="submit"
                className="bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-700 transition whitespace-nowrap"
              >
                Notify Me
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </section>
    </div>
  )
}
