"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "@/lib/rbac/permissions";
import { Shield, AlertCircle, CheckCircle, Database, Users, Activity, FileText, Lock, Clock, Bell } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";

export default function ComplianceDashboardPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        fetch("/api/compliance/dashboard")
            .then(res => {
                if (!res.ok) throw new Error("Erreur lors de la récupération des données de conformité");
                return res.json();
            })
            .then(d => {
                if (isMounted) setData(d);
            })
            .catch(e => {
                if (isMounted) setError(e.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, []);

    const renderAlertIcon = (level: string) => {
        switch (level) {
            case "error": return <AlertCircle className="w-5 h-5 text-destructive" />;
            case "warning": return <AlertCircle className="w-5 h-5 text-warning" />;
            case "info": return <Activity className="w-5 h-5 text-info" />;
            default: return <Shield className="w-5 h-5" />;
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title="RGPD & Conformité"
                    description="Tableau de bord de suivi de la protection des données et politiques de confidentialité."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Conformité" },
                    ]}
                />

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {!loading && !error && data && (
                    <>
                        {/* Score & Alerts Header */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-border bg-card md:col-span-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Score de Conformité</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-end gap-3">
                                        <div className="text-4xl font-bold tracking-tight">
                                            {data.summary.complianceScore}
                                            <span className="text-xl text-muted-foreground">/100</span>
                                        </div>
                                        {data.summary.complianceScore >= 90 ? (
                                            <span className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] px-2 py-0.5 rounded text-xs font-semibold">Excellent</span>
                                        ) : data.summary.complianceScore >= 70 ? (
                                            <span className="bg-warning/10 text-warning px-2 py-0.5 rounded text-xs font-semibold">À améliorer</span>
                                        ) : (
                                            <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded text-xs font-semibold">Critique</span>
                                        )}
                                    </div>
                                    <Progress value={data.summary.complianceScore} className="h-2 mt-4"
                                        indicatorColor={
                                            data.summary.complianceScore >= 90 ? "bg-[hsl(var(--success))]" :
                                                data.summary.complianceScore >= 70 ? "bg-warning" : "bg-destructive"
                                        }
                                    />
                                </CardContent>
                            </Card>

                            <Card className="border-border bg-card md:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Bell className="w-4 h-4" /> {/* Fallback if missing: use AlertCircle */}
                                        Alertes et Recommandations
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data.alerts && data.alerts.length > 0 ? (
                                        <div className="space-y-3">
                                            {data.alerts.map((alert: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                                                    <div className="flex items-center gap-3">
                                                        {renderAlertIcon(alert.level)}
                                                        <span className="text-sm font-medium">{alert.message}</span>
                                                    </div>
                                                    <Button variant="outline" size="sm">{alert.action}</Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-[hsl(var(--success))] p-3 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))]">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="text-sm font-medium">Aucune alerte. Votre configuration est optimale.</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Demandes Utilisateurs</CardTitle>
                                    <FileText className="w-4 h-4 text-primary" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{data.dataRequests.pending} en attente</div>
                                    <p className="text-xs text-muted-foreground mt-1">Droit à l'oubli / Accès</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Politiques Actives</CardTitle>
                                    <Shield className="w-4 h-4 text-[hsl(var(--success))]" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{data.dataManagement.retentionPolicies} actives</div>
                                    <p className="text-xs text-muted-foreground mt-1">Règles de rétention des données</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Utilisateurs Actifs</CardTitle>
                                    <Users className="w-4 h-4 text-secondary" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{data.summary.activeUsers} <span className="text-sm font-normal text-muted-foreground">/ {data.summary.totalUsers}</span></div>
                                    <p className="text-xs text-muted-foreground mt-1">{data.summary.inactiveUsers} comptes inactifs (90j+)</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">Journal Audit</CardTitle>
                                    <Database className="w-4 h-4 text-accent" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{data.auditLogs.last7Days} events</div>
                                    <p className="text-xs text-muted-foreground mt-1">Sur les 7 derniers jours</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Recent Requests Data Table area */}
                        <Card className="border-border">
                            <CardHeader>
                                <CardTitle className="text-lg">Demandes d'accès aux données (Récents)</CardTitle>
                                <CardDescription>Historique des sollicitations des utilisateurs concernant leurs données personnelles.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {data.dataRequests.recent.length === 0 ? (
                                    <p className="text-center py-8 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                                        Aucune demande d'accès ou de suppression récente.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-y">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Utilisateur</th>
                                                    <th className="px-4 py-3 font-medium">Type</th>
                                                    <th className="px-4 py-3 font-medium">Date demande</th>
                                                    <th className="px-4 py-3 font-medium">Statut</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.dataRequests.recent.map((req: any) => (
                                                    <tr key={req.id} className="border-b last:border-0 hover:bg-muted/10">
                                                        <td className="px-4 py-3">
                                                            <span className="font-medium">{req.user?.firstName} {req.user?.lastName}</span>
                                                            <span className="block text-xs text-muted-foreground">{req.user?.email}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="bg-secondary/10 text-secondary text-[10px] px-2 py-1 rounded-full uppercase font-medium">
                                                                {req.requestType}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground">
                                                            {new Date(req.requestedAt).toLocaleDateString('fr-FR')}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-medium ${req.status === 'PENDING' ? 'bg-warning/10 text-warning' :
                                                                req.status === 'COMPLETED' ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]' :
                                                                    'bg-destructive/10 text-destructive'
                                                                }`}>
                                                                {req.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </PageGuard>
    );
}
