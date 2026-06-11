"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Logo,
    Spinner,
    type IconName,
} from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";
import { RoleOnboardShell, StatTile, ShortcutCard, LabelledInput } from "./shell";

// Extrait de dashboard/onboarding/page.tsx (1441 lignes) lors de la
// découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

type SchoolRow = {
    id: string;
    name: string;
    city: string | null;
    studentCount?: number | null;
    status?: string;
};

export function SuperAdminOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(3);
    const steps = [
        "Vérifier le domaine entreprise",
        "Activer SSO Microsoft / Google",
        "Importer mes établissements",
        "Définir les KPIs réseau",
        "Inviter mon équipe centrale",
    ];
    const [schools, setSchools] = useState<SchoolRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/schools");
                if (res.ok) {
                    const d = await res.json();
                    const list: SchoolRow[] = Array.isArray(d)
                        ? d
                        : d.data || d.schools || [];
                    setSchools(list);
                }
            } catch {
                /* keep empty */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const totalStudents = useMemo(
        () =>
            schools.reduce(
                (sum, s) => sum + (s.studentCount ?? 0),
                0
            ),
        [schools]
    );

    return (
        <RoleOnboardShell
            role="SUPER ADMIN"
            color="danger"
            user={user}
            heroTitle="Prends le contrôle de ton réseau d'établissements."
            heroSub="Configure SSO, importe tes écoles, définis les standards qualité du réseau. Vue consolidée temps réel dès la fin."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Importer mes établissements
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Ajoute-les un à un, ou importe via CSV. Chaque établissement reste
                indépendant côté pédagogie · données consolidées pour toi.
            </p>

            <Card padding={0}>
                <div
                    style={{
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {loading
                            ? "Chargement…"
                            : `${schools.length} établissement${schools.length > 1 ? "s" : ""} connecté${schools.length > 1 ? "s" : ""}`}
                    </span>
                    <Link
                        href="/dashboard/root-control/schools"
                        style={{ textDecoration: "none" }}
                    >
                        <Button size="sm" icon="plus">
                            Ajouter
                        </Button>
                    </Link>
                </div>
                {loading ? (
                    <div
                        style={{
                            padding: 24,
                            textAlign: "center",
                            color: "var(--eduflow-text-tertiary)",
                            fontSize: 12,
                        }}
                    >
                        <Spinner size={20} color="var(--brand-600)" />
                    </div>
                ) : schools.length === 0 ? (
                    <div
                        style={{
                            padding: "24px 18px",
                            textAlign: "center",
                            fontSize: 12,
                            color: "var(--eduflow-text-tertiary)",
                            lineHeight: 1.55,
                        }}
                    >
                        Aucun établissement encore connecté. Démarre avec
                        « Ajouter » pour configurer le premier site.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <tbody>
                            {schools.slice(0, 8).map((s, i) => (
                                <tr
                                    key={s.id}
                                    style={{
                                        borderTop:
                                            i > 0
                                                ? "1px solid var(--eduflow-border-subtle)"
                                                : 0,
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: "12px 18px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <Avatar name={s.name} size="sm" />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                {s.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color:
                                                        "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                {s.city ?? "—"}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 18px" }}>
                                        <Badge variant="success" size="sm">
                                            {s.studentCount
                                                ? `Synchro · ${s.studentCount} élèves`
                                                : "Synchro"}
                                        </Badge>
                                    </td>
                                    <td
                                        style={{
                                            padding: "12px 18px",
                                            textAlign: "right",
                                        }}
                                    >
                                        <Link
                                            href={`/dashboard/root-control/schools`}
                                            style={{ textDecoration: "none" }}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                iconRight="chevron"
                                            >
                                                Détail
                                            </Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginTop: 16,
                }}
                className="ob-stats"
            >
                <StatTile label="Total élèves réseau" value={String(totalStudents || "—")} sub="des sites actifs" />
                <StatTile label="Chiffrement" value="256-bit" sub="AES isolation par site" />
                <StatTile label="SLA contractuel" value="99,9%" sub="< 200ms latence garantie" />
            </div>
        </RoleOnboardShell>
    );
}
