"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { School, AlertCircle, Users, MapPin, Plus } from "lucide-react";

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
    const [schools, setSchools] = useState<SchoolItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/schools", { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Erreur de chargement des établissements");
                return r.json();
            })
            .then((data) => {
                const resolvedSchools = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : data?.schools ?? [];

                if (!cancelled) setSchools(resolvedSchools);
            })
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Établissements"
                    description="Gestion des établissements scolaires"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Établissements" },
                    ]}
                    actions={
                        isSuperAdmin ? (
                            <Link
                                href="/dashboard/root-control/schools"
                                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Créer un établissement
                            </Link>
                        ) : undefined
                    }
                />

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && schools.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                        <School className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Aucun établissement</h3>
                        <p className="text-sm text-muted-foreground mt-2">Les établissements apparaîtront ici une fois créés.</p>
                    </div>
                )}

                {!loading && !error && schools.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {schools.map((school) => (
                            <Card key={school.id} className="border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200">
                                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                                        <School className="h-5 w-5" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <CardTitle className="text-sm font-semibold truncate">{school.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {school.type} • {school.level} • {school.siteType === "ANNEXE" ? "Annexe" : "Site principal"}
                                        </p>
                                        {school.organization?.name ? (
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                Organisation {school.organization.name}
                                            </p>
                                        ) : null}
                                        {school.parentSchool?.name ? (
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                Rattaché à {school.parentSchool.name}
                                            </p>
                                        ) : null}
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-0 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <Users className="h-3 w-3" /> {school._count?.users ?? 0} utilisateurs
                                    </span>
                                    {school.address && (
                                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[150px]">
                                            <MapPin className="h-3 w-3 shrink-0" /> {school.address}
                                        </span>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
