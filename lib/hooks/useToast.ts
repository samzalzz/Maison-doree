import { useCallback } from 'react'
import { useToastContext } from '@/lib/context/ToastContext'
import type { ToastType } from '@/lib/context/ToastContext'

interface ShowToastOptions {
  title: string
  message?: string
  duration?: number
}

export function useToast() {
  const { addToast, removeToast, toasts } = useToastContext()

  const show = useCallback(
    (type: ToastType, options: ShowToastOptions) => {
      addToast({ type, ...options })
    },
    [addToast],
  )

  const success = useCallback(
    (options: ShowToastOptions) => show('success', options),
    [show],
  )

  const error = useCallback(
    (options: ShowToastOptions) => show('error', options),
    [show],
  )

  const info = useCallback(
    (options: ShowToastOptions) => show('info', options),
    [show],
  )

  const warning = useCallback(
    (options: ShowToastOptions) => show('warning', options),
    [show],
  )

  return { toasts, show, success, error, info, warning, removeToast }
}
