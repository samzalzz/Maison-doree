'use client'

import { X, Bell } from 'lucide-react'
import type { NotificationItem } from '@/lib/types/notification'
import { useToast } from '@/lib/hooks/useToast'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications: NotificationItem[]
  onNotificationsChange: (notifications: NotificationItem[]) => void
}

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onNotificationsChange,
}: NotificationCenterProps) {
  const toast = useToast()

  if (!isOpen) return null

  // ---------------------------------------------------------------------------
  // Mark a single notification as read
  // ---------------------------------------------------------------------------

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      })

      if (!res.ok) throw new Error('Failed to update')

      onNotificationsChange(
        notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
    } catch {
      toast.error({ title: 'Erreur', message: 'Impossible de marquer comme lu' })
    }
  }

  // ---------------------------------------------------------------------------
  // Mark ALL unread notifications as read
  // ---------------------------------------------------------------------------

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read)
    if (unread.length === 0) return

    try {
      await Promise.all(
        unread.map((n) =>
          fetch(`/api/notifications/${n.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          }),
        ),
      )

      onNotificationsChange(notifications.map((n) => ({ ...n, read: true })))
    } catch {
      toast.error({ title: 'Erreur', message: 'Impossible de marquer comme lu' })
    }
  }

  // ---------------------------------------------------------------------------
  // Delete a notification
  // ---------------------------------------------------------------------------

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete')

      onNotificationsChange(notifications.filter((n) => n.id !== id))
    } catch {
      toast.error({ title: 'Erreur', message: 'Impossible de supprimer' })
    }
  }

  // ---------------------------------------------------------------------------
  // Format creation date
  // ---------------------------------------------------------------------------

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "A l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays === 1) return 'Hier'
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="absolute top-12 right-0 z-50 w-96 bg-white rounded-xl shadow-xl border border-gray-100 max-h-[480px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium transition"
            >
              Tout lire
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Bell className="w-10 h-10 text-gray-300 mb-3" />
            <p className="font-medium text-gray-500">Aucune notification</p>
            <p className="text-sm text-gray-400 mt-1">
              Vous serez notifié ici de toutes les mises à jour importantes.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                className={`px-4 py-3 hover:bg-gray-50 transition group ${
                  !notif.read ? 'bg-amber-50/40' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    {!notif.read ? (
                      <span className="block w-2 h-2 rounded-full bg-amber-500" />
                    ) : (
                      <span className="block w-2 h-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium leading-tight ${
                        !notif.read ? 'text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">
                        {formatDate(notif.createdAt)}
                      </span>
                      {!notif.read && (
                        <button
                          onClick={() => handleMarkRead(notif.id)}
                          className="text-xs text-amber-600 hover:text-amber-700 font-medium transition"
                        >
                          Marquer lu
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete button — visible on hover */}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="flex-shrink-0 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition mt-0.5"
                    aria-label="Supprimer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <a
            href="/notifications"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium transition"
          >
            Voir toutes les notifications
          </a>
        </div>
      )}
    </div>
  )
}
