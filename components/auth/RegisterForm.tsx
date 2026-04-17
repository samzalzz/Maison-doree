'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RegisterSchema, type RegisterInput } from '@/lib/validators'

export function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<RegisterInput>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
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
    const result = RegisterSchema.safeParse(formData)
    if (!result.success) {
      const firstIssue = result.error.issues[0]?.message ?? 'Données invalides'
      setError(firstIssue)
      setLoading(false)
      return
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? "Erreur lors de l'inscription")
      setLoading(false)
      return
    }

    // Redirect to login with a success hint so the page can show a banner
    router.push('/login?registered=true')
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="register-firstName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Prénom
          </label>
          <input
            id="register-firstName"
            type="text"
            name="firstName"
            placeholder="Prénom"
            value={formData.firstName ?? ''}
            onChange={handleChange}
            autoComplete="given-name"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          />
        </div>

        <div>
          <label
            htmlFor="register-lastName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Nom
          </label>
          <input
            id="register-lastName"
            type="text"
            name="lastName"
            placeholder="Nom"
            value={formData.lastName ?? ''}
            onChange={handleChange}
            autoComplete="family-name"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="register-email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Adresse email
        </label>
        <input
          id="register-email"
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
          htmlFor="register-password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Mot de passe
        </label>
        <input
          id="register-password"
          type="password"
          name="password"
          placeholder="Minimum 6 caractères"
          value={formData.password}
          onChange={handleChange}
          autoComplete="new-password"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>

      <div>
        <label
          htmlFor="register-phone"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Téléphone{' '}
          <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          id="register-phone"
          type="tel"
          name="phone"
          placeholder="+212 6 00 00 00 00"
          value={formData.phone ?? ''}
          onChange={handleChange}
          autoComplete="tel"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Inscription en cours...' : "S'inscrire"}
      </button>
    </form>
  )
}
