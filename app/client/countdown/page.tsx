'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import CountdownTimer from '@/components/CountdownTimer'

// Launch date - configure this as needed (May 1, 2026 in this example)
const LAUNCH_DATE = new Date('2026-05-01T00:00:00Z')

export default function CountdownPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  )
  const [errorMessage, setErrorMessage] = useState('')

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      // TODO: Implement email signup API endpoint
      // For now, just simulate a successful submission
      console.log('Email signup:', email)
      setSubmitStatus('success')
      setEmail('')
      setTimeout(() => setSubmitStatus('idle'), 3000)
    } catch (error) {
      setSubmitStatus('error')
      setErrorMessage('Failed to sign up. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLaunchDateReached = () => {
    // Redirect to products page when launch date is reached
    router.push('/products')
  }

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

          {/* Decorative element */}
          <div className="flex justify-center gap-2 mb-12">
            <div className="w-3 h-3 rounded-full bg-amber-600"></div>
            <div className="w-3 h-3 rounded-full bg-amber-600"></div>
            <div className="w-3 h-3 rounded-full bg-amber-600"></div>
          </div>
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

      {/* Email Signup Section */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow-lg p-8 sm:p-12 border-t-4 border-amber-600">
          <h2 className="text-3xl font-bold text-amber-900 mb-2 text-center">
            Be the First to Know
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Sign up for exclusive updates and special launch offers.
          </p>

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 px-4 py-3 border-2 border-amber-300 rounded-lg focus:outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 transition"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-700 disabled:bg-amber-400 transition whitespace-nowrap"
              >
                {isSubmitting ? 'Signing up...' : 'Notify Me'}
              </button>
            </div>

            {submitStatus === 'success' && (
              <div className="bg-green-100 border-l-4 border-green-600 text-green-700 p-4 rounded">
                <p className="font-semibold">Success!</p>
                <p>Thank you for signing up. We'll notify you when we launch.</p>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="bg-red-100 border-l-4 border-red-600 text-red-700 p-4 rounded">
                <p className="font-semibold">Oops!</p>
                <p>{errorMessage}</p>
              </div>
            )}
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-center text-amber-900 mb-12">
          What's Coming
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

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h3 className="text-2xl font-bold text-amber-900 mb-4">
          Can't Wait? Start Exploring!
        </h3>
        <p className="text-gray-600 mb-8">
          Browse our upcoming collection to see what we have in store.
        </p>
        <a
          href="/products"
          className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-700 transition"
        >
          View Products
        </a>
      </section>
    </div>
  )
}
