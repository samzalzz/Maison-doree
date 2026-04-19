'use client'

import React, { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType = 'TRANSFER' | 'UPDATE_INVENTORY' | 'NOTIFY' | 'EMAIL'

export interface Lab {
  id: string
  name: string
  type: string
}

export interface Material {
  id: string
  name: string
  unit: string
}

export interface TransferPayload {
  sourceLabId: string
  destLabId: string
  materialId: string
  quantity: number
}

export interface UpdateInventoryPayload {
  labId: string
  materialId: string
  quantity: number
  reason: string
}

export interface NotifyPayload {
  message: string
  channels: string[]
}

export interface EmailPayload {
  to: string
  subject: string
  body: string
}

export type ActionPayload =
  | ({ actionType: 'TRANSFER' } & TransferPayload)
  | ({ actionType: 'UPDATE_INVENTORY' } & UpdateInventoryPayload)
  | ({ actionType: 'NOTIFY' } & NotifyPayload)
  | ({ actionType: 'EMAIL' } & EmailPayload)

interface ActionTypeFieldsProps {
  actionType: ActionType
  payload: Record<string, unknown>
  onChange: (payload: Record<string, unknown>) => void
}

// ---------------------------------------------------------------------------
// Notify channels
// ---------------------------------------------------------------------------

const NOTIFY_CHANNELS = ['slack', 'email', 'sms']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActionTypeFields({ actionType, payload, onChange }: ActionTypeFieldsProps) {
  const [labs, setLabs] = useState<Lab[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loadingRefs, setLoadingRefs] = useState(false)

  // Fetch labs and materials for dropdowns on first render of relevant action types
  useEffect(() => {
    if (actionType !== 'TRANSFER' && actionType !== 'UPDATE_INVENTORY') return
    setLoadingRefs(true)
    Promise.all([
      fetch('/api/admin/labs').then((r) => r.json()).catch(() => ({ success: false })),
      fetch('/api/admin/raw-materials').then((r) => r.json()).catch(() => ({ success: false })),
    ]).then(([labsRes, matsRes]) => {
      if (labsRes.success && Array.isArray(labsRes.data)) {
        setLabs(labsRes.data as Lab[])
      }
      if (matsRes.success && Array.isArray(matsRes.data)) {
        setMaterials(matsRes.data as Material[])
      }
    }).finally(() => setLoadingRefs(false))
  }, [actionType])

  function update(updates: Record<string, unknown>) {
    onChange({ ...payload, ...updates })
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-xs font-semibold text-gray-600 mb-1'

  if (actionType === 'TRANSFER') {
    return (
      <div className="space-y-3" data-testid="action-fields-transfer">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Source Lab</label>
            {loadingRefs ? (
              <p className="text-xs text-gray-400 py-2">Loading labs…</p>
            ) : (
              <select
                value={(payload.sourceLabId as string) ?? ''}
                onChange={(e) => update({ sourceLabId: e.target.value })}
                className={inputClass}
                data-testid="transfer-source-lab"
              >
                <option value="">— Select source lab —</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className={labelClass}>Destination Lab</label>
            {loadingRefs ? (
              <p className="text-xs text-gray-400 py-2">Loading labs…</p>
            ) : (
              <select
                value={(payload.destLabId as string) ?? ''}
                onChange={(e) => update({ destLabId: e.target.value })}
                className={inputClass}
                data-testid="transfer-dest-lab"
              >
                <option value="">— Select destination lab —</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div>
          <label className={labelClass}>Material</label>
          {loadingRefs ? (
            <p className="text-xs text-gray-400 py-2">Loading materials…</p>
          ) : (
            <select
              value={(payload.materialId as string) ?? ''}
              onChange={(e) => update({ materialId: e.target.value })}
              className={inputClass}
              data-testid="transfer-material"
            >
              <option value="">— Select material —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>Quantity</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={(payload.quantity as number) ?? ''}
            onChange={(e) => update({ quantity: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. 50"
            className={inputClass}
            data-testid="transfer-quantity"
          />
        </div>
      </div>
    )
  }

  if (actionType === 'UPDATE_INVENTORY') {
    return (
      <div className="space-y-3" data-testid="action-fields-update-inventory">
        <div>
          <label className={labelClass}>Lab</label>
          {loadingRefs ? (
            <p className="text-xs text-gray-400 py-2">Loading labs…</p>
          ) : (
            <select
              value={(payload.labId as string) ?? ''}
              onChange={(e) => update({ labId: e.target.value })}
              className={inputClass}
              data-testid="inventory-lab"
            >
              <option value="">— Select lab —</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>Material</label>
          {loadingRefs ? (
            <p className="text-xs text-gray-400 py-2">Loading materials…</p>
          ) : (
            <select
              value={(payload.materialId as string) ?? ''}
              onChange={(e) => update({ materialId: e.target.value })}
              className={inputClass}
              data-testid="inventory-material"
            >
              <option value="">— Select material —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>Quantity Adjustment (can be negative)</label>
          <input
            type="number"
            step="0.01"
            value={(payload.quantity as number) ?? ''}
            onChange={(e) => update({ quantity: parseFloat(e.target.value) || 0 })}
            placeholder="e.g. -10 or +50"
            className={inputClass}
            data-testid="inventory-quantity"
          />
        </div>
        <div>
          <label className={labelClass}>Reason</label>
          <input
            type="text"
            value={(payload.reason as string) ?? ''}
            onChange={(e) => update({ reason: e.target.value })}
            placeholder="e.g. Stock correction after audit"
            className={inputClass}
            data-testid="inventory-reason"
          />
        </div>
      </div>
    )
  }

  if (actionType === 'NOTIFY') {
    const selectedChannels = Array.isArray(payload.channels) ? (payload.channels as string[]) : []

    function toggleChannel(ch: string) {
      const next = selectedChannels.includes(ch)
        ? selectedChannels.filter((c) => c !== ch)
        : [...selectedChannels, ch]
      update({ channels: next })
    }

    return (
      <div className="space-y-3" data-testid="action-fields-notify">
        <div>
          <label className={labelClass}>Message</label>
          <textarea
            value={(payload.message as string) ?? ''}
            onChange={(e) => update({ message: e.target.value })}
            rows={3}
            placeholder="Notification message…"
            className={`${inputClass} resize-none`}
            data-testid="notify-message"
          />
        </div>
        <div>
          <label className={labelClass}>Channels</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {NOTIFY_CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedChannels.includes(ch)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                data-testid={`notify-channel-${ch}`}
              >
                {ch}
              </button>
            ))}
          </div>
          {selectedChannels.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">Select at least one channel.</p>
          )}
        </div>
      </div>
    )
  }

  if (actionType === 'EMAIL') {
    return (
      <div className="space-y-3" data-testid="action-fields-email">
        <div>
          <label className={labelClass}>To (email address)</label>
          <input
            type="email"
            value={(payload.to as string) ?? ''}
            onChange={(e) => update({ to: e.target.value })}
            placeholder="recipient@example.com"
            className={inputClass}
            data-testid="email-to"
          />
        </div>
        <div>
          <label className={labelClass}>Subject</label>
          <input
            type="text"
            value={(payload.subject as string) ?? ''}
            onChange={(e) => update({ subject: e.target.value })}
            placeholder="Email subject line"
            className={inputClass}
            data-testid="email-subject"
          />
        </div>
        <div>
          <label className={labelClass}>Body</label>
          <textarea
            value={(payload.body as string) ?? ''}
            onChange={(e) => update({ body: e.target.value })}
            rows={4}
            placeholder="Email body text…"
            className={`${inputClass} resize-none`}
            data-testid="email-body"
          />
        </div>
      </div>
    )
  }

  return null
}
