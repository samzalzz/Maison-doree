'use client'

import React, { useState } from 'react'
import { useToast } from '@/lib/hooks/useToast'

interface PointsRuleData {
  id: string
  name: string
  type: string
  pointsPerUnit: number
  applicableCategory: string | null
  minOrderAmount: number | null
  tierRequired: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface PointsRuleProps {
  rule: PointsRuleData
  onUpdate: (updated: PointsRuleData) => void
  onDelete: (id: string) => void
}

const RULE_TYPE_LABELS: Record<string, string> = {
  BASE_PURCHASE: 'Base Purchase',
  CATEGORY_BONUS: 'Category Bonus',
  TIER_BONUS: 'Tier Bonus',
  REFERRAL: 'Referral',
}

export function PointsRule({ rule, onUpdate, onDelete }: PointsRuleProps) {
  const { success, error: toastError } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editName, setEditName] = useState(rule.name)
  const [editPointsPerUnit, setEditPointsPerUnit] = useState(
    String(rule.pointsPerUnit),
  )
  const [editIsActive, setEditIsActive] = useState(rule.isActive)

  const handleToggleActive = async () => {
    try {
      const res = await fetch(`/api/admin/loyalty/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message)
      onUpdate(data.data)
      success({
        title: 'Rule updated',
        message: `Rule ${data.data.isActive ? 'activated' : 'deactivated'}`,
      })
    } catch (err) {
      toastError({
        title: 'Update failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    }
  }

  const handleSave = async () => {
    const points = parseFloat(editPointsPerUnit)
    if (isNaN(points) || points <= 0) {
      toastError({ title: 'Validation error', message: 'Points per unit must be positive.' })
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/loyalty/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          pointsPerUnit: points,
          isActive: editIsActive,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message)
      onUpdate(data.data)
      setIsEditing(false)
      success({ title: 'Rule saved', message: 'Changes have been saved.' })
    } catch (err) {
      toastError({
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/loyalty/rules/${rule.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error?.message)
      onDelete(rule.id)
      success({ title: 'Rule deleted', message: `"${rule.name}" removed.` })
    } catch (err) {
      toastError({
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
      setIsDeleting(false)
    }
  }

  return (
    <tr className="border-b hover:bg-gray-50 transition">
      {/* Name */}
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        ) : (
          <span className="font-medium text-gray-900 text-sm">{rule.name}</span>
        )}
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          {RULE_TYPE_LABELS[rule.type] ?? rule.type}
        </span>
      </td>

      {/* Points per unit */}
      <td className="px-4 py-3">
        {isEditing ? (
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={editPointsPerUnit}
            onChange={(e) => setEditPointsPerUnit(e.target.value)}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        ) : (
          <span className="text-sm text-gray-700">{Number(rule.pointsPerUnit).toFixed(2)}</span>
        )}
      </td>

      {/* Tier required */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-500">{rule.tierRequired ?? 'All'}</span>
      </td>

      {/* Status toggle */}
      <td className="px-4 py-3">
        {isEditing ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs text-gray-600">Active</span>
          </label>
        ) : (
          <button
            onClick={handleToggleActive}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
              rule.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {rule.isActive ? 'Active' : 'Inactive'}
          </button>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditName(rule.name)
                  setEditPointsPerUnit(String(rule.pointsPerUnit))
                  setEditIsActive(rule.isActive)
                }}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
              >
                {isDeleting ? '...' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
