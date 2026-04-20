'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { Shield, Users, Lock, Eye } from 'lucide-react'

interface RoleInfo {
  role: string
  label: string
  description: string
  color: string
  permissions: string[]
  userCount?: number
}

const ROLES: RoleInfo[] = [
  {
    role: 'ADMIN',
    label: 'Administrator',
    description: 'Full system access with all permissions',
    color: 'bg-red-50 text-red-700 border-red-200',
    permissions: [
      'Manage all users',
      'Access all dashboards',
      'Configure system settings',
      'View all reports',
      'Manage suppliers',
      'Manage production',
      'Manage e-commerce',
      'Manage workflows',
    ],
  },
  {
    role: 'MANAGER',
    label: 'Manager',
    description: 'Team oversight and production management',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    permissions: [
      'View worker dashboards',
      'Monitor production',
      'Generate reports',
      'Manage team assignments',
      'View forecasts',
      'Manage workflows',
      'Access batch management',
    ],
  },
  {
    role: 'WORKER',
    label: 'Worker',
    description: 'Production and daily task execution',
    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    permissions: [
      'View assigned batches',
      'Report production progress',
      'View production dashboard',
      'Access task list',
      'Track completion metrics',
    ],
  },
  {
    role: 'DRIVER',
    label: 'Driver',
    description: 'Delivery and logistics management',
    color: 'bg-green-50 text-green-700 border-green-200',
    permissions: [
      'View delivery routes',
      'Update order status',
      'Access order details',
      'View delivery history',
      'Update location',
    ],
  },
  {
    role: 'CUSTOMER',
    label: 'Customer',
    description: 'Standard customer access',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    permissions: [
      'Place orders',
      'View order history',
      'Track deliveries',
      'Manage profile',
      'View product catalog',
    ],
  },
]

export default function AdminRolesPage() {
  const [expandedRole, setExpandedRole] = useState<string | null>('ADMIN')

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          View and manage user roles and permissions
        </p>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map((roleInfo) => (
          <div
            key={roleInfo.role}
            className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${roleInfo.color} ${
              expandedRole === roleInfo.role ? 'ring-2 ring-offset-2 ring-blue-500' : ''
            }`}
            onClick={() =>
              setExpandedRole(expandedRole === roleInfo.role ? null : roleInfo.role)
            }
          >
            {/* Role Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-base">{roleInfo.label}</h3>
                  <p className="text-xs opacity-75 mt-0.5">{roleInfo.description}</p>
                </div>
              </div>
              <div className="text-xs font-semibold opacity-50">
                {roleInfo.role}
              </div>
            </div>

            {/* Expandable Permissions */}
            {expandedRole === roleInfo.role && (
              <div className="mt-4 pt-4 border-t border-current border-opacity-20 space-y-2">
                <p className="text-xs font-semibold opacity-75 uppercase tracking-wider">
                  Permissions
                </p>
                <ul className="space-y-1">
                  {roleInfo.permissions.map((permission) => (
                    <li key={permission} className="flex items-start gap-2 text-sm">
                      <Eye className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-50" />
                      <span>{permission}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Role Hierarchy Info */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-6">
        <div className="flex gap-3">
          <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">Role Hierarchy</h3>
            <p className="text-sm text-blue-700 mt-1">
              Roles are assigned during user creation and can be modified in the Users
              management section. Higher-level roles inherit permissions from lower levels.
              Contact an administrator to modify role permissions.
            </p>
          </div>
        </div>
      </div>

      {/* Access Control Info */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-6">
        <div className="flex gap-3">
          <Users className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900">Access Control</h3>
            <p className="text-sm text-amber-700 mt-1">
              All user access is controlled through role-based access control (RBAC).
              Users can only access features and pages available to their assigned role.
              Changes to roles take effect on the user's next login.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
