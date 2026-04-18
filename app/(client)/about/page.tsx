export const metadata = {
  title: 'À Propos — Maison Dorée',
  description:
    "Découvrez l'histoire, la mission et les valeurs de Maison Dorée, votre pâtisserie marocaine en ligne.",
}

const values = [
  {
    icon: '🌾',
    title: 'Qualité',
    description: 'Ingrédients premium sélectionnés avec soin et recettes authentiques transmises de génération en génération.',
  },
  {
    icon: '🤝',
    title: 'Respect',
    description: 'Respect de nos clients, de nos artisans et des traditions culinaires marocaines millénaires.',
  },
  {
    icon: '🚀',
    title: 'Innovation',
    description: 'Technologies modernes pour vous offrir une expérience de commande fluide et une livraison en temps réel.',
  },
] as const

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            À Propos de Maison Dorée
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            L&apos;art de la pâtisserie marocaine à votre porte, avec la
            chaleur et l&apos;authenticité d&apos;un savoir-faire traditionnel.
          </p>
        </div>

        <div className="space-y-10">
          {/* Histoire */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-amber-900 mb-4">
              Notre Histoire
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Maison Dorée est née de la passion pour les pâtisseries marocaines
              traditionnelles. Fondée à Marrakech, notre maison perpétue
              l&apos;art millénaire de la pâtisserie marocaine avec les
              meilleurs ingrédients soigneusement sélectionnés auprès de
              producteurs locaux.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Chaque gâteau, chaque briouate et chaque cornet de chebakia est
              préparé à la main par nos artisans passionnés, dans le respect
              des recettes ancestrales transmises de génération en génération.
            </p>
          </section>

          {/* Mission */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-amber-900 mb-4">
              Notre Mission
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Partager l&apos;authenticité et la qualité des délices marocains
              avec chaque client, où qu&apos;il se trouve à Marrakech. Nous
              croyons que la pâtisserie est un vecteur de joie, de partage et
              de culture.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Notre plateforme en ligne vous permet de commander facilement vos
              douceurs préférées et de les recevoir fraîches, directement chez
              vous, grâce à notre réseau de livraison de proximité.
            </p>
          </section>

          {/* Valeurs */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-amber-900 mb-8">
              Nos Valeurs
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {values.map((v) => (
                <div key={v.title} className="text-center">
                  <div
                    className="text-4xl mb-3"
                    role="img"
                    aria-label={v.title}
                  >
                    {v.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {v.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {v.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="text-center pt-4">
            <a
              href="/shop"
              className="inline-block bg-amber-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              Découvrir nos produits
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
