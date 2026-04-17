import React from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import Link from 'next/link'

export const metadata = {
  title: 'Driver Dashboard',
  description: 'View and manage your active deliveries.',
}

export default async function DriverDashboard() {
  const session = await auth()

  // Fetch active deliveries for this driver
  const activeDeliveries = await prisma.delivery.findMany({
    where: {
      driverId: session?.user?.id,
      status: {
        in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'],
      },
    },
    include: {
      order: {
        include: {
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  address: true,
                  city: true,
                },
              },
            },
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Fetch completed deliveries for today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const completedToday = await prisma.delivery.count({
    where: {
      driverId: session?.user?.id,
      status: 'DELIVERED',
      actualDelivery: {
        gte: today,
        lt: tomorrow,
      },
    },
  })

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Driver Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your active deliveries</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Active Deliveries</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {activeDeliveries.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Completed Today</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{completedToday}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Pending Acceptance</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {
              activeDeliveries.filter((d) => d.status === 'ASSIGNED').length
            }
          </p>
        </div>
      </div>

      {/* Active Deliveries */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Active Deliveries
          </h2>
        </div>

        {activeDeliveries.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {activeDeliveries.map((delivery) => {
              const customerName =
                delivery.order.user.profile?.firstName &&
                delivery.order.user.profile?.lastName
                  ? `${delivery.order.user.profile.firstName} ${delivery.order.user.profile.lastName}`
                  : delivery.order.user.email

              const statusColor =
                delivery.status === 'DELIVERED'
                  ? 'text-green-600 bg-green-50'
                  : delivery.status === 'IN_PROGRESS'
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-yellow-600 bg-yellow-50'

              return (
                <div
                  key={delivery.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {delivery.order.orderNumber}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
                        >
                          {delivery.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Customer</p>
                          <p className="text-sm font-medium text-gray-900">
                            {customerName}
                          </p>
                          {delivery.order.user.profile?.phone && (
                            <p className="text-sm text-gray-600">
                              {delivery.order.user.profile.phone}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">
                            Delivery Address
                          </p>
                          <p className="text-sm text-gray-900">
                            {delivery.order.deliveryAddress}
                          </p>
                          <p className="text-sm text-gray-600">
                            {delivery.order.deliveryCity}{' '}
                            {delivery.order.deliveryZipCode}
                          </p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 uppercase mb-2">Items</p>
                        <ul className="space-y-1">
                          {delivery.order.items.map((item) => (
                            <li
                              key={item.id}
                              className="text-sm text-gray-600"
                            >
                              {item.quantity}x {item.product.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="ml-6">
                      <Link
                        href={`/driver/delivery/${delivery.id}`}
                        className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No active deliveries</p>
            <p className="text-sm text-gray-400">
              Check back later for new delivery assignments
            </p>
          </div>
        )}
      </div>

      {/* Quick Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Driver Tips</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>✓ Accept deliveries as soon as possible</li>
          <li>✓ Update your location regularly</li>
          <li>✓ Mark deliveries as completed with photo proof</li>
          <li>✓ Contact customers if there are any issues</li>
        </ul>
      </div>
    </div>
  )
}
