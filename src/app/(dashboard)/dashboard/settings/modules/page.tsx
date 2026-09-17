"use client";

import * as React from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { useSchool } from "@/components/providers/school-provider";
import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { SubLabel } from "@/components/edu-homes/_shared";

/**
 * Modules de l'établissement (Lot 6 — minimisation).
 *
 * Un module éteint disparaît du menu ET son API répond 403 : l'école ne
 * détient aucune donnée de ce type. C'est le sens du réglage, dit ici en
 * clair. Même structure que l'écran « Cycles » : composants existants.
 */
type ModuleRow = { id: string; label: string; description: string; required: boolean; enabled: boolean };
type ModulesResponse = { schoolId: string; data: ModuleRow[] };

export default function SchoolModulesPage() {
    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
            <SchoolModulesContent />
        </PageGuard>
    );
}

function SchoolModulesContent() {
    const { schoolId } = useSchool();
    const { data, error, isLoading, mutate } = useSWR<ModulesResponse>(
        schoolId ? `/api/schools/${schoolId}/modules` : null,
        fetcher,
        { revalidateOnFocus: false },
    );

    const [selected, setSelected] = React.useState<Set<string> | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

    React.useEffect(() => {
        if (data && selected === null) setSelected(new Set(data.data.filter((m) => m.enabled).map((m) => m.id)));
    }, [data, selected]);

    const current = selected ?? new Set<string>();

    function toggle(row: ModuleRow) {
        if (row.required) return;
        setFeedback(null);
        setSelected((prev) => {
            const next = new Set(prev ?? []);
            if (next.has(row.id)) next.delete(row.id);
            else next.add(row.id);
            return next;
        });
    }

    async function save() {
        if (!schoolId) return;
        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(`/api/schools/${schoolId}/modules`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledModules: Array.from(current) }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Échec de l'enregistrement.");
            await mutate();
            setFeedback({ type: "success", msg: "Modules enregistrés. Le menu et les accès s'adaptent." });
        } catch (e) {
            setFeedback({ type: "error", msg: e instanceof Error ? e.message : "Erreur." });
        } finally {
            setSaving(false);
        }
    }

    const dirty = data
        ? !setsEqual(current, new Set(data.data.filter((m) => m.enabled).map((m) => m.id)))
        : false;

    return (
        <PageShell className="max-w-4xl pb-12">
            <PageHeader
                title="Modules de l'établissement"
                description="N'activez que ce dont vous vous servez. Un module éteint disparaît du menu et ses données ne sont plus accessibles ni collectées."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Paramètres", href: "/dashboard/settings" },
                    { label: "Modules" },
                ]}
            />

            {isLoading || (!data && !error) ? (
                <PageLoading label="Chargement des modules…" />
            ) : error ? (
                <PageError message="Impossible de charger la configuration. Réessayez." onRetry={() => void mutate()} />
            ) : data ? (
                <>
                    <div className="edu-stagger" style={{ display: "grid", gap: 12 }}>
                        {data.data.map((m) => {
                            const on = m.required || current.has(m.id);
                            return (
                                <Card
                                    key={m.id}
                                    interactive={!m.required}
                                    onClick={m.required ? undefined : () => toggle(m)}
                                    padding={18}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                        <div
                                            aria-hidden
                                            style={{
                                                width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center",
                                                background: on ? "var(--brand-600)" : "var(--eduflow-surface-sunken)",
                                                transition: "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                            }}
                                        >
                                            <Icon name={on ? "check" : "settings"} size={20} color={on ? "#fff" : "var(--eduflow-text-tertiary)"} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                <span className="eduflow-display" style={{ fontSize: 15, fontWeight: 700 }}>{m.label}</span>
                                                {m.required ? <Badge variant="neutral" size="sm">Indispensable</Badge> : null}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", marginTop: 4 }}>
                                                {m.description}
                                            </div>
                                        </div>
                                        <Badge variant={on ? "success" : "neutral"} size="sm" dot>
                                            {on ? "Activé" : "Désactivé"}
                                        </Badge>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {feedback ? (
                        <div
                            role={feedback.type === "error" ? "alert" : "status"}
                            style={{
                                fontSize: 13, borderRadius: 10, padding: "10px 14px",
                                color: feedback.type === "error" ? "var(--eduflow-danger-600)" : "var(--eduflow-success-700)",
                                background: feedback.type === "error" ? "rgba(239,68,68,0.08)" : "var(--eduflow-success-50)",
                                border: `1px solid ${feedback.type === "error" ? "rgba(239,68,68,0.25)" : "var(--brand-200)"}`,
                            }}
                        >
                            {feedback.msg}
                        </div>
                    ) : null}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                        <SubLabel>{data.data.filter((m) => m.required || current.has(m.id)).length}/{data.data.length} module(s)</SubLabel>
                        <Button icon="check" onClick={save} loading={saving} disabled={!dirty}>
                            Enregistrer
                        </Button>
                    </div>
                </>
            ) : null}
        </PageShell>
    );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
}
