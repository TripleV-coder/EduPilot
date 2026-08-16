"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ADMIN_ROLES } from "@/lib/rbac/permissions";
import { Users, School, Activity, AlertCircle, Database } from "lucide-react";

type SystemStats = {
    userCount: number;
    schoolCount: number;
    activeUsers: number;
    auditLogCount: number;
};

type PendingAction = {
    id: string;
    type: string;
    description: string;
    count: number;
    priority: "high" | "medium" | "low";
    url: string;
    icon: string;
    status?: string;
};

export default function AdminPage() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [pendingActions, setPendingActions] = useState<PendingAction[] | null>(null);
    const [systemInfo, setSystemInfo] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch("/api/system/activity", { credentials: "include" }).then((r) => {
                if (!r.ok) throw new Error("Erreur de chargement des statistiques système");
                return r.json();
            }),
            fetch("/api/admin/pending-actions", { credentials: "include" }).then((r) => r.ok ? r.json() : null).catch(() => null),
            fetch("/api/admin/system/info", { credentials: "include" }).then((r) => r.ok ? r.json() : null).catch(() => null),
        ])
            .then(([statsData, actionsData, infoData]) => {
                if (!cancelled) {
                    setStats(statsData);
                    setPendingActions(Array.isArray(actionsData) ? actionsData : actionsData?.actions ?? null);
                    setSystemInfo(infoData);
                }
            })
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <PageShell>
                <PageHeader
                    title="Administration"
                    description="Panel d'administration système"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Administration" },
                    ]}
                />

                {loading ? <PageLoading label="Chargement des statistiques système…" /> : null}

                {error ? <PageError message={error} onRetry={() => window.location.reload()} /> : null}

                {!loading && !error && stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Utilisateurs</CardTitle>
                                <Users className="w-4 h-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.userCount ?? "—"}</div>
                                <p className="text-xs text-muted-foreground mt-1">Comptes enregistrés</p>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Établissements</CardTitle>
                                <School className="w-4 h-4 text-secondary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.schoolCount ?? "—"}</div>
                                <p className="text-xs text-muted-foreground mt-1">Écoles actives</p>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Sessions Actives</CardTitle>
                                <Activity className="w-4 h-4 text-accent" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.activeUsers ?? "—"}</div>
                                <p className="text-xs text-muted-foreground mt-1">Utilisateurs connectés</p>
                            </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Logs d&apos;Audit</CardTitle>
                                <Database className="w-4 h-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.auditLogCount ?? "—"}</div>
                                <p className="text-xs text-muted-foreground mt-1">Événements enregistrés</p>
                            </CardContent>
                        </Card>
                    </div>
                ) : null}

                {/* Pending Actions */}
                {pendingActions && pendingActions.length > 0 && (
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-warning" />
                                Actions en attente ({pendingActions.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {pendingActions.map((action, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                                        <span className="text-sm">{action.description || action.type}</span>
                                        <Badge variant="outline">{action.status || "En attente"}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* System Info */}
                {systemInfo && (
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Database className="w-4 h-4 text-primary" />
                                Informations Système
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {Object.entries(systemInfo).map(([key, value]) => (
                                    <div key={key} className="space-y-1">
                                        <span className="text-muted-foreground">{key}</span>
                                        <div className="font-medium">{typeof value === "object" ? JSON.stringify(value) : String(value)}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {!loading && !error && !stats ? (
                    <PageEmpty
                        icon="settings"
                        title="Données système indisponibles"
                        description="Vérifiez la connexion au serveur."
                    />
                ) : null}
            </PageShell>
        </PageGuard>
    );
}
