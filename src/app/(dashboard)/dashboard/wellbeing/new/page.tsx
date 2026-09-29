"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { PageGuard } from "@/components/guard/page-guard";

import { Badge, Button, Card, Input } from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { allowedWellbeingTags, WELLBEING_DESK_ROLES } from "@/lib/wellbeing/report-tags";

const TAGS = [
    { value: "NOMINATIF", label: "Nominatif", hint: "Identité du déclarant visible par la cellule" },
    { value: "ANONYME", label: "Anonyme", hint: "Aucun lien avec votre compte n'est conservé" },
    { value: "PARENT", label: "Parent", hint: "Signalement déposé par une famille" },
    { value: "ENSEIGNANT", label: "Enseignant", hint: "Signal remonté par un membre de l'équipe" },
] as const;

const CATEGORIES = [
    "Harcèlement",
    "Anxiété scolaire",
    "Signal faible",
    "Protection enfance",
    "Décrochage",
    "Risque vital",
    "Autre",
] as const;

const SEVERITIES = [
    { value: "P0", label: "P0 · Urgent", hint: "Danger immédiat — traitement le jour même", variant: "danger" as const },
    { value: "P1", label: "P1 · Prioritaire", hint: "À traiter sous 72h", variant: "warning" as const },
    { value: "P2", label: "P2 · Suivi", hint: "Vigilance et observation", variant: "info" as const },
] as const;

export default function NewWellbeingReportPage() {
    return (
        // Élèves, parents et personnel déposent ; la direction (cellule) lit les dossiers.
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF", "PARENT", "STUDENT"]}>
            <NewWellbeingReportContent />
        </PageGuard>
    );
}

