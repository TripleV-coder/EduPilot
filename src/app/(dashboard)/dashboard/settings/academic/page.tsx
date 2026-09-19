"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { Calendar, Plus, Save, AlertCircle, CheckCircle, Lock, LockOpen } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useRBAC } from "@/lib/hooks/use-rbac";
import { t } from "@/lib/i18n";
import { getErrorMessage } from "@/lib/utils/error-message";

type AcademicYear = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    status: "PLANNING" | "ACTIVE" | "ARCHIVED" | "CLOSED";
};

type StatusAction = { year: AcademicYear; action: "close" | "reopen"; activeEnrollments?: number };

const isLocked = (year: AcademicYear) => year.status === "CLOSED" || year.status === "ARCHIVED";

export default function AcademicSettingsPage() {
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [isAdding, setIsAdding] = useState(false);
    const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
    const [changingStatus, setChangingStatus] = useState(false);
    const { canAccess } = useRBAC();
    const canClose = canAccess({ permission: Permission.ACADEMIC_YEAR_CLOSE });
    const canReopen = canAccess({ roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"], permission: Permission.ACADEMIC_YEAR_CLOSE });

    const fetchYears = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/academic-years");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur lors du chargement");
            setYears(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchYears();
    }, []);

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
    };

    const handleCreateYear = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const payload = {
            name: formData.get("name"),
            startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string).toISOString() : undefined,
            endDate: formData.get("endDate") ? new Date(formData.get("endDate") as string).toISOString() : undefined,
            isCurrent: formData.get("isCurrent") === "on",
        };

        try {
            const res = await fetch("/api/academic-years", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Une erreur est survenue");
            }

            setIsAdding(false);
            showSuccess("Année académique créée avec succès");
            fetchYears();
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async () => {
        if (!pendingAction) return;
        const { year, action, activeEnrollments } = pendingAction;
        setChangingStatus(true);
        setError(null);
        try {
            const res = await fetch(`/api/academic-years/${year.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                // Le second passage confirme une clôture malgré des élèves non promus.
                body: JSON.stringify(action === "close" ? { action, force: activeEnrollments !== undefined } : { action }),
            });
            const data = await res.json();
            if (res.status === 409 && data.code === "ACTIVE_ENROLLMENTS") {
                setPendingAction({ year, action, activeEnrollments: data.activeEnrollments });
                return;
            }
            if (!res.ok) throw new Error(data.error || "Une erreur est survenue");
            setPendingAction(null);
            showSuccess(action === "close" ? `Année ${year.name} clôturée` : `Année ${year.name} rouverte`);
            fetchYears();
        } catch (err) {
            setPendingAction(null);
            setError(getErrorMessage(err));
        } finally {
            setChangingStatus(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE}>
            <div className="space-y-6 max-w-5xl mx-auto pb-24">
                <PageHeader
                    title="Années Académiques"
                    description="Gérer le calendrier scolaire (années, trimestres, semestres)"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Années Académiques" },
                    ]}
                />

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {successMsg && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{successMsg}</p>
                    </div>
                )}

                <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Configuration du Calendrier</h2>
                            <p className="text-sm text-muted-foreground">Création de la chronologie de votre établissement.</p>
                        </div>
                    </div>
                    {!isAdding && (
                        <Button onClick={() => setIsAdding(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nouvelle Année
                        </Button>
                    )}
                </div>

                {isAdding && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Ajouter une Année Scolaire</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateYear} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="name">Nom de l'année <span className="text-destructive">*</span></Label>
                                        <Input id="name" name="name" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="startDate">Date de Début <span className="text-destructive">*</span></Label>
                                        <Input id="startDate" name="startDate" type="date" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="endDate">Date de Fin <span className="text-destructive">*</span></Label>
                                        <Input id="endDate" name="endDate" type="date" required />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="isCurrent" name="isCurrent" className="rounded border-border text-primary focus:ring-primary" />
                                    <Label htmlFor="isCurrent" className="font-normal cursor-pointer">Définir comme l'année académique active actuelle (l'année actuelle perd ce statut, sans être clôturée)</Label>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={saving} className="gap-2">
                                        {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Save className="h-4 w-4" />}
                                        {t("common.create")}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4">
                    {loading ? (
                        <div className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
                    ) : years.length === 0 ? (
                        <div className="text-center py-16 border border-dashed rounded-xl bg-muted/30">
                            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium">Aucune année académique</h3>
                            <p className="text-sm text-muted-foreground mt-1">Commencez par créer l'année en cours.</p>
                        </div>
                    ) : (
                        years.map((year) => (
                            <Card key={year.id} className={`transition-all ${year.isCurrent ? "border-secondary/50 shadow-sm ring-1 ring-secondary/20" : "border-border opacity-70"}`}>
                                <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-bold text-lg">{year.name}</h3>
                                            {isLocked(year) && (
                                                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
                                                    <Lock className="h-3 w-3" />
                                                    {year.status === "ARCHIVED" ? "Archivée" : "Clôturée"}
                                                </span>
                                            )}
                                            {year.isCurrent && (
                                                <span className="bg-secondary/10 text-secondary dark:bg-secondary/20 text-xs px-2 py-0.5 rounded-full font-medium">
                                                    Année Active Actuelle
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Du {new Date(year.startDate).toLocaleDateString()} au {new Date(year.endDate).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isLocked(year) ? (
                                            canReopen && year.status === "CLOSED" && (
                                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setPendingAction({ year, action: "reopen" })}>
                                                    <LockOpen className="h-4 w-4" />
                                                    Rouvrir
                                                </Button>
                                            )
                                        ) : (
                                            canClose && (
                                                <Button variant="outline" size="sm" className="gap-2" onClick={() => setPendingAction({ year, action: "close" })}>
                                                    <Lock className="h-4 w-4" />
                                                    Clôturer
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && !changingStatus && setPendingAction(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {pendingAction?.action === "close" ? `Clôturer l'année ${pendingAction.year.name} ?` : `Rouvrir l'année ${pendingAction?.year.name} ?`}
                            </DialogTitle>
                            <DialogDescription>
                                {pendingAction?.action === "close"
                                    ? "Les notes, évaluations et présences de cette année seront figées : plus aucune saisie ni modification ne sera acceptée. Seule l'administration pourra la rouvrir."
                                    : "Les notes, évaluations et présences de cette année redeviendront modifiables. Cette action est journalisée."}
                            </DialogDescription>
                        </DialogHeader>
                        {pendingAction?.activeEnrollments !== undefined && (
                            <div className="p-3 rounded-lg bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] text-sm flex gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <p>
                                    {pendingAction.activeEnrollments} inscription(s) sont encore actives : ces élèves n'ont pas été promus.
                                    Effectuez la promotion avant de clôturer, ou confirmez pour clôturer quand même.
                                </p>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" disabled={changingStatus} onClick={() => setPendingAction(null)}>{t("common.cancel")}</Button>
                            <Button
                                variant={pendingAction?.action === "close" ? "destructive" : "default"}
                                disabled={changingStatus}
                                onClick={handleStatusChange}
                                className="gap-2"
                            >
                                {changingStatus && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />}
                                {pendingAction?.action === "close"
                                    ? pendingAction.activeEnrollments !== undefined ? "Clôturer quand même" : "Clôturer"
                                    : "Rouvrir"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </PageGuard>
    );
}
