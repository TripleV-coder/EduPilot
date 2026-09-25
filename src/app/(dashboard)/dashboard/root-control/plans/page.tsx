"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
    Zap, Plus, Loader2, Users, HardDrive, GraduationCap,
    Pencil, Trash2, DollarSign, ListChecks, Search, FilterX, Star, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-shell";
import { PageError } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { fetcher } from "@/lib/fetcher";
import { SectionToolbar } from "@/components/ui/section-toolbar";
import { MetricCardPro } from "@/components/ui/metric-card-pro";
import { EmptyStateAction } from "@/components/ui/empty-state";
import { getErrorMessage } from "@/lib/utils/error-message";

type Plan = {
    id: string;
    name: string;
    code: string;
    description: string | null;
    maxStudents: number;
    maxTeachers: number;
    maxStorageGB: number;
    features: string[];
    priceMonthly: number | string;
    priceYearly: number | string;
    isActive: boolean;
    isFeatured: boolean;
    priceOnRequest: boolean;
    _count?: { schools: number };
};

type FormState = {
    name: string;
    code: string;
    description: string;
    maxStudents: string;
    maxTeachers: string;
    maxStorageGB: string;
    priceMonthly: string;
    priceYearly: string;
    features: string;
    isActive: boolean;
    isFeatured: boolean;
    priceOnRequest: boolean;
};

const EMPTY_FORM: FormState = {
    name: "", code: "", description: "",
    maxStudents: "500", maxTeachers: "50", maxStorageGB: "10",
    priceMonthly: "", priceYearly: "", features: "",
    isActive: true, isFeatured: false, priceOnRequest: false,
};

function toForm(plan: Plan): FormState {
    return {
        name: plan.name,
        code: plan.code,
        description: plan.description ?? "",
        maxStudents: String(plan.maxStudents),
        maxTeachers: String(plan.maxTeachers),
        maxStorageGB: String(plan.maxStorageGB),
        priceMonthly: String(Number(plan.priceMonthly)),
        priceYearly: String(Number(plan.priceYearly)),
        features: plan.features.join(", "),
        isActive: plan.isActive,
        isFeatured: plan.isFeatured,
        priceOnRequest: plan.priceOnRequest,
    };
}

