"use client";

import { useMemo, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
    Input,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { SubLabel } from "@/components/edu-homes/_shared";

type Template = {
    id: string;
    name: string;
    category: string;
    body: string;
    isActive: boolean;
    autoTrigger?: string;
    history?: { sent: number; readRate: number; conversionRate: number };
};

const TEMPLATES: Template[] = [
    {
        id: "bulletin-ready",
        name: "Bulletin disponible",
        category: "Pédagogie",
        body: "Bonjour {parent.prenom}, le bulletin de {eleve.prenom} ({eleve.classe}) pour {periode} est disponible sur EduPilot : {lien.bulletin} — {ecole.nom}.",
        isActive: true,
        autoTrigger: "Auto-déclenché à la clôture du conseil",
        history: { sent: 312, readRate: 96, conversionRate: 78 },
    },
    {
        id: "council-invite",
        name: "Conseil de classe",
        category: "Pédagogie",
        body: "Conseil de classe de {eleve.classe} prévu le {conseil.date} à {conseil.heure}. Présence souhaitée — {ecole.nom}.",
        isActive: true,
        history: { sent: 84, readRate: 91, conversionRate: 52 },
    },
    {
        id: "brevet-convocation",
        name: "Convocation Brevet",
        category: "Pédagogie",
        body: "Convocation BEPC {bepc.session} : {eleve.prenom} {eleve.nom} · centre {bepc.centre} · {bepc.date}. Pièce d'identité obligatoire.",
        isActive: true,
        history: { sent: 26, readRate: 100, conversionRate: 100 },
    },
    {
        id: "school-trip",
        name: "Sortie pédagogique",
        category: "Pédagogie",
        body: "Sortie pédagogique {sortie.lieu} le {sortie.date}. Autorisation parentale à signer avant {sortie.deadline}.",
        isActive: true,
        history: { sent: 142, readRate: 88, conversionRate: 71 },
    },
    {
        id: "absence-unjustified",
        name: "Absence non justifiée",
        category: "Vie scolaire",
        body: "Bonjour {parent.prenom}, {eleve.prenom} était absent(e) le {absence.date}. Merci de justifier sous 48h — {ecole.nom}.",
        isActive: true,
        autoTrigger: "Auto-déclenché 24h après une absence non justifiée",
        history: { sent: 410, readRate: 93, conversionRate: 84 },
    },
    {
        id: "late-repeat",
        name: "Retards répétés",
        category: "Vie scolaire",
        body: "Bonjour {parent.prenom}, {eleve.prenom} cumule {retards.count} retards ce trimestre. Un entretien est conseillé — {ecole.nom}.",
        isActive: true,
        history: { sent: 67, readRate: 90, conversionRate: 41 },
    },
    {
        id: "medical-incident",
        name: "Incident médical",
        category: "Vie scolaire",
        body: "Bonjour {parent.prenom}, {eleve.prenom} a été pris(e) en charge à l'infirmerie ({incident.motif}). Aucun antidouleur administré sans votre accord. — {ecole.nom}.",
        isActive: true,
        history: { sent: 38, readRate: 99, conversionRate: 95 },
    },
    {
        id: "fee-reminder-t2",
        name: "Rappel échéance T2",
        category: "Finance",
        body: "Bonjour {parent.prenom}, le paiement de scolarité de {eleve.prenom} arrive à échéance le {echeance.date} ({montant} FCFA). Payez en ligne : {lien.paiement} — {ecole.nom}.",
        isActive: true,
        autoTrigger: "Auto-déclenché 7j avant échéance",
        history: { sent: 287, readRate: 94, conversionRate: 38 },
    },
    {
        id: "fee-confirm",
        name: "Confirmation paiement",
        category: "Finance",
        body: "Paiement reçu pour {eleve.prenom} : {montant} FCFA. Reçu n° {paiement.recu}. Merci ! — {ecole.nom}.",
        isActive: true,
        autoTrigger: "Auto-déclenché à la réception d'un paiement",
        history: { sent: 421, readRate: 98, conversionRate: 100 },
    },
    {
        id: "fee-plan",
        name: "Échéancier proposé",
        category: "Finance",
        body: "Bonjour {parent.prenom}, un échéancier en {plan.tranches} tranches est proposé pour {eleve.prenom}. Détail : {lien.echeancier} — {ecole.nom}.",
        isActive: false,
        history: { sent: 12, readRate: 100, conversionRate: 67 },
    },
    {
        id: "enrollment-confirmed",
        name: "Inscription validée",
        category: "Administration",
        body: "Bonjour {parent.prenom}, l'inscription de {eleve.prenom} en {eleve.classe} pour {annee.scolaire} est validée. Bienvenue à {ecole.nom} !",
        isActive: true,
        history: { sent: 95, readRate: 99, conversionRate: 100 },
    },
    {
        id: "missing-documents",
        name: "Documents manquants",
        category: "Administration",
        body: "Bonjour {parent.prenom}, des pièces sont manquantes au dossier de {eleve.prenom} : {documents.liste}. Merci de les fournir avant {deadline}.",
        isActive: true,
        history: { sent: 41, readRate: 90, conversionRate: 73 },
    },
];

const VARIABLES = [
    "{parent.prenom}",
    "{eleve.prenom}",
    "{eleve.nom}",
    "{eleve.classe}",
    "{montant}",
    "{echeance.date}",
    "{periode}",
    "{conseil.date}",
    "{absence.date}",
    "{ecole.nom}",
    "{lien.paiement}",
    "{lien.bulletin}",
];

const CATEGORIES = ["Pédagogie", "Vie scolaire", "Finance", "Administration"];

function interpolatePreview(body: string): string {
    return body
        .replaceAll("{parent.prenom}", "Patrick")
        .replaceAll("{eleve.prenom}", "Aïcha")
        .replaceAll("{eleve.nom}", "Hounsou")
        .replaceAll("{eleve.classe}", "3ᵉ A")
        .replaceAll("{montant}", "125 000")
        .replaceAll("{echeance.date}", "11 mai")
        .replaceAll("{periode}", "T2 2025-2026")
        .replaceAll("{conseil.date}", "jeudi 14h")
        .replaceAll("{conseil.heure}", "16h00")
        .replaceAll("{absence.date}", "lundi matin")
        .replaceAll("{ecole.nom}", "CBE")
        .replaceAll("{lien.paiement}", "edupilot.bj/p/A0142")
        .replaceAll("{lien.bulletin}", "edupilot.bj/b/A0142-T2")
        .replaceAll("{lien.echeancier}", "edupilot.bj/e/A0142")
        .replaceAll("{paiement.recu}", "FLW-882104")
        .replaceAll("{bepc.session}", "juin 2026")
        .replaceAll("{bepc.centre}", "LycéeC")
        .replaceAll("{bepc.date}", "12 juin")
        .replaceAll("{sortie.lieu}", "Ouidah")
        .replaceAll("{sortie.date}", "16 mai")
        .replaceAll("{sortie.deadline}", "14 mai")
        .replaceAll("{retards.count}", "4")
        .replaceAll("{incident.motif}", "mal de tête")
        .replaceAll("{annee.scolaire}", "2026-2027")
        .replaceAll("{plan.tranches}", "3")
        .replaceAll("{documents.liste}", "acte de naissance, photo")
        .replaceAll("{deadline}", "vendredi");
}

export default function TemplatesPage() {
    const [activeId, setActiveId] = useState<string>(TEMPLATES[0].id);
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<string | null>(null);

    const active = useMemo(
        () => TEMPLATES.find((t) => t.id === activeId) ?? TEMPLATES[0],
        [activeId]
    );

    const currentBody = draft ?? active.body;
    const charCount = currentBody.length;
    const segCount = Math.ceil(charCount / 160);
    const preview = useMemo(
        () => interpolatePreview(currentBody),
        [currentBody]
    );

    const grouped = useMemo(() => {
        const filteredItems = TEMPLATES.filter((t) =>
            t.name.toLowerCase().includes(search.toLowerCase())
        );
        return CATEGORIES.map((cat) => ({
            category: cat,
            items: filteredItems.filter((t) => t.category === cat),
        }));
    }, [search]);

    const switchTemplate = (id: string) => {
        setActiveId(id);
        setDraft(null);
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}
        >
            <PageShell className="eduflow-scope pb-12">
                <PageHeader
                    title="Modèles de communication"
                    description="Email · SMS · WhatsApp — pré-écrits, personnalisés par l'IA"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Communication" },
                        { label: "Modèles" },
                    ]}
                    actions={
                        <Button icon="plus" disabled>
                            Nouveau modèle
                        </Button>
                    }
                />

                <Card padding={14} style={{ background: "var(--brand-50)", border: "1px solid var(--brand-200)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Icon name="info" size={16} color="var(--brand-700)" style={{ marginTop: 2 }} />
                        <div style={{ fontSize: 12, color: "var(--brand-800)", lineHeight: 1.55 }}>
                            Catalogue prêt à l'emploi · 12 modèles couvrant Pédagogie / Vie scolaire / Finance / Administration. La persistance des modifications arrivera avec le modèle <code>NotificationTemplate</code> côté Prisma.
                        </div>
                    </div>
                </Card>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "320px 1fr",
                        gap: 14,
                        minHeight: 600,
                    }}
                    className="tpl-grid"
                >
                    {/* Catalog */}
                    <Card padding={0} style={{ display: "flex", flexDirection: "column" }}>
                        <div
                            style={{
                                padding: 14,
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <Input
                                icon="search"
                                placeholder="Rechercher un modèle…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div style={{ overflowY: "auto" }}>
                            {grouped.map((cat) => (
                                <div key={cat.category}>
                                    <div
                                        style={{
                                            padding: "10px 14px",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: "0.08em",
                                            textTransform: "uppercase",
                                            color: "var(--eduflow-text-tertiary)",
                                            background: "var(--eduflow-surface-sunken)",
                                        }}
                                    >
                                        {cat.category}
                                    </div>
                                    {cat.items.length === 0 ? (
                                        <div
                                            style={{
                                                padding: "10px 14px",
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            Aucun modèle.
                                        </div>
                                    ) : (
                                        cat.items.map((it) => {
                                            const isActive = it.id === activeId;
                                            return (
                                                <button
                                                    key={it.id}
                                                    type="button"
                                                    onClick={() => switchTemplate(it.id)}
                                                    style={{
                                                        padding: "10px 14px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        width: "100%",
                                                        background: isActive
                                                            ? "var(--brand-50)"
                                                            : "transparent",
                                                        borderLeft: isActive
                                                            ? "3px solid var(--brand-700)"
                                                            : "3px solid transparent",
                                                        border: 0,
                                                        borderRight: 0,
                                                        borderTop: 0,
                                                        borderBottom: 0,
                                                        cursor: "pointer",
                                                        fontFamily: "inherit",
                                                        textAlign: "left",
                                                    }}
                                                >
                                                    <Icon
                                                        name="sms"
                                                        size={14}
                                                        color={
                                                            isActive
                                                                ? "var(--brand-700)"
                                                                : "var(--eduflow-text-tertiary)"
                                                        }
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: isActive ? 700 : 500,
                                                            color: isActive
                                                                ? "var(--brand-800)"
                                                                : "var(--eduflow-text-primary)",
                                                            flex: 1,
                                                            minWidth: 0,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {it.name}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Editor */}
                    <Card
                        padding={0}
                        style={{ display: "flex", flexDirection: "column" }}
                    >
                        <div
                            style={{
                                padding: "14px 20px",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 8,
                            }}
                        >
                            <div>
                                <h3
                                    className="eduflow-display"
                                    style={{ fontSize: 16, margin: 0 }}
                                >
                                    {active.name}
                                </h3>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 2,
                                    }}
                                >
                                    Multi-canaux ·{" "}
                                    {active.autoTrigger ??
                                        "Déclenché manuellement"}
                                </div>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 6,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <Badge
                                    variant={active.isActive ? "success" : "neutral"}
                                    size="sm"
                                    dot
                                >
                                    {active.isActive ? "Actif" : "Inactif"}
                                </Badge>
                                <Button variant="ghost" size="sm" icon="sparkle" disabled>
                                    Reformuler (IA)
                                </Button>
                                <Button size="sm" icon="check" disabled>
                                    Enregistrer
                                </Button>
                            </div>
                        </div>
                        <div
                            style={{
                                padding: 20,
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 16,
                                flex: 1,
                            }}
                            className="tpl-edit"
                        >
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div>
                                    <SubLabel>SMS · 160 caractères par segment</SubLabel>
                                    <textarea
                                        value={currentBody}
                                        onChange={(e) => setDraft(e.target.value)}
                                        rows={6}
                                        style={{
                                            width: "100%",
                                            padding: 14,
                                            background:
                                                "var(--eduflow-surface-sunken)",
                                            borderRadius: 12,
                                            fontSize: 13,
                                            lineHeight: 1.55,
                                            marginTop: 8,
                                            fontFamily:
                                                "var(--font-body, Inter), system-ui, sans-serif",
                                            color: "var(--eduflow-text-primary)",
                                            border: "1px solid var(--eduflow-border-subtle)",
                                            resize: "vertical",
                                        }}
                                    />
                                    <div
                                        style={{
                                            marginTop: 10,
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <span>
                                            {charCount} caractères · {segCount} SMS
                                        </span>
                                        {draft !== null ? (
                                            <button
                                                type="button"
                                                onClick={() => setDraft(null)}
                                                style={{
                                                    border: 0,
                                                    background: "transparent",
                                                    color: "var(--brand-700)",
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                }}
                                            >
                                                Restaurer l'original
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                <div>
                                    <SubLabel>Variables disponibles</SubLabel>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexWrap: "wrap",
                                            gap: 6,
                                            marginTop: 6,
                                        }}
                                    >
                                        {VARIABLES.map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => {
                                                    setDraft(
                                                        (currentBody || "") + " " + v
                                                    );
                                                }}
                                                style={{
                                                    fontSize: 10,
                                                    padding: "3px 8px",
                                                    borderRadius: 6,
                                                    background: "var(--brand-50)",
                                                    color: "var(--brand-800)",
                                                    border:
                                                        "1px solid var(--brand-200)",
                                                    fontFamily:
                                                        "var(--font-mono, ui-monospace, monospace)",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <div>
                                    <SubLabel>Aperçu · téléphone parent</SubLabel>
                                    <div
                                        style={{
                                            marginTop: 8,
                                            padding: 16,
                                            background: "var(--eduflow-neutral-900, #0F172A)",
                                            borderRadius: 22,
                                            position: "relative",
                                        }}
                                    >
                                        <div
                                            style={{
                                                background: "#fff",
                                                borderRadius: 14,
                                                padding: 14,
                                                fontSize: 13,
                                                lineHeight: 1.55,
                                                color: "#0F172A",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "var(--eduflow-text-tertiary)",
                                                    marginBottom: 6,
                                                }}
                                            >
                                                CBE · à l'instant
                                            </div>
                                            {preview}
                                        </div>
                                    </div>
                                </div>
                                {active.history ? (
                                    <div
                                        style={{
                                            padding: 14,
                                            background: "var(--eduflow-success-50)",
                                            borderRadius: 10,
                                            fontSize: 12,
                                            color: "var(--eduflow-success-800)",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        <strong>Performance historique</strong>
                                        <br />
                                        Envoyé {active.history.sent} fois · {active.history.readRate}% lus, {active.history.conversionRate}% de conversion dans les 48h.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </Card>
                </div>
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .tpl-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .tpl-edit {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
