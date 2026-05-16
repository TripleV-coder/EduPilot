import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/components/layout/legal-layout";

export const metadata: Metadata = {
    title: "Conditions d'utilisation — EduPilot",
    description:
        "Conditions générales d'utilisation d'EduPilot : règles d'usage, responsabilités, propriété intellectuelle.",
};

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "EduPilot";
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@edupilot.app";

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

export default function TermsPage() {
    return (
        <LegalLayout
            title="Conditions d'utilisation"
            lastUpdated="26 février 2026"
            otherLink={{ href: "/privacy", label: "Politique de confidentialité" }}
        >
            <section>
                <h2 style={sectionTitleStyle}>1. Objet</h2>
                <p>
                    Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'usage
                    de la plateforme <strong>{APP_NAME}</strong>, service de gestion scolaire en ligne destiné
                    aux établissements éducatifs, à leur personnel, aux élèves et à leurs représentants
                    légaux.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>2. Acceptation</h2>
                <p>
                    L'utilisation de {APP_NAME} implique l'acceptation pleine et entière des présentes CGU.
                    Tout différend ou question peut être adressé à{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>
                        {CONTACT_EMAIL}
                    </a>
                    .
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>3. Conditions d'accès</h2>
                <p>Pour utiliser le service, l'utilisateur doit :</p>
                <ul style={listStyle}>
                    <li>Être rattaché à un établissement abonné à {APP_NAME}.</li>
                    <li>Disposer d'identifiants délivrés par son établissement.</li>
                    <li>Maintenir la confidentialité de son mot de passe.</li>
                    <li>Notifier immédiatement toute utilisation non autorisée de son compte.</li>
                </ul>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>4. Protection des données</h2>
                <p>
                    Le traitement des données personnelles est régi par notre{" "}
                    <Link href="/privacy" style={linkStyle}>
                        Politique de confidentialité
                    </Link>
                    , conforme au RGPD. L'établissement abonné est le responsable du traitement ;{" "}
                    {APP_NAME} agit en sous-traitant.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>5. Propriété intellectuelle</h2>
                <p>
                    L'ensemble des éléments composant {APP_NAME} (logiciel, interface, marques, logos,
                    contenus éditoriaux) est protégé par le Code de la propriété intellectuelle. Toute
                    reproduction, représentation ou exploitation, totale ou partielle, sans autorisation
                    écrite préalable est interdite.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>6. Disponibilité du service</h2>
                <p>
                    {APP_NAME} s'engage à garantir un taux de disponibilité de 99,5% mesuré sur une base
                    mensuelle (hors maintenances planifiées annoncées au moins 48h à l'avance). En cas
                    d'incident majeur, un statut public est tenu à jour.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>7. Responsabilités</h2>
                <p>
                    {APP_NAME} ne saurait être tenu responsable des dommages indirects résultant d'une
                    utilisation non conforme du service, d'une saisie erronée par un utilisateur ou d'une
                    indisponibilité due à un cas de force majeure. La responsabilité globale est plafonnée
                    aux montants effectivement versés par l'établissement sur les 12 derniers mois.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>8. Comportements interdits</h2>
                <p>
                    Sont strictement interdits : la tentative d'accès non autorisé à des comptes tiers, la
                    diffusion de contenus illicites, l'usage automatisé du service hors des API publiées,
                    toute action visant à perturber le fonctionnement du service.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>9. Résiliation</h2>
                <p>
                    {APP_NAME} se réserve le droit de suspendre ou de résilier l'accès d'un utilisateur en
                    cas de manquement grave aux présentes CGU, après notification préalable lorsque possible.
                    L'établissement client peut résilier son abonnement selon les modalités du contrat
                    commercial.
                </p>
            </section>

            <section>
                <h2 style={sectionTitleStyle}>10. Loi applicable et contact</h2>
                <p>
                    Les présentes CGU sont régies par le droit français. Tout litige relatif à leur
                    interprétation ou exécution relève de la compétence des tribunaux français. Pour toute
                    question, écrivez à{" "}
                    <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>
                        {CONTACT_EMAIL}
                    </a>
                    .
                </p>
            </section>
        </LegalLayout>
    );
}
