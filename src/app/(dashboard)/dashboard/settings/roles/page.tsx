"use client";

import { useState } from "react";
import useSWR from "swr";
import type { UserRole } from "@prisma/client";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Permission, getRoleName } from "@/lib/rbac/permissions";
import {
    PERMISSION_MATRIX,
    ROLE_DESCRIPTORS,
    evaluateRow,
    type CellState,
    type RoleDescriptor,
} from "@/lib/rbac/matrix";
import { fetcher } from "@/lib/fetcher";
import { Info } from "lucide-react";

const COLOR_PALETTE: Record<RoleDescriptor["color"], {
    dot: string;
    activeBg: string;
    activeFg: string;
    activeBorder: string;
}> = {
    brand: {
        dot: "var(--eduflow-brand-500)",
        activeBg: "var(--eduflow-brand-50)",
        activeFg: "var(--eduflow-brand-800)",
        activeBorder: "var(--eduflow-brand-700)",
    },
    info: {
        dot: "var(--eduflow-info-500)",
        activeBg: "var(--eduflow-info-50)",
        activeFg: "var(--eduflow-info-800)",
        activeBorder: "var(--eduflow-info-700)",
    },
    success: {
        dot: "var(--eduflow-success-500)",
        activeBg: "var(--eduflow-success-50)",
        activeFg: "var(--eduflow-success-800)",
        activeBorder: "var(--eduflow-success-700)",
    },
    warning: {
        dot: "var(--eduflow-warning-500)",
        activeBg: "var(--eduflow-warning-50)",
        activeFg: "var(--eduflow-warning-800)",
        activeBorder: "var(--eduflow-warning-700)",
    },
    neutral: {
        dot: "var(--eduflow-neutral-500)",
        activeBg: "var(--eduflow-neutral-100)",
        activeFg: "var(--eduflow-neutral-800)",
        activeBorder: "var(--eduflow-neutral-500)",
    },
    danger: {
        dot: "var(--eduflow-danger-500)",
        activeBg: "var(--eduflow-danger-50)",
        activeFg: "var(--eduflow-danger-800)",
        activeBorder: "var(--eduflow-danger-700)",
    },
};

export default function RolesPermissionsPage() {
    const [selectedRole, setSelectedRole] = useState<UserRole>("DIRECTOR");

    const { data: roleCountsData } = useSWR<{ counts: Record<string, number> }>(
        "/api/users/role-counts",
        fetcher,
    );
    const counts = roleCountsData?.counts ?? {};

    const totalUsers = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const selectedDescriptor = ROLE_DESCRIPTORS.find((d) => d.role === selectedRole) ?? ROLE_DESCRIPTORS[0];

    return (
        <PageGuard
            permission={Permission.USER_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="space-y-4 max-w-[1280px] mx-auto pb-12">
                <PageHeader
                    title="Rôles & permissions"
                    description={`${ROLE_DESCRIPTORS.length} rôles · ${totalUsers} utilisateurs · contrôle d'accès fin`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Équipe & accès" },
                        { label: "Rôles" },
                    ]}
                />

                <div className="grid gap-3.5" style={{ gridTemplateColumns: "280px 1fr" }}>
                    {/* Role list */}
                    <div
                        className="rounded-xl p-2"
                        style={{
                            background: "var(--eduflow-surface-card)",
                            border: "1px solid var(--eduflow-border-subtle)",
                        }}
                    >
                        {ROLE_DESCRIPTORS.map((d) => {
                            const active = d.role === selectedRole;
                            const palette = COLOR_PALETTE[d.color];
                            return (
                                <button
                                    key={d.role}
                                    type="button"
                                    onClick={() => setSelectedRole(d.role)}
                                    className="flex items-center gap-2.5 w-full text-left rounded-lg"
                                    style={{
                                        padding: "10px 12px",
                                        background: active ? palette.activeBg : "transparent",
                                        borderLeft: `3px solid ${active ? palette.activeBorder : "transparent"}`,
                                        cursor: "pointer",
                                    }}
                                >
                                    <span
                                        className="rounded-full"
                                        style={{ width: 8, height: 8, background: palette.dot }}
                                    />
                                    <span
                                        className="flex-1"
                                        style={{
                                            fontSize: 13,
                                            fontWeight: active ? 700 : 500,
                                            color: active ? palette.activeFg : "var(--eduflow-text-primary)",
                                        }}
                                    >
                                        {getRoleName(d.role)}
                                    </span>
                                    <span
                                        className="font-mono"
                                        style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
                                    >
                                        {counts[d.role] ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Permission matrix */}
                    <div
                        className="rounded-xl overflow-hidden"
                        style={{
                            background: "var(--eduflow-surface-card)",
                            border: "1px solid var(--eduflow-border-subtle)",
                        }}
                    >
                        <div
                            className="px-5 py-3.5"
                            style={{ borderBottom: "1px solid var(--eduflow-border-subtle)" }}
                        >
                            <h2
                                className="m-0"
                                style={{
                                    fontFamily: "var(--eduflow-font-display, inherit)",
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: "var(--eduflow-text-primary)",
                                }}
                            >
                                {getRoleName(selectedRole)}
                            </h2>
                            <p
                                className="m-0"
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginTop: 2,
                                }}
                            >
                                {selectedDescriptor.note}
                            </p>
                        </div>

                        <table className="w-full border-collapse" style={{ fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: "var(--eduflow-surface-sunken)" }}>
                                    {["Module", "Lire", "Créer", "Modifier", "Supprimer"].map((h) => (
                                        <th
                                            key={h}
                                            className="text-left font-bold uppercase"
                                            style={{
                                                padding: "10px 16px",
                                                fontSize: 10,
                                                color: "var(--eduflow-text-tertiary)",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {PERMISSION_MATRIX.map((row) => {
                                    const cells = evaluateRow(selectedRole, row);
                                    return (
                                        <tr
                                            key={row.label}
                                            style={{ borderTop: "1px solid var(--eduflow-border-subtle)" }}
                                        >
                                            <td className="font-semibold" style={{ padding: "10px 16px" }}>
                                                {row.label}
                                            </td>
                                            {cells.map((state, idx) => (
                                                <td key={idx} style={{ padding: "10px 16px" }}>
                                                    <TogglePill state={state} />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div
                            className="flex items-center gap-2.5"
                            style={{
                                padding: 18,
                                background: "var(--eduflow-brand-50)",
                                borderTop: "1px solid var(--eduflow-brand-200)",
                                fontSize: 12,
                                color: "var(--eduflow-brand-800)",
                            }}
                        >
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span>
                                Matrice en lecture seule. La modification fine d&apos;une permission
                                nécessite un changement de rôle, tracé dans le journal d&apos;audit.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}

function TogglePill({ state }: { state: CellState }) {
    if (state === "n/a") {
        return (
            <span
                className="inline-block font-mono"
                style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
                aria-label="Non applicable"
                title="Non applicable à ce module"
            >
                —
            </span>
        );
    }
    const on = state === "on";
    return (
        <span
            className="relative inline-block"
            style={{
                width: 28,
                height: 18,
                borderRadius: 9,
                background: on ? "var(--eduflow-success-600)" : "var(--eduflow-neutral-200)",
            }}
            role="img"
            aria-label={on ? "Autorisé" : "Refusé"}
        >
            <span
                className="absolute"
                style={{
                    top: 2,
                    left: on ? 12 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
                }}
            />
        </span>
    );
}
