import React from 'react'
import { prisma } from '@/lib/db/prisma'

export const metadata = {
  title: 'Stock Management - Admin Panel',
  description: 'Monitor and manage product inventory levels.',
}

export default async function StockPage() {
  const products = await prisma.product.findMany({
    orderBy: {
      stock: 'asc',
    },
  })

  const lowStockProducts = products.filter(
    (p) => p.stock <= p.minimumStock,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
        <p className="text-gray-600 mt-1">Monitor inventory levels across all products</p>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-2xl mr-4">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-900">Low Stock Alert</h3>
              <p className="text-sm text-red-700 mt-1">
                {lowStockProducts.length} product(s) are at or below minimum stock
                level.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stock Levels Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Minimum Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const isLowStock = product.stock <= product.minimumStock
                const stockPercentage = Math.round(
                  (product.stock / Math.max(product.minimumStock * 2, 1)) * 100,
                )

                return (
                  <tr
                    key={product.id}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              isLowStock ? 'bg-red-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-900">
                          {product.stock}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {product.minimumStock}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isLowStock
                            ? 'text-red-600 bg-red-50'
                            : 'text-green-600 bg-green-50'
                        }`}
                      >
                        {isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-blue-600 hover:text-blue-700 font-medium">
                        {isLowStock ? 'Reorder' : 'Update'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {products.length}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow border border-green-200">
          <p className="text-sm text-green-700">Adequate Stock</p>
          <p className="text-2xl font-bold text-green-900 mt-2">
            {products.filter((p) => p.stock > p.minimumStock).length}
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg shadow border border-red-200">
          <p className="text-sm text-red-700">Low Stock</p>
          <p className="text-2xl font-bold text-red-900 mt-2">
            {lowStockProducts.length}
          </p>
        </div>
      </div>
    </div>
  )
}
