import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Conditions d'utilisation — EduPilot",
    description: "Conditions générales d'utilisation de la plateforme EduPilot.",
};

export default function TermsPage() {
    const lastUpdated = "26 février 2026";
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "EduPilot";
    const contactEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@edupilot.app";

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
                <div className="mb-8">
                    <Link href="/login" className="text-orange-500 hover:text-orange-600 text-sm">
                        ← Retour à la connexion
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditions d&apos;utilisation</h1>
                <p className="text-gray-500 text-sm mb-8">Dernière mise à jour : {lastUpdated}</p>

                <div className="prose prose-gray max-w-none space-y-6 text-gray-700">

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Objet</h2>
                        <p>
                            Les présentes conditions régissent l&apos;utilisation de la plateforme <strong>{appName}</strong>,
                            logiciel de gestion scolaire destiné aux établissements d&apos;enseignement. En accédant à
                            la plateforme, vous acceptez ces conditions dans leur intégralité.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Accès et comptes</h2>
                        <p>
                            L&apos;accès est réservé aux utilisateurs autorisés par l&apos;administrateur de l&apos;établissement.
                            Chaque utilisateur est responsable de la confidentialité de ses identifiants.
                            Tout accès non autorisé doit être signalé immédiatement à{" "}
                            <a href={`mailto:${contactEmail}`} className="text-orange-500">{contactEmail}</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Utilisation acceptable</h2>
                        <p>Il est interdit de :</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Accéder aux données d&apos;autres établissements ou utilisateurs sans autorisation</li>
                            <li>Utiliser la plateforme à des fins illégales ou frauduleuses</li>
                            <li>Tenter de contourner les mécanismes de sécurité</li>
                            <li>Publier des contenus offensants, discriminatoires ou illicites</li>
                            <li>Utiliser des robots ou scripts automatisés non autorisés</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Données et confidentialité</h2>
                        <p>
                            Le traitement des données personnelles est décrit dans notre{" "}
                            <Link href="/privacy" className="text-orange-500">Politique de confidentialité</Link>.
                            Les données scolaires restent la propriété de l&apos;établissement. {appName} agit en tant
                            que sous-traitant au sens du RGPD.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Disponibilité du service</h2>
                        <p>
                            Nous nous efforçons de maintenir la plateforme disponible 24h/24, 7j/7, mais ne
                            garantissons pas une disponibilité sans interruption. Des maintenances peuvent être
                            planifiées avec préavis.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Responsabilité</h2>
                        <p>
                            {appName} ne saurait être tenu responsable des dommages indirects résultant de
                            l&apos;utilisation de la plateforme. La responsabilité de l&apos;exactitude des données
                            saisies incombe aux utilisateurs et à l&apos;établissement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Propriété intellectuelle</h2>
                        <p>
                            La plateforme {appName}, son code source, ses interfaces et ses contenus sont protégés
                            par le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Modification des conditions</h2>
                        <p>
                            Nous nous réservons le droit de modifier ces conditions. Les utilisateurs seront notifiés
                            de tout changement significatif. La poursuite de l&apos;utilisation après notification vaut acceptation.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Droit applicable</h2>
                        <p>
                            Ces conditions sont soumises au droit applicable dans le pays d&apos;établissement de l&apos;opérateur.
                            Tout litige sera soumis aux juridictions compétentes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Contact</h2>
                        <p>
                            Pour toute question : <a href={`mailto:${contactEmail}`} className="text-orange-500">{contactEmail}</a>
                        </p>
                    </section>
                </div>

                <div className="mt-10 pt-6 border-t text-sm text-gray-400 flex gap-4">
                    <Link href="/privacy" className="hover:text-gray-600">Politique de confidentialité</Link>
                    <Link href="/login" className="hover:text-gray-600">Connexion</Link>
                </div>
            </div>
        </main>
    );
}
