import type { Metadata } from "next";
import { LegalLayout } from "@/components/layout/legal-layout";

export const metadata: Metadata = {
    title: "Politique de confidentialité — EduPilot",
    description:
        "Politique de confidentialité d'EduPilot : collecte, traitement et protection des données personnelles, conformément au RGPD.",
};

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "EduPilot";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "privacy@edupilot.app";

const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--eduflow-text-primary)",
    marginBottom: 12,
};

const listStyle: React.CSSProperties = {
    paddingLeft: 20,
    margin: "8px 0 0",
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

const linkStyle: React.CSSProperties = {
    color: "var(--brand-700)",
    textDecoration: "underline",
};

export default function PrivacyPage() {
    return (
        <LegalLayout
            title="Politique de confidentialité"
            lastUpdated="26 février 2026"
            otherLink={{ href: "/terms", label: "Conditions d'utilisation" }}
        >
            <section>
                <h2 style={sectionTitleStyle}>1. Préambule</h2>
                <p>
                    {APP_NAME} est une plateforme de gestion scolaire conçue pour les établissements éducatifs.
                    La présente politique décrit comment nous collectons, utilisons et protégeons vos données
                    personnelles, en conformité avec le Règlement Général sur la Protection des Données (RGPD —
                    Règlement UE 2016/679). Pour toute question, contactez-nous à{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>
                        {CONTACT_EMAIL}
                    </a>
                    .
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>2. Responsable du traitement</h2>
                <p>
                    Le responsable du traitement des données collectées via {APP_NAME} est l'établissement
                    scolaire abonné. {APP_NAME} agit en qualité de sous-traitant au sens de l'article 28 du
                    RGPD. Un Accord de Traitement des Données (DPA) est signé avec chaque établissement client.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>3. Données collectées</h2>
                <p>Nous collectons uniquement les données nécessaires au fonctionnement du service :</p>
                <ul style={listStyle}>
                    <li>
                        <strong>Données d'identification :</strong> nom, prénom, adresse e-mail, identifiant
                        utilisateur, mot de passe haché.
                    </li>
                    <li>
                        <strong>Données scolaires :</strong> classes, notes, présences, devoirs, bulletins,
                        incidents.
                    </li>
                    <li>
                        <strong>Données de connexion :</strong> adresse IP, journaux d'accès, type de
                        navigateur (anonymisés au-delà de 12 mois).
                    </li>
                    <li>
                        <strong>Données financières :</strong> frais scolaires, paiements, factures
                        (établissements et tuteurs uniquement).
                    </li>
                    <li>
                        <strong>Données de communication :</strong> messages internes, notifications,
                        annonces.
                    </li>
                </ul>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>4. Bases légales du traitement</h2>
                <p>Les traitements sont fondés sur :</p>
                <ul style={listStyle}>
                    <li>
                        <strong>Exécution du contrat :</strong> entre l'établissement et {APP_NAME} pour la
                        prestation du service.
                    </li>
                    <li>
                        <strong>Obligation légale :</strong> conservation des données de scolarité et de
                        facturation (Code de l'éducation, Code de commerce).
                    </li>
                    <li>
                        <strong>Intérêt légitime :</strong> sécurité du service, prévention de la fraude,
                        amélioration produit (statistiques anonymisées).
                    </li>
                    <li>
                        <strong>Consentement :</strong> communications marketing (opt-in explicite), cookies
                        non essentiels.
                    </li>
                </ul>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>5. Finalités</h2>
                <p>
                    Vos données sont utilisées pour gérer la scolarité (inscriptions, notes, présences),
                    communiquer avec les familles, produire des bulletins et bilans, assurer la facturation
                    des frais scolaires, garantir la sécurité du compte et améliorer le service.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>6. Durée de conservation</h2>
                <p>
                    Les données scolaires actives sont conservées pendant toute la durée de scolarité de
                    l'élève. À la sortie, les données académiques sont archivées pendant{" "}
                    <strong>5 ans</strong> (justificatifs administratifs), puis anonymisées. Les journaux
                    d'audit techniques sont conservés 12 mois. Les données de facturation sont conservées 10
                    ans (obligation comptable).
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>7. Vos droits (RGPD)</h2>
                <p>Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :</p>
                <ul style={listStyle}>
                    <li>
                        <strong>Accès :</strong> obtenir une copie des données vous concernant.
                    </li>
                    <li>
                        <strong>Rectification :</strong> corriger des données inexactes.
                    </li>
                    <li>
                        <strong>Effacement :</strong> demander la suppression dans la limite des obligations
                        légales de conservation.
                    </li>
                    <li>
                        <strong>Limitation :</strong> restreindre le traitement dans certains cas.
                    </li>
                    <li>
                        <strong>Portabilité :</strong> recevoir vos données dans un format structuré.
                    </li>
                    <li>
                        <strong>Opposition :</strong> vous opposer à un traitement fondé sur l'intérêt
                        légitime.
                    </li>
                </ul>
                <p style={{ marginTop: 12 }}>
                    Pour exercer ces droits, écrivez à{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>
                        {CONTACT_EMAIL}
                    </a>{" "}
                    ou utilisez le menu <em>Paramètres → Confidentialité</em> de votre compte.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>8. Sécurité</h2>
                <p>
                    Nous mettons en œuvre des mesures techniques et organisationnelles appropriées :
                    chiffrement TLS 1.3 en transit, chiffrement AES-256 au repos pour les données sensibles,
                    contrôle d'accès basé sur les rôles (RBAC), audit logs immuables, sauvegardes chiffrées
                    quotidiennes, tests d'intrusion annuels.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>9. Sous-traitants et transferts</h2>
                <p>
                    {APP_NAME} fait appel à des sous-traitants pour l'hébergement (UE), l'envoi d'e-mails
                    transactionnels et le paiement en ligne. Aucun transfert hors UE n'est effectué sans
                    garanties appropriées (clauses contractuelles types). La liste complète des
                    sous-traitants est disponible sur demande.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>10. Autorité de contrôle</h2>
                <p>
                    Vous avez le droit d'introduire une réclamation auprès d'une autorité de contrôle{" "}
                    (en France : la CNIL,{" "}
                    <a
                        href="https://www.cnil.fr"
                        style={linkStyle}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        www.cnil.fr
                    </a>
                    ) si vous estimez que le traitement de vos données ne respecte pas le RGPD.
                </p>
            </section>
        </LegalLayout>
    );
}
