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

type Cycle = {
    level: "PRIMARY" | "SECONDARY_COLLEGE" | "SECONDARY_LYCEE";
    label: string;
    grades: string[];
    finalExam: string;
    hasSeries: boolean;
};

type LevelsResponse = { schoolId: string; offeredLevels: string[]; cycles: Cycle[] };

export default function SchoolCyclesPage() {
    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
            <SchoolCyclesContent />
        </PageGuard>
    );
}

function SchoolCyclesContent() {
    const { schoolId } = useSchool();
    const { data, error, isLoading, mutate } = useSWR<LevelsResponse>(
        schoolId ? `/api/schools/${schoolId}/levels` : null,
        fetcher,
        { revalidateOnFocus: false },
    );

    const [selected, setSelected] = React.useState<Set<string> | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);

    React.useEffect(() => {
        if (data && selected === null) setSelected(new Set(data.offeredLevels));
    }, [data, selected]);

    const current = selected ?? new Set<string>();

    function toggle(level: string) {
        setFeedback(null);
        setSelected((prev) => {
            const next = new Set(prev ?? []);
            if (next.has(level)) next.delete(level);
            else next.add(level);
            return next;
        });
    }

    async function save() {
        if (!schoolId || current.size === 0) return;
        setSaving(true);
        setFeedback(null);
        try {
            const res = await fetch(`/api/schools/${schoolId}/levels`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ offeredLevels: Array.from(current) }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    body.code === "CYCLE_HAS_CLASSES"
                        ? "Impossible de retirer un cycle qui contient encore des classes. Archivez d'abord ses niveaux."
                        : body.error || "Échec de l'enregistrement.",
                );
            }
            await mutate();
            setFeedback({ type: "success", msg: "Cycles enregistrés. Le menu et les fonctionnalités s'adaptent." });
        } catch (e) {
            setFeedback({ type: "error", msg: e instanceof Error ? e.message : "Erreur." });
        } finally {
            setSaving(false);
        }
    }

    const dirty = data ? !setsEqual(current, new Set(data.offeredLevels)) : false;

    return (
        <PageShell className="max-w-4xl pb-12">
            <PageHeader
                title="Cycles de l'établissement"
                description="Configurez les cycles offerts (Primaire, Collège, Lycée). L'application n'affiche que ce qui correspond."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Paramètres", href: "/dashboard/settings" },
                    { label: "Cycles" },
                ]}
            />

            {isLoading || (!data && !error) ? (
                <PageLoading label="Chargement des cycles…" />
            ) : error ? (
                <PageError message="Impossible de charger la configuration. Réessayez." onRetry={() => void mutate()} />
            ) : data ? (
                <>
                    <div className="edu-stagger" style={{ display: "grid", gap: 12 }}>
                        {data.cycles.map((c) => {
                            const on = current.has(c.level);
                            return (
                                <Card key={c.level} interactive onClick={() => toggle(c.level)} padding={18}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                        <div
                                            aria-hidden
                                            style={{
                                                width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center",
                                                background: on ? "var(--brand-600)" : "var(--eduflow-surface-sunken)",
                                                transition: "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                            }}
                                        >
                                            <Icon name={on ? "check" : "school"} size={20} color={on ? "#fff" : "var(--eduflow-text-tertiary)"} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                <span className="eduflow-display" style={{ fontSize: 15, fontWeight: 700 }}>{c.label}</span>
                                                <Badge variant="neutral" size="sm">Examen : {c.finalExam}</Badge>
                                                {c.hasSeries ? <Badge variant="brand" size="sm">Séries</Badge> : null}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", marginTop: 4 }}>
                                                Classes : {c.grades.join(" · ")}
                                            </div>
                                        </div>
                                        <Badge variant={on ? "success" : "neutral"} size="sm" dot>
                                            {on ? "Offert" : "Non offert"}
                                        </Badge>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {current.size === 0 ? (
                        <p style={{ fontSize: 12, color: "var(--eduflow-danger-600)" }}>Sélectionnez au moins un cycle.</p>
                    ) : null}

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
                        <SubLabel>{current.size}/3 cycle(s)</SubLabel>
                        <Button icon="check" onClick={save} loading={saving} disabled={!dirty || current.size === 0}>
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
