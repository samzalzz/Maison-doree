'use client'

import React from 'react'

interface Driver {
  id: string
  email: string
  profile?: {
    firstName?: string
    lastName?: string
    phone?: string
  }
}

interface Delivery {
  id: string
  status: string
  estimatedDelivery?: string | null
  actualDelivery?: string | null
  currentLat?: number | string | null
  currentLng?: number | string | null
  locationUpdatedAt?: string | null
  driver?: Driver | null
  driverId?: string | null
}

interface DeliveryStatusProps {
  delivery: Delivery
}

const DELIVERY_TIMELINE = [
  { status: 'UNASSIGNED', label: 'Order Placed', icon: '📋' },
  { status: 'ASSIGNED', label: 'Driver Assigned', icon: '👤' },
  { status: 'ACCEPTED', label: 'Accepted by Driver', icon: '✓' },
  { status: 'IN_PROGRESS', label: 'Out for Delivery', icon: '🚗' },
  { status: 'DELIVERED', label: 'Delivered', icon: '📦' },
]

export default function DeliveryStatus({ delivery }: DeliveryStatusProps) {
  // Get the current step index
  const currentStepIndex = DELIVERY_TIMELINE.findIndex(
    (step) => step.status === delivery.status,
  )

  // Calculate progress percentage
  const progress = ((currentStepIndex + 1) / DELIVERY_TIMELINE.length) * 100

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Delivery Progress
      </h2>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Progress</span>
          <span className="text-sm font-semibold text-amber-600">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {DELIVERY_TIMELINE.map((step, index) => {
          const isCompleted = currentStepIndex >= index
          const isCurrent = currentStepIndex === index

          return (
            <div key={step.status} className="flex gap-4">
              {/* Step Indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold transition ${
                    isCurrent
                      ? 'bg-amber-600 text-white ring-4 ring-amber-100'
                      : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.icon}
                </div>
                {index < DELIVERY_TIMELINE.length - 1 && (
                  <div
                    className={`w-1 h-12 mt-2 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 py-2">
                <p
                  className={`font-semibold text-sm ${
                    isCurrent
                      ? 'text-gray-900'
                      : isCompleted
                        ? 'text-green-700'
                        : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>

                {/* Status Details */}
                {isCurrent && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-amber-700 font-medium">
                      Current Status
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
                      <span className="text-sm text-gray-600">
                        {getStatusDescription(delivery.status)}
                      </span>
                    </div>
                  </div>
                )}

                {isCompleted && !isCurrent && index === 1 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {delivery.driver
                      ? `Assigned to ${delivery.driver.profile?.firstName} ${delivery.driver.profile?.lastName || ''}`
                      : 'Driver assignment pending'}
                  </p>
                )}

                {isCompleted && !isCurrent && index === 4 && delivery.actualDelivery && (
                  <p className="text-xs text-green-700 mt-2">
                    Delivered on{' '}
                    {new Date(delivery.actualDelivery).toLocaleDateString()} at{' '}
                    {new Date(delivery.actualDelivery).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ETA Info Card */}
      {delivery.estimatedDelivery &&
        ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(delivery.status) && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Estimated Delivery
              </p>
              <p className="text-lg font-bold text-blue-700">
                {new Date(delivery.estimatedDelivery).toLocaleDateString()} at{' '}
                {new Date(delivery.estimatedDelivery).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}

      {/* Delivery Status Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-700 mb-3 uppercase">
          Status Legend
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-600 rounded-full" />
            <span className="text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span className="text-gray-600">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-gray-600">Upcoming</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    UNASSIGNED: 'Waiting for driver assignment...',
    ASSIGNED: 'Driver has been assigned to your order',
    ACCEPTED: 'Driver accepted and is preparing to leave',
    IN_PROGRESS: 'Driver is on the way to your location',
    DELIVERED: 'Your order has been delivered',
  }
  return descriptions[status] || 'Status update pending'
}