function NewWellbeingReportContent() {
    const router = useRouter();
    const { data: session } = useSession();
    const role = session?.user?.role ?? "";
    const isDesk = (WELLBEING_DESK_ROLES as readonly string[]).includes(role);
    const tags = TAGS.filter((t) => allowedWellbeingTags(role).includes(t.value));
    const [chosenTag, setTag] = React.useState<string | null>(null);
    const tag = chosenTag && tags.some((t) => t.value === chosenTag) ? chosenTag : (tags[0]?.value ?? "ANONYME");
    const [sent, setSent] = React.useState(false);
    const [category, setCategory] = React.useState<string>(CATEGORIES[0]);
    const [severity, setSeverity] = React.useState<string>("P1");
    const [excerpt, setExcerpt] = React.useState("");
    const [severityLabel, setSeverityLabel] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/wellbeing/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tag,
                    category,
                    severity,
                    excerpt,
                    severityLabel: severityLabel || undefined,
                    anonymous: tag === "ANONYME",
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error ?? "Erreur lors de la création du dossier.");
                return;
            }
            // Hors cellule d'écoute, le dossier n'est pas lisible : simple accusé de réception.
            if (isDesk) router.push(`/dashboard/wellbeing/${json.id}`);
            else setSent(true);
        } catch {
            setError("Erreur réseau. Réessayez.");
        } finally {
            setSubmitting(false);
        }
    }

    const fieldLabel: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 600,
        color: "var(--eduflow-text-tertiary)",
        marginBottom: 6,
        display: "block",
    };

    return (
        <PageShell className="max-w-3xl pb-12">
            <PageHeader
                title="Nouveau dossier · cellule d'écoute"
                description="Les dossiers ne sont lus que par la cellule d'écoute (direction). Un signalement anonyme ne garde aucun lien avec votre compte."
                breadcrumbs={[
                    { label: "Vie scolaire" },
                    { label: "Bien-être", href: "/dashboard/wellbeing" },
                    { label: "Nouveau dossier" },
                ]}
            />

            {sent ? (
                <Card padding={24}>
                    <div role="status" style={{ display: "grid", gap: 12 }}>
                        <strong>Signalement transmis à la cellule d&apos;écoute.</strong>
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            {tag === "ANONYME"
                                ? "Il est anonyme : personne ne peut remonter jusqu'à vous."
                                : "La cellule d'écoute peut revenir vers vous si besoin."}
                        </span>
                        <div>
                            <Button type="button" variant="secondary" onClick={() => router.push("/dashboard")}>
                                Retour à l&apos;accueil
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
            <form onSubmit={handleSubmit}>
                <Card padding={24}>
                    <SubLabel>Type de signalement</SubLabel>
                    <div
                        role="radiogroup"
                        aria-label="Type de signalement"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            marginTop: 10,
                            marginBottom: 20,
                        }}
                    >
                        {tags.map((t) => {
                            const active = tag === t.value;
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => setTag(t.value)}
                                    style={{
                                        textAlign: "left",
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: active
                                            ? "2px solid var(--brand-600)"
                                            : "1px solid var(--eduflow-border-default)",
                                        background: active
                                            ? "var(--brand-50)"
                                            : "var(--eduflow-surface-card)",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: active
                                                ? "var(--brand-800)"
                                                : "var(--eduflow-text-primary)",
                                        }}
                                    >
                                        {t.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 2,
                                        }}
                                    >
                                        {t.hint}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                        <div>
                            <label htmlFor="wb-category" style={fieldLabel}>
                                Catégorie *
                            </label>
                            <select
                                id="wb-category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                style={{
                                    width: "100%",
                                    height: 38,
                                    borderRadius: 10,
                                    border: "1px solid var(--eduflow-border-default)",
                                    background: "var(--eduflow-surface-card)",
                                    color: "var(--eduflow-text-primary)",
                                    padding: "0 10px",
                                    fontSize: 13,
                                    fontFamily: "inherit",
                                }}
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="wb-sevlabel" style={fieldLabel}>
                                Note de sévérité (optionnel)
                            </label>
                            <Input
                                id="wb-sevlabel"
                                value={severityLabel}
                                onChange={(e) => setSeverityLabel(e.target.value)}
                                placeholder="Ex : CPS prévenu"
                            />
                        </div>
                    </div>

                    <SubLabel>Niveau de priorité</SubLabel>
                    <div
                        role="radiogroup"
                        aria-label="Niveau de priorité"
                        style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 20 }}
                    >
                        {SEVERITIES.map((s) => {
                            const active = severity === s.value;
                            return (
                                <button
                                    key={s.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => setSeverity(s.value)}
                                    title={s.hint}
                                    style={{
                                        flex: 1,
                                        textAlign: "left",
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: active
                                            ? "2px solid var(--brand-600)"
                                            : "1px solid var(--eduflow-border-default)",
                                        background: active
                                            ? "var(--brand-50)"
                                            : "var(--eduflow-surface-card)",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <Badge variant={s.variant} size="sm" dot={s.value === "P0"}>
                                        {s.label}
                                    </Badge>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 6,
                                        }}
                                    >
                                        {s.hint}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label htmlFor="wb-excerpt" style={fieldLabel}>
                            Description du signalement *
                        </label>
                        <textarea
                            id="wb-excerpt"
                            value={excerpt}
                            onChange={(e) => setExcerpt(e.target.value)}
                            placeholder="Faits observés, contexte, paroles rapportées… (10 caractères minimum)"
                            required
                            minLength={10}
                            style={{
                                width: "100%",
                                minHeight: 110,
                                borderRadius: 10,
                                border: "1px solid var(--eduflow-border-default)",
                                background: "var(--eduflow-surface-card)",
                                color: "var(--eduflow-text-primary)",
                                padding: 10,
                                fontSize: 13,
                                fontFamily: "inherit",
                                lineHeight: 1.55,
                                resize: "vertical",
                            }}
                        />
                    </div>

                    {error ? (
                        <div role="alert" style={{ marginBottom: 14 }}>
                            <Badge variant="danger">{error}</Badge>
                        </div>
                    ) : null}

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push(isDesk ? "/dashboard/wellbeing" : "/dashboard")}
                        >
                            Annuler
                        </Button>
                        <Button type="submit" icon="plus" loading={submitting}>
                            {isDesk ? "Ouvrir le dossier" : "Envoyer le signalement"}
                        </Button>
                    </div>
                </Card>
            </form>
            )}
        </PageShell>
    );
}
