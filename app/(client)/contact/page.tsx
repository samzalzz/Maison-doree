import { ContactForm } from '@/components/contact/ContactForm'

export const metadata = {
  title: 'Nous Contacter — Maison Dorée',
  description:
    "Contactez l'équipe Maison Dorée pour toute question, suggestion ou réclamation.",
}

const contactDetails = [
  {
    label: 'Adresse',
    value: 'Marrakech, Maroc\nQuartier Gueliz',
  },
  {
    label: 'Téléphone',
    value: '+212 (0)6 12 34 56 78',
  },
  {
    label: 'Email',
    value: 'contact@maisondoree.ma',
  },
  {
    label: 'Horaires',
    value: 'Lun – Ven : 9h00 – 18h00\nSam : 10h00 – 16h00\nDimanche : Fermé',
  },
] as const

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Nous Contacter
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Une question, une suggestion ou un problème ? Notre équipe est là
            pour vous aider et vous répondra dans les meilleurs délais.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Contact Details */}
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-gray-900">
              Informations de contact
            </h2>

            {contactDetails.map(({ label, value }) => (
              <div key={label}>
                <h3 className="font-semibold text-amber-900 mb-1">{label}</h3>
                <p className="text-gray-600 whitespace-pre-line">{value}</p>
              </div>
            ))}

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Commande urgente ?</strong> Appelez-nous directement
                au +212 (0)6 12 34 56 78 pour un traitement prioritaire.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Envoyez-nous un message
            </h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  )
}
