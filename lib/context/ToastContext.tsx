'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const MAX_TOASTS = 5

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const ToastContext = createContext<ToastContextType | undefined>(
  undefined,
)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = generateId()
      const duration = toast.duration ?? 4000

      setToasts((prev) => {
        // Cap at MAX_TOASTS by dropping oldest entries from the front
        const updated = [...prev, { ...toast, id, duration }]
        return updated.length > MAX_TOASTS
          ? updated.slice(updated.length - MAX_TOASTS)
          : updated
      })

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration)
      }
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToastContext(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToastContext must be used inside <ToastProvider>')
  }
  return ctx
}
