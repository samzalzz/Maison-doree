'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface FAQItem {
  id: string
  category: string
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    id: '1',
    category: 'Orders',
    question: 'How do I place an order?',
    answer:
      'To place an order, browse our shop, add items to your cart, and proceed to checkout. You can pay using Stripe or choose Cash on Delivery. Once your payment is confirmed, your order will be processed immediately.',
  },
  {
    id: '2',
    category: 'Orders',
    question: 'Can I cancel my order?',
    answer:
      'You can cancel your order within 1 hour of placing it. After that, the order will have been assigned to our kitchen for preparation. Once prepared, cancellation is not possible. Please contact support for special cases.',
  },
  {
    id: '3',
    category: 'Orders',
    question: 'How can I view my order history?',
    answer:
      'Log in to your account and go to the "Order History" section. You can view all your past and current orders, track their status, and access delivery information.',
  },
  {
    id: '4',
    category: 'Delivery',
    question: 'How long does delivery take?',
    answer:
      'Delivery times vary based on your location and current order volume. Most deliveries within the city are completed within 2-4 hours. You can check the estimated delivery time for your specific order during checkout.',
  },
  {
    id: '5',
    category: 'Delivery',
    question: 'Can I track my delivery in real-time?',
    answer:
      'Yes! Once your order is out for delivery, you can track the driver\'s location in real-time. You\'ll find the tracking feature in your order details page.',
  },
  {
    id: '6',
    category: 'Delivery',
    question: 'What are your delivery areas?',
    answer:
      'We currently deliver to all areas within the city limits. For specific areas or rural regions, please contact our support team. Delivery charges vary based on distance.',
  },
  {
    id: '7',
    category: 'Payments',
    question: 'What payment methods do you accept?',
    answer:
      'We accept Stripe (cards, Apple Pay, Google Pay) and Cash on Delivery (COD). Choose your preferred payment method during checkout.',
  },
  {
    id: '8',
    category: 'Payments',
    question: 'Is my payment information secure?',
    answer:
      'Yes! We use Stripe, a PCI-compliant payment processor, to handle all card transactions. Your payment information is encrypted and never stored on our servers.',
  },
  {
    id: '9',
    category: 'Payments',
    question: 'Can I get a refund?',
    answer:
      'Refunds are processed for failed payments or cancelled orders. The refund will be credited back to your original payment method within 3-5 business days.',
  },
  {
    id: '10',
    category: 'Account',
    question: 'How do I create an account?',
    answer:
      'Click the "Register" button on the homepage, enter your email and password, and fill in your profile information. Your account will be activated immediately.',
  },
  {
    id: '11',
    category: 'Account',
    question: 'How do I reset my password?',
    answer:
      'Click "Forgot Password" on the login page, enter your email, and follow the instructions sent to your inbox. You\'ll receive a password reset link within minutes.',
  },
  {
    id: '12',
    category: 'Account',
    question: 'What is the Loyalty Program?',
    answer:
      'Our Loyalty Program rewards you with points for every purchase. Accumulate points to unlock discounts and exclusive benefits. Bronze (0-99 MAD), Silver (100-499 MAD), and Gold (500+ MAD) tiers offer increasing rewards.',
  },
  {
    id: '13',
    category: 'Products',
    question: 'Are your products fresh?',
    answer:
      'Absolutely! All our pastries are baked fresh to order or prepared the same day. We use premium ingredients and traditional recipes to ensure the highest quality.',
  },
  {
    id: '14',
    category: 'Products',
    question: 'Do you offer dietary options?',
    answer:
      'We have a selection of products suitable for different dietary preferences. For specific requirements (gluten-free, vegan, etc.), please contact our support team.',
  },
  {
    id: '15',
    category: 'Products',
    question: 'Can I customize my order?',
    answer:
      'Yes! Many of our products can be customized. You can choose packaging options and request special modifications during checkout or by contacting our support team.',
  },
]

const CATEGORIES = ['All', 'Orders', 'Delivery', 'Payments', 'Account', 'Products']

export default function HelpPage() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter FAQs
  const filteredFaqs = FAQS.filter((faq) => {
    const matchCategory = selectedCategory === 'All' || faq.category === selectedCategory
    const matchSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Help & Support</h1>
          <p className="text-xl text-gray-600 mb-8">
            Find answers to common questions or create a support ticket
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/tickets"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition font-medium"
            >
              View Your Tickets
            </Link>
            <Link
              href="/tickets/new"
              className="inline-block bg-white border-2 border-amber-600 text-amber-600 px-8 py-3 rounded-lg hover:bg-amber-50 transition font-medium"
            >
              Create New Ticket
            </Link>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Category</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedCategory === category
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FAQs */}
        {filteredFaqs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No FAQs found
            </h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your search or category filter.
            </p>
            <Link
              href="/tickets/new"
              className="inline-block bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
            >
              Create a Support Ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="bg-white rounded-lg shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 transition flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {faq.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 text-left">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="text-gray-400 flex-shrink-0">
                    <svg
                      className={`w-6 h-6 transition-transform ${
                        expandedId === faq.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded Answer */}
                {expandedId === faq.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info Footer */}
        {filteredFaqs.length > 0 && (
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-6">
              Couldn't find what you were looking for?
            </p>
            <Link
              href="/tickets/new"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition font-medium"
            >
              Create a Support Ticket
            </Link>
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-16 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-sm p-8 border border-amber-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Direct Support?</h2>
          <p className="text-gray-700 mb-6">
            Our support team is here to help! Create a support ticket for a faster response, or check your existing tickets below.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/tickets"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg hover:bg-amber-700 transition font-medium text-center"
            >
              View Support Tickets
            </Link>
            <Link
              href="/tickets/new"
              className="inline-block bg-white border-2 border-amber-600 text-amber-600 px-8 py-3 rounded-lg hover:bg-amber-50 transition font-medium text-center"
            >
              Create a New Ticket
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
