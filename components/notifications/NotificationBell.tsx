'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { NotificationCenter } from './NotificationCenter'
import type { NotificationItem } from '@/lib/types/notification'

export function NotificationBell() {
  const { data: session } = useSession()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Fetch notifications when the user is authenticated
  useEffect(() => {
    if (!session?.user?.id) {
      setNotifications([])
      return
    }

    const fetchNotifications = () => {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setNotifications(data.data ?? [])
          }
        })
        .catch(() => {
          // silently ignore fetch errors (user may be offline)
        })
    }

    fetchNotifications()

    // Poll every 30 seconds to pick up new notifications
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [session?.user?.id])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Don't render the bell when the user is not logged in
  if (!session?.user?.id) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-lg text-gray-600 hover:text-amber-600 hover:bg-amber-50 transition"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.2rem] h-5 flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        notifications={notifications}
        onNotificationsChange={setNotifications}
      />
    </div>
  )
}
