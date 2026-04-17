'use client'

import React from 'react'
import type { Delivery, Order, User } from '@prisma/client'

interface DeliveryStatusProps {
  delivery: Delivery & {
    order: Order & {
      user: User & {
        profile?: { firstName?: string | null; lastName?: string | null } | null
      }
      items: any[]
    }
  }
}

export default function DeliveryStatus({ delivery }: DeliveryStatusProps) {
  const statusSteps = [
    { id: 'ASSIGNED', label: 'Assigned', icon: '📦' },
    { id: 'ACCEPTED', label: 'Accepted', icon: '✅' },
    { id: 'IN_PROGRESS', label: 'In Progress', icon: '🚗' },
    { id: 'DELIVERED', label: 'Delivered', icon: '🎉' },
  ]

  const currentStepIndex = statusSteps.findIndex(
    (step) => step.id === delivery.status,
  )

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Delivery Status
      </h2>

      {/* Status Timeline */}
      <div className="flex items-center justify-between">
        {statusSteps.map((step, index) => {
          const isCompleted = index <= currentStepIndex
          const isCurrent = index === currentStepIndex

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center">
              {/* Status Bubble */}
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full text-xl mb-2 ${
                  isCompleted
                    ? isCurrent
                      ? 'bg-blue-600 text-white'
                      : 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {step.icon}
              </div>

              {/* Status Label */}
              <p
                className={`text-xs font-medium text-center ${
                  isCompleted ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {step.label}
              </p>

              {/* Connecting Line */}
              {index < statusSteps.length - 1 && (
                <div
                  className={`absolute w-full h-1 mt-6 ${
                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                  style={{
                    left: 'calc(50% + 24px)',
                    right: '-50%',
                    top: '24px',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Current Status Message */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Current Status:</span>{' '}
          {delivery.status === 'ASSIGNED'
            ? 'This delivery has been assigned to you. Please accept it to continue.'
            : delivery.status === 'ACCEPTED'
              ? 'You have accepted this delivery. Get ready to start delivery.'
              : delivery.status === 'IN_PROGRESS'
                ? 'You are currently delivering this order. Update location and mark as complete when done.'
                : 'This order has been delivered successfully!'}
        </p>
      </div>
    </div>
  )
}
