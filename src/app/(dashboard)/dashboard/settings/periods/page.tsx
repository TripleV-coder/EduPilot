"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { CalendarRange, Plus, CheckCircle2, Clock, CalendarX, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type Period = {
    id: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    sequence: number;
    academicYearId: string;
};

function getPeriodStatus(startDate: string, endDate: string): { label: string; style: string; icon: React.ReactNode } {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now >= start && now <= end) {
        return {
            label: "En cours",
            style: "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))]",
            icon: <CheckCircle2 className="w-3 h-3" />,
        };
    } else if (now > end) {
        return {
            label: "Termin\u00e9",
            style: "bg-muted text-muted-foreground border-border",
            icon: <CalendarX className="w-3 h-3" />,
        };
    } else {
        return {
            label: "Planifi\u00e9",
            style: "bg-muted text-muted-foreground border-border",
            icon: <Clock className="w-3 h-3" />,
        };
    }
}

function getWeeksBetween(start: string, end: string): number {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

export default function AcademicPeriodsPage() {
    const { toast } = useToast();
    const { mutate } = useSWRConfig();
    const [selectedYearId, setSelectedYearId] = useState<string>("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
    const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState("TRIMESTER");
    const [formStart, setFormStart] = useState("");
    const [formEnd, setFormEnd] = useState("");
    const [formSequence, setFormSequence] = useState(1);

    const { data: yearsData, isLoading: yearsLoading } = useSWR<any[]>("/api/academic-years", fetcher);
    const academicYears = Array.isArray(yearsData) ? yearsData : [];

    // Auto-select current year
    if (!selectedYearId && academicYears.length > 0) {
        const current = academicYears.find((y: any) => y.isCurrent);
        if (current) {
            setSelectedYearId(current.id);
        } else {
            setSelectedYearId(academicYears[0].id);
        }
    }

    const periodsKey = selectedYearId ? `/api/periods?academicYearId=${selectedYearId}` : null;
    const { data: periodsData, isLoading: periodsLoading } = useSWR<Period[]>(periodsKey, fetcher);
    const periods = Array.isArray(periodsData) ? periodsData : [];

    const resetForm = () => {
        setFormName("");
        setFormType("TRIMESTER");
        setFormStart("");
        setFormEnd("");
        setFormSequence(periods.length + 1);
        setEditingId(null);
        setShowForm(false);
    };

    const startEdit = (p: Period) => {
        setFormName(p.name);
        setFormType(p.type);
        setFormStart(new Date(p.startDate).toISOString().split("T")[0]);
        setFormEnd(new Date(p.endDate).toISOString().split("T")[0]);
        setFormSequence(p.sequence);
        setEditingId(p.id);
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!formName || !formStart || !formEnd) {
            toast({ title: "Erreur", description: "Veuillez remplir tous les champs.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                const res = await fetch(`/api/periods/${editingId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName, startDate: formStart, endDate: formEnd, sequence: formSequence }),
                });
                if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erreur"); }
                toast({ title: "Succ\u00e8s", description: "P\u00e9riode modifi\u00e9e." });
            } else {
                const res = await fetch("/api/periods", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formName, type: formType, startDate: formStart, endDate: formEnd,
                        sequence: formSequence, academicYearId: selectedYearId,
                    }),
                });
                if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erreur"); }
                toast({ title: "Succ\u00e8s", description: "P\u00e9riode cr\u00e9\u00e9e." });
            }
            mutate(periodsKey);
            resetForm();
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleteConfirmLoading(true);
        try {
            const res = await fetch(`/api/periods/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Erreur");
            }
            toast({ title: "Succès", description: "Période supprimée." });
            mutate(periodsKey);
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsDeleteConfirmLoading(false);
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        }
    };

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));

    return (
        <PageGuard permission={["*" as Permission]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="S\u00e9quences et P\u00e9riodes"
                        description="D\u00e9coupez l'ann\u00e9e scolaire en trimestres ou semestres"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Param\u00e8tres" },
                            { label: "P\u00e9riodes" },
                        ]}
                    />
                    <div className="flex items-center gap-3">
                        <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears.map((y: any) => (
                                    <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button className="gap-2 shadow-sm" onClick={() => { resetForm(); setShowForm(true); setFormSequence(periods.length + 1); }}>
                            <Plus className="w-4 h-4" />
                            Nouvelle P\u00e9riode
                        </Button>
                    </div>
                </div>

                <ConfirmActionDialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) setDeleteTarget(null);
                    }}
                    title="Supprimer la période"
                    description={deleteTarget ? `Cette action supprimera "${deleteTarget.name}".` : undefined}
                    confirmLabel={t("common.delete")}
                    cancelLabel={t("common.cancel")}
                    variant="destructive"
                    isConfirmLoading={isDeleteConfirmLoading}
                    onConfirm={confirmDelete}
                />

                {/* Create/Edit Form */}
                {showForm && (
                    <Card className="border-primary/30 shadow-sm">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold">{editingId ? "Modifier la p\u00e9riode" : "Nouvelle p\u00e9riode"}</h3>
                                <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nom</Label>
                                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={formType} onValueChange={setFormType} disabled={!!editingId}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TRIMESTER">Trimestre</SelectItem>
                                            <SelectItem value="SEMESTER">Semestre</SelectItem>
                                            <SelectItem value="HYBRID">Hybride</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date de d\u00e9but</Label>
                                    <Input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Date de fin</Label>
                                    <Input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Num\u00e9ro de s\u00e9quence</Label>
                                    <Input type="number" min={1} value={formSequence} onChange={(e) => setFormSequence(Number(e.target.value))} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={resetForm}>{t("common.cancel")}</Button>
                                <Button onClick={handleSave} disabled={saving} className="gap-2">
                                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    <Save className="h-4 w-4" />
                                    {editingId ? t("common.save") : t("common.create")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Loading */}
                {(yearsLoading || periodsLoading) && (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {/* Empty state */}
                {!periodsLoading && periods.length === 0 && selectedYearId && (
                    <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                        <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Aucune p\u00e9riode d\u00e9finie</h3>
                        <p className="text-sm text-muted-foreground mt-2">Cr\u00e9ez des p\u00e9riodes pour cette ann\u00e9e scolaire.</p>
                    </div>
                )}

                {/* Periods list */}
                <div className="grid gap-6">
                    {periods.map((period) => {
                        const status = getPeriodStatus(period.startDate, period.endDate);
                        const weeks = getWeeksBetween(period.startDate, period.endDate);
                        const isCurrent = status.label === "En cours";

                        return (
                            <Card
                                key={period.id}
                                className={`border-border shadow-sm overflow-hidden ${isCurrent ? "border-primary/20 bg-primary/5" : ""}`}
                            >
                                {isCurrent && <div className="h-1 w-full bg-primary" />}
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className={`text-xl font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                                                    {period.name}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 border ${status.style}`}>
                                                    {status.icon} {status.label}
                                                </span>
                                            </div>
                                            <p className="text-sm text-foreground mb-4">
                                                Du <strong>{formatDate(period.startDate)}</strong> au <strong>{formatDate(period.endDate)}</strong>
                                            </p>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <CalendarRange className="w-4 h-4" /> {weeks} Semaines
                                                </span>
                                                <span>S\u00e9quence: <strong className="text-foreground">{period.sequence}</strong></span>
                                                <span>Type: <strong className="text-foreground">{period.type === "TRIMESTER" ? "Trimestre" : period.type === "SEMESTER" ? "Semestre" : "Hybride"}</strong></span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => startEdit(period)}>Modifier</Button>
                                            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(period.id, period.name)}>Supprimer</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </PageGuard>
    );
}
