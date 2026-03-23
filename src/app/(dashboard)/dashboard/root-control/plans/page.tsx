"use client";

import { useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Zap, Plus, Loader2, 
  Users, HardDrive, GraduationCap, 
  Edit, Trash2, DollarSign, ListChecks
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

type Plan = {
    id: string;
    name: string;
    code: string;
    description: string | null;
    maxStudents: number;
    maxTeachers: number;
    maxStorageGB: number;
    features: string[];
    priceMonthly: number;
    priceYearly: number;
    isActive: boolean;
};

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error("Erreur serveur");
    return res.json();
});

export default function RootPlansPage() {
    const [searchTerm] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { data, isLoading, mutate } = useSWR<{ data: Plan[] }>(
        "/api/root/plans",
        fetcher
    );

    const plans = data?.data || [];
    const filteredPlans = plans.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreatePlan = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const payload = {
            name: formData.get("name") as string,
            code: formData.get("code") as string,
            description: formData.get("description") as string,
            maxStudents: parseInt(formData.get("maxStudents") as string),
            maxTeachers: parseInt(formData.get("maxTeachers") as string),
            maxStorageGB: parseInt(formData.get("maxStorageGB") as string),
            priceMonthly: parseFloat(formData.get("priceMonthly") as string),
            priceYearly: parseFloat(formData.get("priceYearly") as string),
            features: (formData.get("features") as string).split(",").map(f => f.trim()).filter(f => f !== ""),
            isActive: true,
        };

        try {
            const res = await fetch("/api/root/plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erreur lors de la création");
            }

            toast({ title: "Succès", description: "La formule d'accès a été créée." });
            setIsCreateDialogOpen(false);
            mutate();
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Plans & Formules d'Accès"
                        description="Gérez les offres commerciales et les limites techniques par type d'abonnement."
                    />
                    
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-lg bg-primary hover:bg-primary/90 text-white border-0 transition-all active:scale-95 px-6">
                                <Plus className="w-4 h-4" />
                                Créer une Formule
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] overflow-hidden p-0 border-0 shadow-2xl">
                            <form onSubmit={handleCreatePlan} className="flex flex-col">
                                <DialogHeader className="p-6 bg-slate-950 text-white">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <DialogTitle className="text-xl font-bold">Nouvelle Formule</DialogTitle>
                                    </div>
                                    <DialogDescription className="text-slate-400">
                                        Définissez les quotas et les prix pour ce nouveau plan tarifaire.
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Nom du plan</Label>
                                            <Input id="name" name="name" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="code">Code technique</Label>
                                            <Input id="code" name="code" required />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description courte</Label>
                                        <Input id="description" name="description" />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><Users className="w-3 h-3 text-primary"/> Élèves max</Label>
                                            <Input type="number" name="maxStudents" defaultValue="500" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><GraduationCap className="w-3 h-3 text-primary"/> Profs max</Label>
                                            <Input type="number" name="maxTeachers" defaultValue="50" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><HardDrive className="w-3 h-3 text-primary"/> Stockage (GB)</Label>
                                            <Input type="number" name="maxStorageGB" defaultValue="10" required />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><DollarSign className="w-3 h-3 text-emerald-500"/> Prix Mensuel (FCFA)</Label>
                                            <Input type="number" name="priceMonthly" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2"><DollarSign className="w-3 h-3 text-emerald-500"/> Prix Annuel (FCFA)</Label>
                                            <Input type="number" name="priceYearly" required />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2"><ListChecks className="w-3 h-3 text-blue-500"/> Fonctionnalités (séparées par des virgules)</Label>
                                        <Input id="features" name="features" />
                                    </div>
                                </div>

                                <DialogFooter className="p-6 bg-muted/20 border-t">
                                    <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enregistrer la formule
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {isLoading ? (
                        [1, 2, 3].map(i => <Card key={i} className="h-[300px] animate-pulse bg-muted/50" />)
                    ) : filteredPlans.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-muted/10">
                            <Zap className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-muted-foreground font-medium">Aucun plan tarifaire configuré.</p>
                        </div>
                    ) : (
                        filteredPlans.map((plan) => (
                            <Card key={plan.id} className={cn(
                                "relative overflow-hidden border-border/50 hover:border-primary/30 transition-all group hover:shadow-xl",
                                !plan.isActive && "opacity-60"
                            )}>
                                <div className="absolute top-0 right-0 p-4">
                                    <Badge variant={plan.isActive ? "default" : "secondary"} className="text-[10px] font-black uppercase tracking-widest">
                                        {plan.isActive ? "Actif" : "Désactivé"}
                                    </Badge>
                                </div>
                                <CardHeader className="pb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                                    <CardDescription className="text-xs font-mono font-bold text-primary/60">{plan.code}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black">{Number(plan.priceMonthly).toLocaleString()}</span>
                                        <span className="text-xs text-muted-foreground font-bold uppercase">FCFA / mois</span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 py-4 border-y border-border/50">
                                        <div className="text-center">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Élèves</p>
                                            <p className="text-sm font-bold">{plan.maxStudents}</p>
                                        </div>
                                        <div className="text-center border-x border-border/50">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Profs</p>
                                            <p className="text-sm font-bold">{plan.maxTeachers}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Data</p>
                                            <p className="text-sm font-bold">{plan.maxStorageGB}GB</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 min-h-[100px]">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fonctionnalités</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {plan.features.map((f, i) => (
                                                <Badge key={i} variant="outline" className="text-[9px] py-0 px-1.5 font-bold border-primary/20 text-primary/80">
                                                    {f}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" size="sm" className="flex-1 h-9 gap-2 text-[11px] font-bold uppercase tracking-tight">
                                            <Edit className="w-3.5 h-3.5" /> Modifier
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </PageGuard>
    );
}
