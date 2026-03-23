import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Politique de confidentialité — EduPilot",
    description: "Comment EduPilot collecte, utilise et protège vos données personnelles.",
};

export default function PrivacyPage() {
    const lastUpdated = "26 février 2026";
    const contactEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "privacy@edupilot.app";
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "EduPilot";

    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
                <div className="mb-8">
                    <Link href="/login" className="text-orange-500 hover:text-orange-600 text-sm">
                        ← Retour à la connexion
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">Politique de confidentialité</h1>
                <p className="text-gray-500 text-sm mb-8">Dernière mise à jour : {lastUpdated}</p>

                <div className="prose prose-gray max-w-none space-y-6 text-gray-700">

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Responsable du traitement</h2>
                        <p>
                            <strong>{appName}</strong> est un logiciel de gestion scolaire édité et opéré par son équipe fondatrice.
                            Pour toute question relative à vos données personnelles, contactez-nous à{" "}
                            <a href={`mailto:${contactEmail}`} className="text-orange-500">{contactEmail}</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Données collectées</h2>
                        <p>Dans le cadre de l&apos;utilisation de {appName}, nous collectons les données suivantes :</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li><strong>Données d&apos;identification :</strong> nom, prénom, adresse email, numéro de téléphone</li>
                            <li><strong>Données académiques :</strong> notes, bulletins, présences, emploi du temps (élèves)</li>
                            <li><strong>Données financières :</strong> paiements de frais scolaires (montant, date, méthode)</li>
                            <li><strong>Données de santé :</strong> groupe sanguin, antécédents médicaux (dossiers élèves, optionnel)</li>
                            <li><strong>Données de connexion :</strong> adresse IP, horodatage des connexions, logs d&apos;audit</li>
                            <li><strong>Communications :</strong> messages internes envoyés via la plateforme</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Finalités du traitement</h2>
                        <p>Vos données sont utilisées pour :</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Gérer les inscriptions et dossiers scolaires</li>
                            <li>Communiquer entre établissements, enseignants, élèves et parents</li>
                            <li>Suivre les performances académiques et générer les bulletins</li>
                            <li>Assurer la gestion financière de l&apos;établissement</li>
                            <li>Garantir la sécurité de la plateforme (lutte contre la fraude, audit)</li>
                            <li>Respecter les obligations légales applicables</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Base légale</h2>
                        <p>
                            Les traitements sont fondés sur l&apos;exécution du contrat de service (Article 6(1)(b) RGPD),
                            l&apos;intérêt légitime de la gestion scolaire (Article 6(1)(f) RGPD), et le consentement
                            pour les données de santé (Article 9(2)(a) RGPD).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Destinataires</h2>
                        <p>
                            Vos données ne sont pas vendues à des tiers. Elles sont accessibles uniquement au personnel
                            autorisé de l&apos;établissement scolaire concerné, selon leurs rôles respectifs (directeur,
                            comptable, enseignant, etc.).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Durée de conservation</h2>
                        <p>
                            Les données sont conservées pendant la durée de la relation contractuelle avec l&apos;établissement,
                            puis archivées pour une durée maximale de <strong>5 ans</strong> après la désactivation du compte,
                            conformément aux obligations légales. Les données médicales sont soumises à une politique de
                            rétention spécifique configurable par établissement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Vos droits (RGPD)</h2>
                        <p>Conformément au Règlement Général sur la Protection des Données, vous disposez des droits suivants :</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li><strong>Droit d&apos;accès</strong> (Art. 15) : obtenir une copie de vos données</li>
                            <li><strong>Droit de rectification</strong> (Art. 16) : corriger des données inexactes</li>
                            <li><strong>Droit à l&apos;effacement</strong> (Art. 17) : demander la suppression de vos données</li>
                            <li><strong>Droit à la portabilité</strong> (Art. 20) : recevoir vos données dans un format structuré</li>
                            <li><strong>Droit d&apos;opposition</strong> (Art. 21) : vous opposer à certains traitements</li>
                        </ul>
                        <p className="mt-3">
                            Pour exercer ces droits, contactez-nous à{" "}
                            <a href={`mailto:${contactEmail}`} className="text-orange-500">{contactEmail}</a>{" "}
                            ou via le tableau de bord dans la section <em>Paramètres → Confidentialité</em>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Sécurité</h2>
                        <p>
                            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées :
                            chiffrement des mots de passe (bcrypt), chiffrement des secrets 2FA (AES-256-GCM),
                            journalisation des accès, contrôle d&apos;accès basé sur les rôles, et isolation
                            des données par établissement.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Cookies</h2>
                        <p>
                            {appName} utilise uniquement des cookies de session nécessaires au fonctionnement
                            de l&apos;authentification. Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Contact et réclamations</h2>
                        <p>
                            Pour toute réclamation, vous pouvez également saisir l&apos;autorité de protection des données
                            compétente dans votre pays (en France : la CNIL, <a href="https://www.cnil.fr" className="text-orange-500" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
                        </p>
                    </section>
                </div>

                <div className="mt-10 pt-6 border-t text-sm text-gray-400 flex gap-4">
                    <Link href="/terms" className="hover:text-gray-600">Conditions d&apos;utilisation</Link>
                    <Link href="/login" className="hover:text-gray-600">Connexion</Link>
                </div>
            </div>
        </main>
    );
}