async function send(method: "POST" | "PATCH" | "DELETE", body?: unknown, query = "") {
    const res = await fetch(`/api/root/plans${query}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "L'opération a échoué.");
    }
    return res;
}

export default function RootPlansPage() {
    const [editing, setEditing] = useState<Plan | "new" | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Plan | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const { data, error, isLoading, mutate } = useSWR<{ data: Plan[] }>("/api/root/plans", fetcher);
    const plans = useMemo(() => data?.data ?? [], [data]);

    const filteredPlans = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return plans;
        return plans.filter((plan) =>
            plan.name.toLowerCase().includes(query) ||
            plan.code.toLowerCase().includes(query) ||
            String(plan.description || "").toLowerCase().includes(query) ||
            plan.features.some((feature) => feature.toLowerCase().includes(query))
        );
    }, [plans, searchTerm]);

    const activePlansCount = plans.filter((plan) => plan.isActive).length;
    const subscribedSchools = plans.reduce((sum, plan) => sum + (plan._count?.schools ?? 0), 0);

    const openCreate = () => { setForm(EMPTY_FORM); setEditing("new"); };
    const openEdit = (plan: Plan) => { setForm(toForm(plan)); setEditing(plan); };
    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const payload = {
            name: form.name,
            code: form.code,
            description: form.description || null,
            maxStudents: form.maxStudents,
            maxTeachers: form.maxTeachers,
            maxStorageGB: form.maxStorageGB,
            priceMonthly: form.priceMonthly || "0",
            priceYearly: form.priceYearly || undefined,
            features: form.features.split(",").map((f) => f.trim()).filter(Boolean),
            isActive: form.isActive,
            isFeatured: form.isFeatured,
            priceOnRequest: form.priceOnRequest,
        };
        try {
            if (editing === "new") {
                await send("POST", payload);
                toast({ title: "Formule créée", description: "Elle apparaît sur la page tarifs si elle est active." });
            } else if (editing) {
                await send("PATCH", { id: editing.id, ...payload });
                toast({ title: "Formule mise à jour", description: "La page tarifs publique reflète déjà ce changement." });
            }
            setEditing(null);
            await mutate();
        } catch (err) {
            toast({ title: "Enregistrement impossible", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Un clic depuis la carte : pas besoin d'ouvrir le formulaire.
    const toggleActive = async (plan: Plan) => {
        setTogglingId(plan.id);
        try {
            await send("PATCH", { id: plan.id, isActive: !plan.isActive });
            await mutate();
        } catch (err) {
            toast({ title: "Changement impossible", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setTogglingId(null);
        }
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        const plan = pendingDelete;
        setPendingDelete(null);
        try {
            await send("DELETE", undefined, `?id=${encodeURIComponent(plan.id)}`);
            toast({ title: "Formule supprimée" });
            await mutate();
        } catch (err) {
            toast({ title: "Suppression impossible", description: getErrorMessage(err), variant: "destructive" });
        }
    };

    const suggestedYearly = Number(form.priceMonthly) > 0 ? Math.round(Number(form.priceMonthly) * 10) : null;

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Plans & tarifs"
                        description="Les formules actives sont publiées telles quelles sur la page tarifs du site."
                    />
                    <div className="flex gap-2">
                        <Button variant="outline" asChild className="gap-2 h-11">
                            <Link href="/#pricing" target="_blank" rel="noopener">
                                <ExternalLink className="w-4 h-4" aria-hidden="true" /> Voir la page tarifs
                            </Link>
                        </Button>
                        <Button onClick={openCreate} className="gap-2 h-11 px-6">
                            <Plus className="w-4 h-4" aria-hidden="true" /> Créer une formule
                        </Button>
                    </div>
                </div>

                {error ? <PageError message="Impossible de charger les formules." onRetry={() => void mutate()} /> : null}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCardPro label="Formules" value={plans.length} hint="Catalogue complet" icon={Zap} tone="primary" />
                    <MetricCardPro label="En vente" value={activePlansCount} hint="Publiées sur la page tarifs" icon={Star} tone="success" />
                    <MetricCardPro label="Écoles abonnées" value={subscribedSchools} hint="Tous plans confondus" icon={Users} tone="warning" />
                </div>

                <SectionToolbar
                    title="Recherche des formules"
                    description="Filtrez par nom, code, description ou fonctionnalité."
                    leading={
                        <div className="relative w-full sm:min-w-[320px]">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <Input
                                aria-label="Rechercher une formule"
                                placeholder="Ex : premium, API, 500 élèves…"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-background"
                            />
                        </div>
                    }
                    actions={
                        <Button type="button" variant="outline" onClick={() => setSearchTerm("")} disabled={!searchTerm} className="gap-2">
                            <FilterX className="w-4 h-4" aria-hidden="true" /> Réinitialiser
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        [1, 2, 3].map((i) => <Card key={i} className="h-[320px] animate-pulse bg-muted/50" />)
                    ) : filteredPlans.length === 0 && !error ? (
                        <div className="col-span-full">
                            <EmptyStateAction
                                icon={Zap}
                                title={searchTerm ? "Aucune formule pour ce filtre" : "Aucune formule configurée"}
                                description={searchTerm ? "Essayez une autre recherche." : "Créez la première formule : elle sera publiée sur la page tarifs dès qu'elle est active."}
                                actionLabel={searchTerm ? "Réinitialiser le filtre" : "Créer une formule"}
                                onAction={() => (searchTerm ? setSearchTerm("") : openCreate())}
                            />
                        </div>
                    ) : (
                        filteredPlans.map((plan) => {
                            const schools = plan._count?.schools ?? 0;
                            return (
                                <Card key={plan.id} className={cn("relative transition-shadow hover:shadow-lg", plan.isFeatured && "border-primary")}>
                                    <CardHeader className="pb-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                                    {plan.name}
                                                    {plan.isFeatured ? (
                                                        <Badge className="gap-1 text-[11px]"><Star className="w-3 h-3" aria-hidden="true" /> Mise en avant</Badge>
                                                    ) : null}
                                                </CardTitle>
                                                <CardDescription className="text-xs font-mono">{plan.code}</CardDescription>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Label htmlFor={`active-${plan.id}`} className="text-xs text-muted-foreground">
                                                    {plan.isActive ? "En vente" : "Retiré"}
                                                </Label>
                                                <Switch
                                                    id={`active-${plan.id}`}
                                                    checked={plan.isActive}
                                                    disabled={togglingId === plan.id}
                                                    onCheckedChange={() => void toggleActive(plan)}
                                                    aria-label={`${plan.isActive ? "Retirer de la vente" : "Mettre en vente"} : ${plan.name}`}
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-5">
                                        <div className="flex items-baseline gap-1">
                                            {plan.priceOnRequest ? (
                                                <span className="text-2xl font-bold">Sur devis</span>
                                            ) : (
                                                <>
                                                    <span className="text-3xl font-bold tabular-nums">{Number(plan.priceMonthly).toLocaleString("fr-FR")}</span>
                                                    <span className="text-xs text-muted-foreground">FCFA / mois · {Number(plan.priceYearly).toLocaleString("fr-FR")} / an</span>
                                                </>
                                            )}
                                        </div>

                                        <dl className="grid grid-cols-3 gap-2 py-3 border-y border-border/50 text-center">
                                            <div><dt className="text-[11px] text-muted-foreground">Élèves</dt><dd className="text-sm font-semibold tabular-nums">{plan.maxStudents}</dd></div>
                                            <div><dt className="text-[11px] text-muted-foreground">Enseignants</dt><dd className="text-sm font-semibold tabular-nums">{plan.maxTeachers}</dd></div>
                                            <div><dt className="text-[11px] text-muted-foreground">Stockage</dt><dd className="text-sm font-semibold tabular-nums">{plan.maxStorageGB} Go</dd></div>
                                        </dl>

                                        {plan.features.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {plan.features.map((f) => (
                                                    <Badge key={f} variant="outline" className="text-[11px]">{f}</Badge>
                                                ))}
                                            </div>
                                        ) : null}

                                        <p className="text-xs text-muted-foreground">
                                            {schools === 0 ? "Aucune école abonnée" : `${schools} école${schools > 1 ? "s" : ""} abonnée${schools > 1 ? "s" : ""}`}
                                        </p>

                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="flex-1 h-10 gap-2" onClick={() => openEdit(plan)} aria-label={`Modifier la formule ${plan.name}`}>
                                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Modifier
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-destructive hover:bg-destructive/10 max-md:h-11 max-md:w-11"
                                                onClick={() => setPendingDelete(plan)}
                                                aria-label={`Supprimer la formule ${plan.name}`}
                                            >
                                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>

            <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
                <DialogContent className="sm:max-w-[600px]">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <DialogHeader>
                            <DialogTitle>{editing === "new" ? "Nouvelle formule" : `Modifier « ${editing?.name ?? ""} »`}</DialogTitle>
                            <DialogDescription>Prix, quotas et affichage sur la page tarifs publique.</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="plan-name">Nom</Label>
                                    <Input id="plan-name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex : Professionnel" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="plan-code">Code technique</Label>
                                    <Input id="plan-code" value={form.code} onChange={(e) => update("code", e.target.value)} placeholder="Ex : PRO" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="plan-description">Description courte</Label>
                                <Input id="plan-description" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Pour qui est cette formule ?" />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="plan-students" className="flex items-center gap-1.5"><Users className="w-3 h-3" aria-hidden="true" /> Élèves</Label>
                                    <Input id="plan-students" type="number" min={0} inputMode="numeric" value={form.maxStudents} onChange={(e) => update("maxStudents", e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="plan-teachers" className="flex items-center gap-1.5"><GraduationCap className="w-3 h-3" aria-hidden="true" /> Enseignants</Label>
                                    <Input id="plan-teachers" type="number" min={0} inputMode="numeric" value={form.maxTeachers} onChange={(e) => update("maxTeachers", e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="plan-storage" className="flex items-center gap-1.5"><HardDrive className="w-3 h-3" aria-hidden="true" /> Go</Label>
                                    <Input id="plan-storage" type="number" min={0} inputMode="numeric" value={form.maxStorageGB} onChange={(e) => update("maxStorageGB", e.target.value)} required />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                <div>
                                    <Label htmlFor="plan-on-request">Prix sur devis</Label>
                                    <p className="text-xs text-muted-foreground">Le prix n&apos;est pas affiché publiquement.</p>
                                </div>
                                <Switch id="plan-on-request" checked={form.priceOnRequest} onCheckedChange={(v) => update("priceOnRequest", v)} />
                            </div>

                            {!form.priceOnRequest ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="plan-monthly" className="flex items-center gap-1.5"><DollarSign className="w-3 h-3" aria-hidden="true" /> Prix mensuel (FCFA)</Label>
                                        <Input id="plan-monthly" type="number" min={0} inputMode="numeric" value={form.priceMonthly} onChange={(e) => update("priceMonthly", e.target.value)} placeholder="0 = gratuit" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="plan-yearly" className="flex items-center gap-1.5"><DollarSign className="w-3 h-3" aria-hidden="true" /> Prix annuel (FCFA)</Label>
                                        <Input id="plan-yearly" type="number" min={0} inputMode="numeric" value={form.priceYearly} onChange={(e) => update("priceYearly", e.target.value)} placeholder={suggestedYearly ? `Suggéré : ${suggestedYearly.toLocaleString("fr-FR")}` : ""} />
                                        {suggestedYearly && !form.priceYearly ? (
                                            <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => update("priceYearly", String(suggestedYearly))}>
                                                Utiliser {suggestedYearly.toLocaleString("fr-FR")} (2 mois offerts)
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="plan-features" className="flex items-center gap-1.5"><ListChecks className="w-3 h-3" aria-hidden="true" /> Fonctionnalités (séparées par des virgules)</Label>
                                <Input id="plan-features" value={form.features} onChange={(e) => update("features", e.target.value)} placeholder="Ex : Bulletins PDF, SMS parents, Paiement MoMo" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                    <Label htmlFor="plan-active">En vente</Label>
                                    <Switch id="plan-active" checked={form.isActive} onCheckedChange={(v) => update("isActive", v)} />
                                </div>
                                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                                    <Label htmlFor="plan-featured">Mettre en avant</Label>
                                    <Switch id="plan-featured" checked={form.isFeatured} onCheckedChange={(v) => update("isFeatured", v)} />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
                title={`Supprimer « ${pendingDelete?.name ?? ""} » ?`}
                description={
                    pendingDelete && (pendingDelete._count?.schools ?? 0) > 0
                        ? "Des écoles utilisent cette formule : la suppression sera refusée. Retirez-la plutôt de la vente."
                        : "La formule disparaîtra du catalogue et de la page tarifs."
                }
                confirmLabel="Supprimer"
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}
