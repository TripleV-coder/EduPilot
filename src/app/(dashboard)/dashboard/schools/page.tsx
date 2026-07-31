"use client";

import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Badge, Button, Card, Icon } from "@/components/edu";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

type SchoolItem = {
    id: string;
    name: string;
    type: string;
    level: string;
    siteType?: "MAIN" | "ANNEXE";
    organization?: { id: string; name: string; code: string } | null;
    parentSchool?: { name: string } | null;
    address?: string;
    isActive: boolean;
    _count?: { users: number; childSchools?: number };
};

export default function SchoolsPage() {
    const { data: session } = useSession();
    const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

    const { data, error, isLoading, mutate } = useSWR<SchoolItem[] | { data?: SchoolItem[]; schools?: SchoolItem[] }>(
        "/api/schools",
        fetcher
    );

    const schools = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
            ? data.data
            : data?.schools ?? [];

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <PageShell>
                <PageHeader
                    title="Établissements"
                    description="Gestion des établissements scolaires"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Établissements" },
                    ]}
                    actions={
                        isSuperAdmin ? (
                            <Link href="/dashboard/root-control/schools">
                                <Button variant="primary" size="sm" icon="plus">
                                    Créer un établissement
                                </Button>
                            </Link>
                        ) : undefined
                    }
                />

                {isLoading ? <PageLoading label="Chargement des établissements…" /> : null}
                {error ? (
                    <PageError
                        message={error.message || "Erreur de chargement des établissements"}
                        onRetry={() => void mutate()}
                    />
                ) : null}

                {!isLoading && !error && schools.length === 0 ? (
                    <PageEmpty
                        icon="school"
                        title="Aucun établissement"
                        description="Les établissements apparaîtront ici une fois créés."
                        actions={
                            isSuperAdmin
                                ? [{ label: "Créer un établissement", href: "/dashboard/root-control/schools" }]
                                : undefined
                        }
                    />
                ) : null}

                {!isLoading && !error && schools.length > 0 ? (
                    <div className="edu-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {schools.map((school) => (
                            <Card key={school.id} variant="default" padding={20}>
                                <div className="flex items-start gap-3">
                                    <div
                                        className="grid h-10 w-10 shrink-0 place-items-center rounded-soft"
                                        style={{ background: "var(--brand-100)", color: "var(--brand-700)" }}
                                    >
                                        <Icon name="school" size={18} color="var(--brand-700)" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3
                                            className="truncate text-sm font-semibold"
                                            style={{ color: "var(--eduflow-text-primary)" }}
                                        >
                                            {school.name}
                                        </h3>
                                        <p className="mt-0.5 text-xs" style={{ color: "var(--eduflow-text-secondary)" }}>
                                            {school.type} · {school.level} ·{" "}
                                            {school.siteType === "ANNEXE" ? "Annexe" : "Site principal"}
                                        </p>
                                        {school.organization?.name ? (
                                            <p className="mt-1 truncate text-[11px]" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                                Organisation {school.organization.name}
                                            </p>
                                        ) : null}
                                        {school.parentSchool?.name ? (
                                            <p className="truncate text-[11px]" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                                Rattaché à {school.parentSchool.name}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                <div
                                    className="mt-4 flex items-center justify-between gap-2 border-t pt-3 text-xs"
                                    style={{
                                        borderColor: "var(--eduflow-border-subtle)",
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <Icon name="users" size={12} />
                                        {school._count?.users ?? 0} utilisateurs
                                    </span>
                                    {school.address ? (
                                        <span className="max-w-[150px] truncate">{school.address}</span>
                                    ) : null}
                                    <Badge variant={school.isActive ? "success" : "neutral"} size="sm">
                                        {school.isActive ? "Actif" : "Inactif"}
                                    </Badge>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}
