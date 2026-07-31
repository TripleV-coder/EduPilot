"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Input } from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

type ClassOption = { id: string; name: string; classLevel?: { name?: string } | null };

export default function NewCagnottePage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <NewCagnotteContent />
        </PageGuard>
    );
}

function NewCagnotteContent() {
    const router = useRouter();
    const { data: classesData } = useSWR("/api/classes?limit=100", fetcher);
    const classes: ClassOption[] = classesData?.data ?? classesData ?? [];

    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [classId, setClassId] = React.useState("");
    const [target, setTarget] = React.useState("");
    const [deadline, setDeadline] = React.useState("");
    const [expected, setExpected] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const perFamily =
        Number(target) > 0 && Number(expected) > 0
            ? Math.ceil(Number(target) / Number(expected))
            : null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/cagnottes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: description || undefined,
                    classId: classId || undefined,
                    targetFcfa: Number(target),
                    deadline,
                    expectedParticipants: expected ? Number(expected) : undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error ?? "Erreur lors de la création.");
                return;
            }
            router.push(`/dashboard/cagnotte/${json.id}`);
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
                title="Créer une cagnotte"
                description="Sortie scolaire, fournitures partagées, cadeau collectif — 100 % transparent, 0 % de frais."
                breadcrumbs={[
                    { label: "Communauté" },
                    { label: "Cagnottes", href: "/dashboard/cagnotte" },
                    { label: "Nouvelle" },
                ]}
            />

            <form onSubmit={handleSubmit}>
                <Card padding={24}>
                    <SubLabel>Informations</SubLabel>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
                        <div>
                            <label htmlFor="cag-title" style={fieldLabel}>
                                Titre de la cagnotte *
                            </label>
                            <Input
                                id="cag-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex : Sortie pédagogique Ouidah · Route des Esclaves"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="cag-desc" style={fieldLabel}>
                                Description (visible par les familles)
                            </label>
                            <textarea
                                id="cag-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="But, date de l'événement, ce que couvre la participation…"
                                style={{
                                    width: "100%",
                                    minHeight: 80,
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

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                                <label htmlFor="cag-class" style={fieldLabel}>
                                    Classe concernée (optionnel)
                                </label>
                                <select
                                    id="cag-class"
                                    value={classId}
                                    onChange={(e) => setClassId(e.target.value)}
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
                                    <option value="">Toute l&apos;école</option>
                                    {classes.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {`${c.classLevel?.name ?? ""} ${c.name}`.trim()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="cag-deadline" style={fieldLabel}>
                                    Date limite *
                                </label>
                                <Input
                                    id="cag-deadline"
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <div>
                                <label htmlFor="cag-target" style={fieldLabel}>
                                    Objectif (FCFA) *
                                </label>
                                <Input
                                    id="cag-target"
                                    type="number"
                                    min="1000"
                                    step="500"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    placeholder="Ex : 350000"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="cag-expected" style={fieldLabel}>
                                    Familles attendues (optionnel)
                                </label>
                                <Input
                                    id="cag-expected"
                                    type="number"
                                    min="1"
                                    value={expected}
                                    onChange={(e) => setExpected(e.target.value)}
                                    placeholder="Ex : 28"
                                />
                            </div>
                        </div>

                        {perFamily ? (
                            <div
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    background: "var(--brand-50)",
                                    border: "1px solid var(--brand-200)",
                                    fontSize: 13,
                                    color: "var(--brand-800)",
                                }}
                            >
                                Participation suggérée :{" "}
                                <strong>
                                    {new Intl.NumberFormat("fr-FR").format(perFamily)} FCFA
                                </strong>{" "}
                                par famille ({expected} familles).
                            </div>
                        ) : null}

                        {error ? (
                            <div role="alert">
                                <Badge variant="danger">{error}</Badge>
                            </div>
                        ) : null}

                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => router.push("/dashboard/cagnotte")}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" icon="plus" loading={submitting}>
                                Créer la cagnotte
                            </Button>
                        </div>
                    </div>
                </Card>
            </form>
        </PageShell>
    );
}
