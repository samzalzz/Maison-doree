import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisteredBanner } from '@/components/auth/RegisteredBanner'

export const metadata = {
  title: 'Se connecter — Maison Dorée',
  description: 'Connectez-vous à votre compte Maison Dorée',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary tracking-tight">
            Maison Dorée
          </h1>
          <p className="text-secondary text-sm mt-1 font-medium">
            Pâtisseries artisanales marocaines
          </p>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Se connecter
        </h2>

        {/* Show success banner when redirected after registration */}
        <Suspense>
          <RegisteredBanner />
        </Suspense>

        <LoginForm />

        <p className="text-center mt-6 text-sm text-gray-600">
          Pas encore de compte?{' '}
          <Link
            href="/register"
            className="text-primary font-semibold hover:underline"
          >
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}
