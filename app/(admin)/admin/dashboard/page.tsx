import React from 'react'
import { prisma } from '@/lib/db/prisma'
import StatsCard from '@/components/admin/StatsCard'
import Link from 'next/link'

export const metadata = {
  title: 'Dashboard - Admin Panel',
  description: 'Admin dashboard overview with KPIs and recent orders.',
}

export default async function AdminDashboard() {
  // Fetch dashboard KPIs
  const [
    totalOrders,
    totalRevenue,
    pendingOrders,
    lowStockProducts,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.count({
      where: {
        status: 'PENDING',
      },
    }),
    prisma.product.count({
      where: {
        stock: {
          lte: prisma.product.fields.minimumStock,
        },
      },
    }),
    prisma.order.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
  ])

  const revenue = totalRevenue._sum.totalPrice || 0

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your pastry shop operations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Orders"
          value={totalOrders.toString()}
          icon="📦"
        />
        <StatsCard
          title="Total Revenue"
          value={`${Number(revenue).toFixed(2)} MAD`}
          icon="💰"
        />
        <StatsCard
          title="Pending Orders"
          value={pendingOrders.toString()}
          icon="⏳"
          highlight={pendingOrders > 0}
        />
        <StatsCard
          title="Low Stock Items"
          value={lowStockProducts.toString()}
          icon="⚠️"
          highlight={lowStockProducts > 0}
        />
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link
              href="/admin/dashboard"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length > 0 ? (
                recentOrders.map((order) => {
                  const customerName =
                    order.user.profile?.firstName &&
                    order.user.profile?.lastName
                      ? `${order.user.profile.firstName} ${order.user.profile.lastName}`
                      : order.user.email

                  const statusColor =
                    order.status === 'DELIVERED'
                      ? 'text-green-600 bg-green-50'
                      : order.status === 'PENDING'
                        ? 'text-yellow-600 bg-yellow-50'
                        : order.status === 'CANCELLED'
                          ? 'text-red-600 bg-red-50'
                          : 'text-blue-600 bg-blue-50'

                  return (
                    <tr
                      key={order.id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {customerName}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {Number(order.totalPrice).toFixed(2)} MAD
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/products"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <div className="text-3xl mb-2">📦</div>
          <h3 className="font-semibold text-gray-900">Manage Products</h3>
          <p className="text-sm text-gray-600 mt-1">Add, edit, or delete products</p>
        </Link>

        <Link
          href="/admin/stocks"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <div className="text-3xl mb-2">📊</div>
          <h3 className="font-semibold text-gray-900">Manage Stock</h3>
          <p className="text-sm text-gray-600 mt-1">Check inventory levels</p>
        </Link>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-3xl mb-2">⚙️</div>
          <h3 className="font-semibold text-gray-900">Settings</h3>
          <p className="text-sm text-gray-600 mt-1">Configure admin settings</p>
        </div>
      </div>
    </div>
  )
}
