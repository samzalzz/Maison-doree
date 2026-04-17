import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata = {
  title: "S'inscrire — Maison Dorée",
  description: 'Créez votre compte Maison Dorée',
}

export default function RegisterPage() {
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
          Créer un compte
        </h2>

        <RegisterForm />

        <p className="text-center mt-6 text-sm text-gray-600">
          Vous avez déjà un compte?{' '}
          <Link
            href="/login"
            className="text-primary font-semibold hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
