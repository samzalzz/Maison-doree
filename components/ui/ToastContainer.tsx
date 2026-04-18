'use client'

import React from 'react'
import { useToastContext } from '@/lib/context/ToastContext'
import { Toast } from './Toast'

export function ToastContainer() {
  const { toasts, removeToast } = useToastContext()

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  )
}
