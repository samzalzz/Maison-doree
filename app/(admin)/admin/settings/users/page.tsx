'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/hooks/useToast'
import {
  Search,
  RefreshCw,
  Loader2,
  Users,
  Filter,
} from 'lucide-react'

interface UserProfile {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

interface User {
  id: string
  email: string
  role: 'CUSTOMER' | 'ADMIN' | 'DRIVER' | 'WORKER' | 'MANAGER'
  createdAt: string
  profile: UserProfile
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  ADMIN: 'Administrator',
  DRIVER: 'Driver',
  WORKER: 'Worker',
  MANAGER: 'Manager',
}

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'bg-blue-50 text-blue-700',
  ADMIN: 'bg-red-50 text-red-700',
  DRIVER: 'bg-green-50 text-green-700',
  WORKER: 'bg-yellow-50 text-yellow-700',
  MANAGER: 'bg-purple-50 text-purple-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [total, setTotal] = useState(0)
  const { error: toastError } = useToast()

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (roleFilter) params.append('role', roleFilter)
      params.append('limit', '100')

      const res = await fetch(`/api/admin/users?${params.toString()}`)
      const json = await res.json()

      if (!res.ok || !json.success) {
        toastError({
          title: 'Load Failed',
          message: json.error?.message ?? 'Failed to load users.',
        })
        return
      }

      setUsers(json.data ?? [])
      setTotal(json.data?.length ?? 0)
    } finally {
      setIsLoading(false)
    }
  }, [search, roleFilter, toastError])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const getFullName = (user: User): string => {
    const firstName = user.profile?.firstName || ''
    const lastName = user.profile?.lastName || ''
    return `${firstName} ${lastName}`.trim() || 'No name'
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} user{total !== 1 ? 's' : ''} total
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh users list"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 inset-y-0 my-auto w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Administrator</option>
            <option value="CUSTOMER">Customer</option>
            <option value="DRIVER">Driver</option>
            <option value="WORKER">Worker</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {['ADMIN', 'CUSTOMER', 'DRIVER', 'WORKER', 'MANAGER'].map((role) => {
            const count = users.filter((u) => u.role === role).length
            return (
              <div
                key={role}
                className={`rounded-lg px-4 py-3 text-center ${ROLE_COLORS[role]} border border-opacity-20`}
              >
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs">{ROLE_LABELS[role]}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="User Management">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && users.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-6 py-3">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-gray-500">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="font-medium">No users found</p>
                    <p className="text-xs mt-1">
                      {search || roleFilter
                        ? 'Try adjusting your filters.'
                        : 'No users in the system.'}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {getFullName(user)}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{user.email}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          ROLE_COLORS[user.role]
                        }`}
                      >
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
