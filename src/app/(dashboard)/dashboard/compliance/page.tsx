"use client";

import { useCallback, useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { ShieldCheck, FileText, Download, Users, AlertTriangle, Loader2, AlertCircle, Clock, CheckCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/utils/formatters";
import { getComplianceRequestStatusClass } from "@/lib/ui/status-styles";
import { getErrorMessage } from "@/lib/utils/error-message";



type ComplianceDashboard = {
    overallScore: number;
    consentRate: number;
    pendingPolicies: number;
    dataRequestsSummary: { pending: number; completed: number; total: number };
    retentionStatus: { compliant: number; overdue: number };
};

type DataRequest = {
    id: string;
    type: string;
    status: string;
    requestedAt: string;
    user?: { firstName: string; lastName: string; email: string };
};

export default function ComplianceDashboardPage() {
    const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
    const [requests, setRequests] = useState<DataRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fulfillingId, setFulfillingId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch("/api/compliance/dashboard", { credentials: "include" }).then(r => {
                if (!r.ok) throw new Error("Erreur de chargement du tableau de conformité");
                return r.json();
            }),
            fetch("/api/compliance/data-requests", { credentials: "include" }).then(r => {
                if (!r.ok) return { requests: [] };
                return r.json();
            }),
        ])
            .then(([dashData, reqData]) => {
                if (!cancelled) {
                    setDashboard(dashData);
                    setRequests(Array.isArray(reqData) ? reqData : reqData.requests ?? []);
                }
            })
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const handleFulfill = useCallback(async (requestId: string) => {
        setFulfillingId(requestId);
        try {
            const res = await fetch(`/api/compliance/data-requests/${requestId}/fulfill`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Erreur lors du traitement");
            }
            toast.success("Demande traitée avec succès");
            setRequests(prev => prev.map(r =>
                r.id === requestId ? { ...r, status: "COMPLETED" } : r
            ));
        } catch (e) {
            toast.error(getErrorMessage(e) || "Erreur lors du traitement de la demande");
        } finally {
            setFulfillingId(null);
        }
    }, []);

    const statusBadge = (status: string) => {
        return getComplianceRequestStatusClass(status);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
        );
    }

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title="Conformité RGPD"
                    description="Centre de contrôle de la protection des données personnelles de votre établissement."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Conformité" },
                    ]}
                />

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {dashboard && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-border shadow-sm border-t-4 border-t-success">
                                <CardContent className="pt-6 text-center">
                                    <ShieldCheck className="w-8 h-8 text-success mx-auto mb-2" />
                                    <h3 className="text-3xl font-bold text-success">{dashboard.overallScore ?? 85}%</h3>
                                    <p className="text-sm font-medium mt-1 text-success">Score de Conformité</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6 text-center">
                                    <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                                    <h3 className="text-3xl font-bold">{dashboard.consentRate ?? 100}%</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Consentements Parents</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm border-t-4 border-t-warning">
                                <CardContent className="pt-6 text-center">
                                    <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                                    <h3 className="text-3xl font-bold">{dashboard.pendingPolicies ?? 0}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Politiques à revoir</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-border shadow-sm">
                                <CardHeader className="bg-muted/10 border-b border-border">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Demandes RGPD ({dashboard.dataRequestsSummary?.total ?? 0})
                                    </CardTitle>
                                    <CardDescription>
                                        {dashboard.dataRequestsSummary?.pending ?? 0} en attente · {dashboard.dataRequestsSummary?.completed ?? 0} traitées
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {requests.length === 0 ? (
                                        <div className="text-center py-8">
                                            <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                            <p className="font-medium text-foreground">Aucune demande en attente</p>
                                            <p className="text-sm text-muted-foreground">Toutes les requêtes RGPD ont été traitées.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {requests.slice(0, 10).map((req) => (
                                                <div key={req.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                                    <div>
                                                        <h4 className="font-semibold text-sm">
                                                            {req.user ? `${req.user.firstName} ${req.user.lastName}` : req.id}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {req.type === "ACCESS" ? "Droit d'accès" : req.type === "DELETE" ? "Droit à l'oubli" : req.type === "EXPORT" ? "Portabilité" : req.type} · {formatDateShort(req.requestedAt)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {(req.status === "PENDING" || req.status === "IN_PROGRESS") && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-xs gap-1"
                                                                disabled={fulfillingId === req.id}
                                                                onClick={() => handleFulfill(req.id)}
                                                            >
                                                                {fulfillingId === req.id
                                                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                                                    : <Play className="w-3 h-3" />}
                                                                Traiter
                                                            </Button>
                                                        )}
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(req.status)}`}>
                                                            {req.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardHeader className="bg-muted/10 border-b border-border">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-primary" />
                                        Rétention des données
                                    </CardTitle>
                                    <CardDescription>Statut du respect des politiques de rétention.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-success/10 border-success/30">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-success" />
                                            <span className="text-sm font-medium">Conformes</span>
                                        </div>
                                        <span className="text-lg font-bold text-success">{dashboard.retentionStatus?.compliant ?? 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-warning/10 border-warning/30">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-warning" />
                                            <span className="text-sm font-medium">En retard</span>
                                        </div>
                                        <span className="text-lg font-bold text-warning">{dashboard.retentionStatus?.overdue ?? 0}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </PageGuard>
    );
}
