'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LoginSchema, type LoginInput } from '@/lib/validators'

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear the error as soon as the user starts correcting their input
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Client-side validation before hitting the network
    const result = LoginSchema.safeParse(formData)
    if (!result.success) {
      const firstIssue = result.error.issues[0]?.message ?? 'Données invalides'
      setError(firstIssue)
      setLoading(false)
      return
    }

    const response = await signIn('credentials', {
      email: formData.email,
      password: formData.password,
      redirect: false,
    })

    if (!response?.ok) {
      setError(
        response?.error === 'CredentialsSignin'
          ? 'Email ou mot de passe incorrect'
          : response?.error ?? 'Erreur de connexion',
      )
      setLoading(false)
      return
    }

    router.push('/products')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Adresse email
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
          placeholder="vous@exemple.com"
          value={formData.email}
          onChange={handleChange}
          autoComplete="email"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>

      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Mot de passe
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Connexion en cours...' : 'Se connecter'}
      </button>
    </form>
  )
}
