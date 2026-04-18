export const metadata = {
  title: 'Conditions Générales — Maison Dorée',
  description:
    "Consultez les conditions générales d'utilisation et de vente de Maison Dorée.",
}

export default function TermsPage() {
  const lastUpdated = new Date('2026-04-18').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Conditions Générales
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Acceptation des Conditions
            </h2>
            <p className="mb-3">
              En accédant au site Maison Dorée ou en passant une commande, vous
              acceptez pleinement et sans réserve les présentes conditions
              générales de vente et d&apos;utilisation.
            </p>
            <p>
              Si vous n&apos;acceptez pas ces conditions, nous vous invitons à
              ne pas utiliser notre service. Maison Dorée se réserve le droit
              de modifier ces conditions à tout moment ; les modifications
              prennent effet dès leur publication.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Produits et Services
            </h2>
            <p className="mb-3">
              Tous nos produits sont fabriqués artisanalement et soumis à
              disponibilité. Nous nous réservons le droit de :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Modifier ou retirer des produits du catalogue sans préavis</li>
              <li>Refuser ou annuler une commande en cas de rupture de stock</li>
              <li>
                Ajuster les quantités commandées si le stock est insuffisant
              </li>
              <li>
                Limiter les quantités par commande pour les articles en édition
                limitée
              </li>
            </ul>
            <p className="mt-3">
              Les photos des produits sont présentées à titre illustratif ;
              l&apos;apparence exacte peut légèrement varier.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Paiement et Livraison
            </h2>
            <p className="mb-3">
              Les prix sont affichés en Dirhams marocains (MAD) toutes taxes
              comprises. Nous proposons deux modes de paiement :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Paiement en ligne :</strong> carte bancaire via
                Stripe, sécurisé et chiffré
              </li>
              <li>
                <strong>Paiement à la livraison :</strong> en espèces au
                moment de la réception
              </li>
            </ul>
            <p className="mt-3">
              La livraison est effectuée dans les zones desservies par nos
              chauffeurs. Les délais indicatifs sont communiqués lors de la
              commande.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Limitation de Responsabilité
            </h2>
            <p className="mb-3">
              Maison Dorée s&apos;engage à fournir des produits de qualité et
              un service fiable. Toutefois, notre responsabilité est limitée :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Nous ne pouvons être tenus responsables de retards dus à des
                événements de force majeure
              </li>
              <li>
                Les dommages indirects ou consécutifs sont exclus de notre
                responsabilité
              </li>
              <li>
                Notre responsabilité maximale est limitée au montant de la
                commande concernée
              </li>
            </ul>
            <p className="mt-3">
              En cas de problème avec votre commande, contactez notre service
              client dans les 24 heures suivant la livraison.
            </p>
          </section>

          <section className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Dernière mise à jour : {lastUpdated}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
