"use client";

/**
 * Paramètres de l'établissement : seuils d'alerte, niveaux de performance,
 * délais, poids des analyses… Toutes les valeurs « métier » réglables, en un
 * seul écran construit à partir de la liste unique des paramètres
 * (src/lib/schools/school-parameters.ts). Même validation que le serveur
 * (bornes + cohérences) ; chaque changement est tracé côté serveur.
 */
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Button, Card, Icon, type IconName } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError } from "@/components/layout/page-states";
import {
    PARAMETER_SECTIONS,
    schoolParametersSchema,
    type ParameterInfo,
    type SchoolParameters,
} from "@/lib/schools/school-parameters";

interface ParametersResponse {
    parameters: SchoolParameters;
    defaults: SchoolParameters;
    canEdit: boolean;
}

type Values = Record<string, Record<string, number>>;

const SECTION_ICONS: Record<string, IconName> = {
    performance: "chart",
    followUp: "warning",
    earlyWarning: "bell",
    analysis: "sparkle",
    exams: "trophy",
    competences: "check",
    finance: "money",
    services: "clock",
};

const fr = (n: number) => String(n).replace(".", ",");

export default function SchoolParametersPage() {
    const { data, error, isLoading, mutate } = useSWR<ParametersResponse>("/api/config/parameters", fetcher);
    const [draft, setDraft] = useState<Values | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (data && !draft) setDraft(data.parameters as unknown as Values);
    }, [data, draft]);

    const canEdit = data?.canEdit ?? false;
    const dirty = useMemo(
        () => Boolean(data && draft && JSON.stringify(data.parameters) !== JSON.stringify(draft)),
        [data, draft],
    );

    // Même validation que le serveur (schéma partagé : bornes et cohérences)
    const validation = useMemo(() => {
        if (!draft) return null;
        const parsed = schoolParametersSchema.safeParse(draft);
        if (parsed.success) return null;
        const issue = parsed.error.issues[0];
        const section = PARAMETER_SECTIONS.find((s) => s.key === issue.path[0]);
        return section ? `${section.title} : ${issue.message}` : issue.message;
    }, [draft]);

    const setValue = (section: string, key: string, value: number) => {
        setSavedMessage(null);
        setDraft((d) => (d ? { ...d, [section]: { ...d[section], [key]: value } } : d));
    };

    async function save() {
        if (!draft || validation) return;
        setSaving(true);
        setSaveError(null);
        setSavedMessage(null);
        try {
            const res = await fetch("/api/config/parameters", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Enregistrement impossible");
            setDraft(body.parameters);
            await mutate();
            setSavedMessage(
                body.recalculation === "started"
                    ? "Paramètres enregistrés. Les niveaux de risque et de performance de l'année en cours sont en cours de recalcul."
                    : "Paramètres enregistrés.",
            );
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Enregistrement impossible");
        } finally {
            setSaving(false);
        }
    }

    const q = query.trim().toLowerCase();
    const matches = (info: ParameterInfo) =>
        !q || info.label.toLowerCase().includes(q) || (info.help ?? "").toLowerCase().includes(q);
    const visibleSections = PARAMETER_SECTIONS.map((section) => ({
        section,
        params: section.params.filter(matches),
    })).filter(({ section, params }) => params.length > 0 || section.title.toLowerCase().includes(q));

    return (
        <PageGuard roles={["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF"]}>
            <PageShell className="max-w-4xl pb-28">
                <PageHeader
                    title="Paramètres de l'établissement"
                    description="Seuils d'alerte, niveaux, délais et poids des analyses. Les valeurs par défaut sont celles d'origine ; chaque changement est enregistré dans le journal."
                    breadcrumbs={[{ label: "Paramètres", href: "/dashboard/settings" }, { label: "Paramètres de l'établissement" }]}
                />

                {error ? (
                    <PageError message="Impossible de charger les paramètres de l'établissement." onRetry={() => void mutate()} />
                ) : null}
                {!error && (isLoading || !draft) ? (
                    <Card padding={20}>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-text-secondary)" }}>Chargement des paramètres…</p>
                    </Card>
                ) : null}

                {draft && data ? (
                    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
                        {!canEdit ? <Notice>Lecture seule : seule la direction modifie ces paramètres.</Notice> : null}
                        <Notice>
                            Le seuil de passage se règle dans la configuration académique, le barème des mentions et les moyennes
                            d&apos;admission CEP / BEPC dans les règles de l&apos;établissement : ils ne sont pas dupliqués ici.
                        </Notice>

                        <label className="block">
                            <span className="sr-only">Rechercher un paramètre</span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Rechercher un paramètre (ex. assiduité, délai, risque…)"
                                style={{ ...inputStyle, width: "100%" }}
                            />
                        </label>

                        {visibleSections.length === 0 ? (
                            <Card padding={20}>
                                <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                    Aucun paramètre ne correspond à « {query} ».
                                </p>
                            </Card>
                        ) : null}

                        <fieldset disabled={!canEdit || saving} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 16, minWidth: 0 }}>
                            {visibleSections.map(({ section, params }) => (
                                <Section
                                    key={section.key}
                                    icon={SECTION_ICONS[section.key] ?? "settings"}
                                    title={section.title}
                                    subtitle={section.description}
                                >
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {(params.length > 0 ? params : section.params).map((info) => {
                                            const value = draft[section.key]?.[info.key];
                                            const def = (data.defaults as unknown as Values)[section.key]?.[info.key];
                                            const changed = typeof def === "number" && value !== def;
                                            return (
                                                <NumberField
                                                    key={info.key}
                                                    id={`${section.key}-${info.key}`}
                                                    info={info}
                                                    value={value}
                                                    defaultValue={def}
                                                    changed={changed}
                                                    onChange={(n) => setValue(section.key, info.key, n)}
                                                    onReset={() => typeof def === "number" && setValue(section.key, info.key, def)}
                                                />
                                            );
                                        })}
                                    </div>
                                </Section>
                            ))}
                        </fieldset>
                    </div>
                ) : null}

                {draft && data && canEdit ? (
                    <div
                        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
                        style={{ borderColor: "var(--eduflow-border-subtle)", background: "var(--eduflow-surface-card)" }}
                    >
                        <div style={{ fontSize: 12, minWidth: 0, flex: "1 1 220px" }} role="status" aria-live="polite">
                            {validation ? (
                                <span style={{ color: "var(--eduflow-danger-600)" }}>{validation}</span>
                            ) : saveError ? (
                                <span style={{ color: "var(--eduflow-danger-600)" }}>{saveError}</span>
                            ) : savedMessage ? (
                                <span style={{ color: "var(--eduflow-text-secondary)" }}>{savedMessage}</span>
                            ) : dirty ? (
                                <span style={{ color: "var(--eduflow-text-secondary)" }}>Modifications non enregistrées.</span>
                            ) : (
                                <span style={{ color: "var(--eduflow-text-tertiary)" }}>Paramètres à jour.</span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={saving}
                                onClick={() => {
                                    if (window.confirm("Revenir à toutes les valeurs d'origine ? Rien n'est enregistré tant que vous ne cliquez pas sur Enregistrer.")) {
                                        setSavedMessage(null);
                                        setDraft(data.defaults as unknown as Values);
                                    }
                                }}
                            >
                                Valeurs d&apos;origine
                            </Button>
                            <Button variant="secondary" size="sm" disabled={!dirty || saving} onClick={() => setDraft(data.parameters as unknown as Values)}>
                                Annuler
                            </Button>
                            <Button
                                size="sm"
                                icon={saving ? undefined : "check"}
                                loading={saving}
                                disabled={!dirty || Boolean(validation)}
                                onClick={save}
                            >
                                Enregistrer
                            </Button>
                        </div>
                    </div>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}

// ─────────────────────────── Briques d'interface ───────────────────────────

function Section({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <Card padding={0}>
            <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                <Icon name={icon} size={18} color="var(--brand-700)" />
                <div style={{ minWidth: 0 }}>
                    <h2 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                        {title}
                    </h2>
                    {subtitle ? <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>{subtitle}</p> : null}
                </div>
            </div>
            <div className="px-5 py-5">{children}</div>
        </Card>
    );
}

function Notice({ children }: { children: React.ReactNode }) {
    return (
        <div
            role="note"
            className="flex items-start gap-2 rounded-lg px-4 py-3"
            style={{ background: "var(--brand-50)", color: "var(--brand-800)", fontSize: 12 }}
        >
            <Icon name="info" size={16} />
            <span>{children}</span>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    height: 38,
    padding: "0 10px",
    borderRadius: "var(--eduflow-radius-input)",
    border: "1px solid var(--eduflow-border-default)",
    background: "var(--eduflow-surface-card)",
    fontFamily: "inherit",
    fontSize: 13,
    color: "var(--eduflow-text-primary)",
    maxWidth: "100%",
};

function NumberField({
    id,
    info,
    value,
    defaultValue,
    changed,
    onChange,
    onReset,
}: {
    id: string;
    info: ParameterInfo;
    value: number | undefined;
    defaultValue: number | undefined;
    changed: boolean;
    onChange: (n: number) => void;
    onReset: () => void;
}) {
    const helpId = `${id}-help`;
    return (
        <div style={{ minWidth: 0 }}>
            <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {info.label}
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    value={typeof value === "number" && Number.isFinite(value) ? value : ""}
                    min={info.min}
                    max={info.max}
                    step={info.step}
                    aria-describedby={helpId}
                    onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                    style={{ ...inputStyle, width: 110 }}
                />
                <span style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}>{info.unit}</span>
                {changed ? (
                    <button
                        type="button"
                        onClick={onReset}
                        style={{ fontSize: 11, color: "var(--brand-700)", background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}
                    >
                        Revenir à {typeof defaultValue === "number" ? fr(defaultValue) : "l'origine"}
                    </button>
                ) : null}
            </div>
            <p id={helpId} style={{ margin: "4px 0 0", fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                {info.help ? `${info.help} ` : ""}
                Entre {fr(info.min)} et {fr(info.max)} · origine : {typeof defaultValue === "number" ? fr(defaultValue) : "—"}
            </p>
        </div>
    );
}
