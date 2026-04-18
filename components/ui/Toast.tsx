'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import type { Toast as ToastType } from '@/lib/context/ToastContext'

interface ToastProps {
  toast: ToastType
  onRemove: (id: string) => void
}

const TOAST_STYLES: Record<
  ToastType['type'],
  { container: string; icon: string; IconComponent: React.ElementType }
> = {
  success: {
    container: 'bg-green-50 border-green-400 text-green-900',
    icon: 'text-green-500',
    IconComponent: CheckCircle,
  },
  error: {
    container: 'bg-red-50 border-red-400 text-red-900',
    icon: 'text-red-500',
    IconComponent: AlertCircle,
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-400 text-yellow-900',
    icon: 'text-yellow-500',
    IconComponent: AlertTriangle,
  },
  info: {
    container: 'bg-blue-50 border-blue-400 text-blue-900',
    icon: 'text-blue-500',
    IconComponent: Info,
  },
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [visible, setVisible] = useState(false)

  // Trigger enter animation on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const { container, icon, IconComponent } = TOAST_STYLES[toast.type]

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={[
        'flex items-start gap-3 w-80 max-w-sm rounded-lg border-l-4 px-4 py-3 shadow-lg',
        'transition-all duration-300 ease-out',
        container,
        visible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-8',
      ].join(' ')}
    >
      <span className={`mt-0.5 shrink-0 ${icon}`}>
        <IconComponent size={20} aria-hidden="true" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs opacity-80 leading-snug">
            {toast.message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Fermer la notification"
        className="shrink-0 mt-0.5 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current transition-opacity"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
