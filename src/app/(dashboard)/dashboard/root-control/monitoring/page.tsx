"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Database, Activity, HardDrive, Cpu, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

 

type MonitoringData = {
    timestamp: string;
    database: {
        health: { responseTime: number; status: string };
        connectionPool: { status: string };
    };
    cache: {
        connected: boolean;
        hitRate: number;
        memory: string | null;
    };
    system: {
        maintenanceMode: boolean;
        activeSessions: number;
        recentLogins: number;
        pendingDataRequests: number;
    };
    errors: {
        last24h: number;
        recent: any[];
        byType: { type: string; count: number }[];
    };
    alerts: {
        level: string;
        message: string;
        timestamp: string;
    }[];
};

export default function RootMonitoringPage() {
    const [data, setData] = useState<MonitoringData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/root/monitoring", { credentials: "include", cache: "no-store" })
            .then(res => {
                if (!res.ok) throw new Error("Erreur serveur");
                return res.json();
            })
            .then(resData => {
                if (!cancelled) setData(resData);
            })
            .catch(err => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(d));

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-7xl mx-auto">
                <PageHeader
                    title="Root Monitoring (Infrastructure)"
                    description="Surveillance globale des serveurs, bases de données et services de messagerie."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Root Control", href: "/dashboard/root-control" },
                        { label: "Monitoring Global" },
                    ]}
                />

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin w-8 h-8 text-primary" />
                    </div>
                ) : data ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card className="border-primary/20 bg-primary/5">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Server className="w-5 h-5 text-primary" />
                                        </div>
                                        <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                            En ligne
                                        </Badge>
                                    </div>
                                    <h3 className="font-semibold text-lg">Système Principal</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Sessions actives: {data.system.activeSessions}</p>
                                    {data.system.maintenanceMode && (
                                        <Badge variant="destructive" className="mt-2 text-[10px]">Maintenance Active</Badge>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-blue-500/10 rounded-full">
                                            <Database className="w-5 h-5 text-blue-600" />
                                        </div>
                                        {data.database.health.status === "excellent" || data.database.health.status === "good" ? (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                Stable
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">Critique</Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">PostgreSQL Master</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Latence lecture: {data.database.health.responseTime}ms</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-purple-500/10 rounded-full">
                                            <Database className="w-5 h-5 text-purple-600" />
                                        </div>
                                        {data.cache.connected ? (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                Synchronisé
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">Déconnecté</Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Redis Cache</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Hit rate: {data.cache.hitRate}%</p>
                                    {data.cache.memory && <p className="text-xs text-muted-foreground mt-0.5">Mem: {data.cache.memory}</p>}
                                </CardContent>
                            </Card>

                            <Card className={`border-border ${data.errors.last24h > 0 ? "border-orange-500/50 bg-orange-500/5" : ""}`}>
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className={`p-3 rounded-full ${data.errors.last24h > 0 ? "bg-orange-500/10" : "bg-muted"}`}>
                                            <Activity className={`w-5 h-5 ${data.errors.last24h > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
                                        </div>
                                        {data.errors.last24h > 0 ? (
                                            <Badge variant="outline" className="text-orange-600 border-orange-500/30 bg-orange-500/10">Sous charge</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Normal</Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Logs & Erreurs</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{data.errors.last24h} erreurs / 24h</p>
                                </CardContent>
                            </Card>
                        </div>

                        {data.alerts && data.alerts.length > 0 && (
                            <div className="space-y-4 mt-6">
                                <h3 className="font-semibold text-lg">Alertes Récentes</h3>
                                {data.alerts.map((alert, idx) => (
                                    <Card key={idx} className={`${alert.level === "critical" ? "border-destructive/30 bg-destructive/5" : alert.level === "warning" ? "border-orange-500/30 bg-orange-500/5" : "border-primary/30 bg-primary/5"} shadow-sm`}>
                                        <CardContent className="p-4 flex items-start gap-4">
                                            <AlertTriangle className={`w-6 h-6 shrink-0 mt-1 ${alert.level === "critical" ? "text-destructive" : alert.level === "warning" ? "text-orange-500" : "text-primary"}`} />
                                            <div>
                                                <h4 className={`font-semibold ${alert.level === "critical" ? "text-destructive" : alert.level === "warning" ? "text-orange-500" : "text-primary"}`}>
                                                    Alerte Système ({alert.level})
                                                </h4>
                                                <p className="text-sm text-foreground mt-1">{alert.message}</p>
                                                <p className="text-xs text-muted-foreground mt-2 font-mono">Dernière maj: {formatDate(alert.timestamp)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </PageGuard>
    );
}
