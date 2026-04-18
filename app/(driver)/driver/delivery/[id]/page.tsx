import React from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { redirect } from 'next/navigation'
import DeliveryStatus from '@/components/driver/DeliveryStatus'
import Link from 'next/link'

export const metadata = {
  title: 'Delivery Details',
  description: 'View and manage delivery details.',
}

export default async function DeliveryPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await auth()

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  })

  if (!delivery) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Delivery not found</p>
      </div>
    )
  }

  // Verify this delivery belongs to the current driver
  if (delivery.driverId !== session?.user?.id) {
    redirect('/driver/dashboard')
  }

  const customerName =
    delivery.order.user.profile?.firstName &&
    delivery.order.user.profile?.lastName
      ? `${delivery.order.user.profile.firstName} ${delivery.order.user.profile.lastName}`
      : delivery.order.user.email

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/driver/dashboard"
          className="text-blue-600 hover:text-blue-700"
        >
          ← Back
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {delivery.order.orderNumber}
          </h1>
          <p className="text-gray-600 mt-1">Order Details & Delivery Tracking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Status */}
          <DeliveryStatus delivery={delivery} />

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Order Items
            </h2>
            <div className="space-y-4">
              {delivery.order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.product.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {(Number(item.priceAtTime) * item.quantity).toFixed(2)} MAD
                    </p>
                    <p className="text-sm text-gray-600">
                      {Number(item.priceAtTime).toFixed(2)} MAD each
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold text-gray-900">Total</p>
                <p className="text-xl font-bold text-gray-900">
                  {Number(delivery.order.totalPrice).toFixed(2)} MAD
                </p>
              </div>
            </div>
          </div>

          {/* Map Placeholder */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Location
            </h2>
            <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl mb-3 block">📍</span>
                <p className="text-gray-600">
                  Map integration coming soon
                </p>
                {delivery.currentLat && delivery.currentLng && (
                  <p className="text-xs text-gray-500 mt-2">
                    Current: {String(delivery.currentLat)}, {String(delivery.currentLng)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Customer Information
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Name</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {customerName}
                </p>
              </div>
              {delivery.order.user.profile?.phone && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Phone</p>
                  <a
                    href={`tel:${delivery.order.user.profile.phone}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-1 block"
                  >
                    {delivery.order.user.profile.phone}
                  </a>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase">Email</p>
                <a
                  href={`mailto:${delivery.order.user.email}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-1 block"
                >
                  {delivery.order.user.email}
                </a>
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Address
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900 font-medium">
                {delivery.order.deliveryAddress}
              </p>
              <p className="text-gray-600">
                {delivery.order.deliveryCity} {delivery.order.deliveryZipCode}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Actions
            </h3>
            <div className="space-y-3">
              {delivery.status === 'ASSIGNED' && (
                <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium">
                  Accept Delivery
                </button>
              )}
              {delivery.status === 'ACCEPTED' && (
                <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                  Start Delivery
                </button>
              )}
              {delivery.status === 'IN_PROGRESS' && (
                <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium">
                  Complete Delivery
                </button>
              )}
              <button className="w-full bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium">
                Contact Customer
              </button>
            </div>
          </div>

          {/* Delivery Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Timeline
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Order Created</p>
                <p className="font-medium text-gray-900">
                  {new Date(delivery.order.createdAt).toLocaleString()}
                </p>
              </div>
              {delivery.estimatedDelivery && (
                <div>
                  <p className="text-gray-500">Estimated Delivery</p>
                  <p className="font-medium text-gray-900">
                    {new Date(delivery.estimatedDelivery).toLocaleString()}
                  </p>
                </div>
              )}
              {delivery.actualDelivery && (
                <div>
                  <p className="text-gray-500">Delivered</p>
                  <p className="font-medium text-green-600">
                    {new Date(delivery.actualDelivery).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
