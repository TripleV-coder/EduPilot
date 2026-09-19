"use client";

import { useCallback, useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, FileText, Users, AlertTriangle, Loader2, AlertCircle, Clock, CheckCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/utils/formatters";
import { getComplianceRequestStatusClass } from "@/lib/ui/status-styles";
import { getErrorMessage } from "@/lib/utils/error-message";
import { fetchAllPages } from "@/lib/api/fetch-all-pages";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRetentionPolicies, type RetentionPlanItem } from "@/hooks/use-retention-policies";



// N59 : ces champs sont renvoyés par /api/compliance/dashboard (ils ne l'étaient
// pas : la page affichait ses valeurs de repli, 85 % et 100 %).
type ComplianceDashboard = {
    overallScore: number;
    /** null tant que le taux n'est pas réellement mesuré. */
    consentRate: number | null;
    /** Règles de conservation inactives, à revoir et activer. */
    pendingPolicies: number;
    dataRequestsSummary: { pending: number; completed: number; total: number };
    retentionStatus: { active: number; inactive: number };
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
    EXPORT: "Export des données",
    RECTIFICATION: "Rectification",
    DELETION: "Droit à l'effacement",
    PORTABILITY: "Portabilité",
};

// Ce que la purge fait réellement, pour que l'école sache avant d'activer.
const RETENTION_ACTION_LABELS: Record<string, string> = {
    deactivate: "Ferme le compte et efface les coordonnées",
    anonymize: "Anonymise définitivement",
    delete: "Efface définitivement",
    report: "Signale seulement, n'efface jamais",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
    PENDING: "En attente",
    IN_PROGRESS: "En cours",
    COMPLETED: "Traitée",
    REJECTED: "Refusée",
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
    const retention = useRetentionPolicies();
    const [draftMonths, setDraftMonths] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch("/api/compliance/dashboard", { credentials: "include" }).then(r => {
                if (!r.ok) throw new Error("Erreur de chargement du tableau de conformité");
                return r.json();
            }),
            // Toutes les demandes (droits des personnes) : jamais tronquées aux 20 premières.
            fetchAllPages<DataRequest>("/api/compliance/data-requests").catch(() => {
                toast.error("Impossible de charger les demandes relatives aux données personnelles.");
                return [] as DataRequest[];
            }),
        ])
            .then(([dashData, reqData]) => {
                if (!cancelled) {
                    setDashboard(dashData);
                    setRequests(reqData);
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
            <PageShell>
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
                                    <h3 className="text-3xl font-bold text-success">{dashboard.overallScore}%</h3>
                                    <p className="text-sm font-medium mt-1 text-success">Score de Conformité</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6 text-center">
                                    <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                                    <h3 className="text-3xl font-bold">
                                        {dashboard.consentRate === null ? "—" : `${dashboard.consentRate}%`}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Comptes ayant accepté les conditions{dashboard.consentRate === null ? " · non mesuré" : ""}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm border-t-4 border-t-warning">
                                <CardContent className="pt-6 text-center">
                                    <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                                    <h3 className="text-3xl font-bold">{dashboard.pendingPolicies}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Règles de conservation à activer</p>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-border shadow-sm">
                                <CardHeader className="bg-muted/10 border-b border-border">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Demandes RGPD ({dashboard.dataRequestsSummary.total})
                                    </CardTitle>
                                    <CardDescription>
                                        {dashboard.dataRequestsSummary.pending} en attente · {dashboard.dataRequestsSummary.completed} traitées
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
                                                            {REQUEST_TYPE_LABELS[req.type] ?? req.type} · {formatDateShort(req.requestedAt)}
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
                                                            {REQUEST_STATUS_LABELS[req.status] ?? req.status}
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
                                    <CardDescription>Règles de conservation de votre établissement.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-success/10 border-success/30">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="w-5 h-5 text-success" />
                                            <span className="text-sm font-medium">Règles actives</span>
                                        </div>
                                        <span className="text-lg font-bold text-success">{dashboard.retentionStatus.active}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-warning/10 border-warning/30">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-warning" />
                                            <span className="text-sm font-medium">Règles à activer</span>
                                        </div>
                                        <span className="text-lg font-bold text-warning">{dashboard.retentionStatus.inactive}</span>
                                    </div>

                                    {retention.error && (
                                        <p className="text-sm text-destructive">{retention.error}</p>
                                    )}
                                    {!retention.items && !retention.error && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                                            <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
                                            Chargement des règles…
                                        </div>
                                    )}
                                    {retention.items?.length === 0 && !retention.error && (
                                        <p className="text-sm text-muted-foreground">Aucune règle de conservation pour cet établissement.</p>
                                    )}

                                    {retention.items?.map((item: RetentionPlanItem) => (
                                        <div key={item.dataType} className="p-4 border rounded-lg space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium">{item.label}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {RETENTION_ACTION_LABELS[item.action] ?? item.action} · {item.affected} élément(s) concerné(s) aujourd&apos;hui
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={item.isActive}
                                                    disabled={retention.savingType === item.dataType}
                                                    aria-label={`Activer la règle « ${item.label} »`}
                                                    onCheckedChange={async (checked) => {
                                                        const res = await retention.update(item.dataType, { isActive: checked });
                                                        if (res.ok) toast.success(checked ? "Règle activée" : "Règle désactivée");
                                                        else toast.error(res.message);
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-end gap-2">
                                                <div className="flex-1">
                                                    <label className="text-xs text-muted-foreground" htmlFor={`months-${item.dataType}`}>
                                                        Durée de conservation (mois)
                                                    </label>
                                                    <Input
                                                        id={`months-${item.dataType}`}
                                                        type="number"
                                                        min={1}
                                                        max={600}
                                                        value={draftMonths[item.dataType] ?? String(item.months)}
                                                        onChange={(e) => setDraftMonths((prev) => ({ ...prev, [item.dataType]: e.target.value }))}
                                                    />
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    disabled={
                                                        retention.savingType === item.dataType ||
                                                        Number(draftMonths[item.dataType] ?? item.months) === item.months
                                                    }
                                                    onClick={async () => {
                                                        const months = Number(draftMonths[item.dataType] ?? item.months);
                                                        if (!Number.isInteger(months) || months < 1) {
                                                            toast.error("Indiquez un nombre de mois entier, au moins 1.");
                                                            return;
                                                        }
                                                        const res = await retention.update(item.dataType, { months });
                                                        if (res.ok) {
                                                            setDraftMonths((prev) => { const next = { ...prev }; delete next[item.dataType]; return next; });
                                                            toast.success("Durée enregistrée");
                                                        } else {
                                                            toast.error(res.message);
                                                        }
                                                    }}
                                                >
                                                    {retention.savingType === item.dataType ? (
                                                        <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />
                                                    ) : (
                                                        "Enregistrer"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </PageShell>
        </PageGuard>
    );
}
