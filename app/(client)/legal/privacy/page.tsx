export const metadata = {
  title: 'Politique de Confidentialité — Maison Dorée',
  description:
    'Découvrez comment Maison Dorée collecte, utilise et protège vos données personnelles.',
}

export default function PrivacyPage() {
  const lastUpdated = new Date('2026-04-18').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Politique de Confidentialité
        </h1>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Informations que nous collectons
            </h2>
            <p className="mb-3">
              Maison Dorée collecte les informations suivantes pour fournir nos
              services de pâtisserie en ligne :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Nom, adresse email et numéro de téléphone</li>
              <li>Adresse de livraison et de facturation</li>
              <li>Historique des commandes et préférences produits</li>
              <li>Préférences de notification et paramètres du compte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Utilisation de vos données
            </h2>
            <p className="mb-3">
              Vos données personnelles sont utilisées exclusivement pour :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Traiter et livrer vos commandes</li>
              <li>Envoyer des confirmations et notifications de suivi</li>
              <li>
                Gérer votre programme de fidélité et vos points accumulés
              </li>
              <li>
                Améliorer la qualité de nos produits et de notre service
              </li>
              <li>Respecter nos obligations légales et réglementaires</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Sécurité de vos données
            </h2>
            <p className="mb-3">
              Nous mettons en œuvre des mesures de sécurité strictes pour
              protéger vos informations personnelles :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Chiffrement SSL/TLS pour toutes les transmissions de données</li>
              <li>Mots de passe stockés sous forme hachée (bcrypt)</li>
              <li>Accès aux données limité au personnel autorisé uniquement</li>
              <li>Sauvegardes régulières et plan de reprise après incident</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Vos droits
            </h2>
            <p className="mb-3">
              Conformément à la réglementation applicable, vous disposez des
              droits suivants sur vos données personnelles :
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Droit d&apos;accès :</strong> consulter les données
                que nous détenons sur vous
              </li>
              <li>
                <strong>Droit de rectification :</strong> corriger des données
                inexactes ou incomplètes
              </li>
              <li>
                <strong>Droit à l&apos;effacement :</strong> demander la
                suppression de vos données
              </li>
              <li>
                <strong>Droit à la portabilité :</strong> recevoir vos données
                dans un format structuré
              </li>
            </ul>
            <p className="mt-4">
              Pour exercer ces droits, contactez-nous à{' '}
              <a
                href="mailto:privacy@maisondoree.ma"
                className="text-amber-600 hover:text-amber-700 underline"
              >
                privacy@maisondoree.ma
              </a>
              .
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
