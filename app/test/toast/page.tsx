'use client'

import React from 'react'
import { useToast } from '@/lib/hooks/useToast'

export default function ToastTestPage() {
  const toast = useToast()

  const fireSuccess = () =>
    toast.success({
      title: 'Commande confirmée',
      message: 'Votre commande a été passée avec succès.',
    })

  const fireError = () =>
    toast.error({
      title: 'Erreur de paiement',
      message: 'Impossible de traiter votre carte. Veuillez réessayer.',
    })

  const fireWarning = () =>
    toast.warning({
      title: 'Stock limité',
      message: 'Seulement 2 unités restantes en stock.',
    })

  const fireInfo = () =>
    toast.info({
      title: 'Livraison estimée',
      message: 'Votre commande arrivera dans 2-3 jours ouvrables.',
    })

  const fireStackOverflow = () => {
    // Fire 6 toasts — only 5 should be visible at any time
    for (let i = 1; i <= 6; i++) {
      toast.info({
        title: `Toast #${i}`,
        message: `Test de dépassement de pile (max 5)`,
        duration: 8000,
      })
    }
  }

  const firePersistent = () =>
    toast.warning({
      title: 'Toast persistant',
      message: 'Ce toast ne se ferme pas automatiquement.',
      duration: 0,
    })

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Toast Notification — Test Page
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          Testez les 4 types de notifications, le stacking (max 5) et la fermeture manuelle.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={fireSuccess}
            className="rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-green-700 active:scale-95 transition-all"
          >
            Success toast
          </button>

          <button
            onClick={fireError}
            className="rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-red-700 active:scale-95 transition-all"
          >
            Error toast
          </button>

          <button
            onClick={fireWarning}
            className="rounded-lg bg-yellow-500 px-4 py-3 text-sm font-medium text-white shadow hover:bg-yellow-600 active:scale-95 transition-all"
          >
            Warning toast
          </button>

          <button
            onClick={fireInfo}
            className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-blue-700 active:scale-95 transition-all"
          >
            Info toast
          </button>

          <button
            onClick={fireStackOverflow}
            className="col-span-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white shadow hover:bg-purple-700 active:scale-95 transition-all"
          >
            Fire 6 toasts (verify only 5 stack)
          </button>

          <button
            onClick={firePersistent}
            className="col-span-2 rounded-lg bg-gray-700 px-4 py-3 text-sm font-medium text-white shadow hover:bg-gray-800 active:scale-95 transition-all"
          >
            Persistent toast (duration: 0 — manual close only)
          </button>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500">
          <p className="font-semibold text-gray-700 mb-1">Checklist de vérification</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Les toasts apparaissent en haut à droite</li>
            <li>Fermeture automatique après 4 secondes (défaut)</li>
            <li>Maximum 5 toasts empilés simultanément</li>
            <li>Bouton X ferme le toast manuellement</li>
            <li>Couleurs : vert / rouge / jaune / bleu selon le type</li>
            <li>Icônes lucide-react correctes par type</li>
            <li>Animation d&apos;entrée (glissement depuis la droite)</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
