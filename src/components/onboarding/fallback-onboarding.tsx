"use client";

import { RoleOnboardShell, ShortcutCard } from "./shell";
import type { IconName } from "@/components/edu/icon";

type Shortcut = { href: string; icon: IconName; title: string; body: string };
type Guide = { heroSub: string; steps: string[]; shortcuts: Shortcut[] };

/**
 * Visite de départ des rôles d'établissement sans parcours dédié (direction,
 * administration, comptable, personnel, responsable de réseau). Chaque
 * raccourci mène à un écran que le rôle peut réellement ouvrir : la version
 * précédente proposait à tous les rôles des écrans d'administration (année
 * académique, import, frais) qui renvoyaient un refus au comptable et au
 * personnel, et annonçait un parcours détaillé « qui arrive bientôt ».
 */
const DIRECTION: Guide = {
    heroSub: "Voici les étapes pour mettre l'établissement en route.",
    steps: ["Configurer l'année académique", "Importer les élèves", "Constituer l'équipe", "Définir les frais"],
    shortcuts: [
        { href: "/dashboard/settings/academic-config", icon: "settings", title: "Configurer l'année académique", body: "Trimestres ou semestres, périodes, vacances." },
        { href: "/dashboard/import", icon: "users", title: "Importer les élèves", body: "Fichier CSV ou Excel, contrôle des doublons avant import." },
        { href: "/dashboard/teachers", icon: "users", title: "Constituer l'équipe enseignante", body: "Créer les comptes, attribuer classes et matières, inviter un enseignant d'une autre école." },
        { href: "/dashboard/finance/fees", icon: "money", title: "Définir les frais de scolarité", body: "Frais par niveau, échéanciers, paiement en ligne." },
    ],
};

const GUIDES: Record<string, Guide> = {
    SCHOOL_ADMIN: DIRECTION,
    DIRECTOR: DIRECTION,
    NETWORK_ADMIN: DIRECTION,
    ACCOUNTANT: {
        heroSub: "Voici les écrans de la caisse et du suivi des paiements.",
        steps: ["Vérifier les frais", "Encaisser au guichet", "Rapprocher les paiements", "Envoyer les avis de paiement"],
        shortcuts: [
            { href: "/dashboard/finance/fees", icon: "money", title: "Frais de scolarité", body: "Montants par niveau et échéanciers." },
            { href: "/dashboard/finance/payments/new", icon: "money", title: "Encaisser un paiement", body: "Espèces, Mobile Money, virement : reçu immédiat, reste à payer à jour." },
            { href: "/dashboard/finance/reconciliation", icon: "check", title: "Rapprochement", body: "Valider les paiements déclarés et interroger le fournisseur en ligne." },
            { href: "/dashboard/finance/bulk-invoice", icon: "download", title: "Avis de paiement", body: "Avis par classe ou par niveau, à remettre aux familles." },
        ],
    },
    STAFF: {
        heroSub: "Voici les écrans de la vie scolaire.",
        steps: ["Faire l'appel", "Signaler un incident", "Consulter les élèves", "Lire les annonces"],
        shortcuts: [
            { href: "/dashboard/attendance", icon: "check", title: "Faire l'appel", body: "Présences, retards et absences par classe." },
            { href: "/dashboard/incidents/new", icon: "warning", title: "Signaler un incident", body: "Type, gravité et description ; la direction assure le suivi." },
            { href: "/dashboard/students", icon: "users", title: "Consulter les élèves", body: "Fiche, présences et discipline de chaque élève." },
            { href: "/dashboard/announcements", icon: "bell", title: "Annonces", body: "Les informations publiées par l'établissement." },
        ],
    },
};

export function FallbackOnboarding({ role, user }: { role: string; user: string }) {
    const guide = GUIDES[role] ?? {
        heroSub: "Voici les écrans clés pour démarrer.",
        steps: ["Découvrir le tableau de bord"],
        shortcuts: [{ href: "/dashboard", icon: "home" as IconName, title: "Tableau de bord", body: "Vos raccourcis et vos alertes." }],
    };
    return (
        <RoleOnboardShell
            role={role}
            color="brand"
            user={user}
            heroTitle="Bienvenue dans EduPilot."
            heroSub={guide.heroSub}
            steps={guide.steps}
            currentStep={1}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {guide.shortcuts.map((s) => (
                    <ShortcutCard key={s.href} href={s.href} icon={s.icon} title={s.title} body={s.body} />
                ))}
            </div>
        </RoleOnboardShell>
    );
}
