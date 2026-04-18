'use client'

import React from 'react'
import type { Delivery, Order, User, Profile, OrderItem, Product } from '@prisma/client'

interface DeliveryStatusProps {
  delivery: Delivery & {
    order: Order & {
      user: User & {
        profile: Profile | null
      }
      items: (OrderItem & { product: Product })[]
    }
  }
}

export default function DeliveryStatus({ delivery }: DeliveryStatusProps) {
  const statusSteps = [
    { id: 'ASSIGNED', label: 'Assigned', icon: '📦' },
    { id: 'ACCEPTED', label: 'Accepted', icon: '✅' },
    { id: 'IN_PROGRESS', label: 'In Progress', icon: '🚗' },
    { id: 'COMPLETED', label: 'Completed', icon: '✅' },
  ]

  const currentStepIndex = statusSteps.findIndex(
    (step) => step.id === delivery.status
  )

  return (
    <div className="space-y-6">
      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Delivery Status
        </h3>
        <div className="space-y-4">
          {statusSteps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold
                ${
                  index <= currentStepIndex
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }
              `}
              >
                {step.icon}
              </div>
              <div>
                <p className="font-medium text-gray-900">{step.label}</p>
                {index === currentStepIndex && delivery.status !== 'COMPLETED' && (
                  <p className="text-sm text-amber-600">Current step</p>
                )}
                {index === currentStepIndex && delivery.status === 'COMPLETED' && (
                  <p className="text-sm text-green-600">✓ Completed</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proof Photo */}
      {delivery.proofPhoto && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Proof of Delivery
          </h3>
          <img
            src={delivery.proofPhoto}
            alt="Delivery proof"
            className="w-full h-64 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Actual Delivery Time */}
      {delivery.actualDelivery && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">
            ✓ Delivered on{' '}
            {new Date(delivery.actualDelivery).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
