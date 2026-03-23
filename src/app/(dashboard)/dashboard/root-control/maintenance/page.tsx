"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Wrench, ShieldAlert, PowerSquare, TerminalSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function RootMaintenancePage() {
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        let cancelled = false;
        fetch("/api/root/system/maintenance", { credentials: "include", cache: "no-store" })
            .then(res => res.json())
            .then(data => {
                if (!cancelled) {
                    setIsMaintenance(data.enabled === true || data.enabled === "true");
                    setLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const toggleMaintenance = async () => {
        setToggling(true);
        try {
            const res = await fetch("/api/root/system/maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !isMaintenance }),
                credentials: "include", cache: "no-store",
            });
            if (!res.ok) throw new Error("Échec du changement de statut");
            const data = await res.json();
            setIsMaintenance(data.enabled);
            toast({
                title: "Statut mis à jour",
                description: `Mode maintenance ${data.enabled ? "ACTIVÉ" : "DÉSACTIVÉ"} avec succès.`,
                variant: data.enabled ? "destructive" : "default",
            });
        } catch (err: any) {
            toast({
                title: "Erreur",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setToggling(false);
        }
    };

    const handleTechnicalAction = (actionName: string) => {
        toast({
            title: "Action Technique",
            description: `L'action "${actionName}" nécessite un accès DevOps direct (CLI). Fonctionnalité web désactivée par sécurité.`,
        });
    };

    return (
        <PageGuard permission={["*" as Permission] /* Needs SUPER_ADMIN */} roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Mode Maintenance Globale"
                    description="Contrôlez l'accès au SaaS en cas de mise à jour majeure de la base de données ou de l'infrastructure."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Root Control", href: "/dashboard/root-control" },
                        { label: "Maintenance" },
                    ]}
                />

                <div className="grid gap-6">
                    <Card className={`border-2 transition-all duration-500 ${isMaintenance ? 'border-destructive shadow-destructive/20 shadow-lg' : 'border-border shadow-sm'}`}>
                        <CardHeader className={`${isMaintenance ? 'bg-destructive/10' : 'bg-muted/30'} border-b border-border`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className={`flex items-center gap-2 ${isMaintenance ? 'text-destructive' : 'text-foreground'}`}>
                                        <PowerSquare className="w-6 h-6" />
                                        Statut de la Plateforme
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {loading
                                            ? "Chargement du statut..."
                                            : isMaintenance
                                                ? "La plateforme est actuellement inaccessible pour les utilisateurs normaux."
                                                : "La plateforme fonctionne normalement et accepte le trafic."
                                        }
                                    </CardDescription>
                                </div>
                                <div className={`px-4 py-2 rounded-full font-bold text-sm border ${isMaintenance ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))]'}`}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isMaintenance ? "MAINTENANCE ACTIVE" : "EN LIGNE"}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="p-4 bg-muted/50 rounded-lg border border-border">
                                <h4 className="font-medium flex items-center gap-2 mb-2">
                                    <ShieldAlert className="w-4 h-4 text-orange-500" />
                                    Que se passe-t-il lorsque ce mode est activé ?
                                </h4>
                                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                                    <li>Toutes les sessions utilisateurs actives (sauf SUPER_ADMIN) seront bloquées par le middleware (`hasValidRootSession`).</li>
                                    <li>Une page "Maintenance" s'affiche pour tous les visiteurs normaux ou la requête API échouera avec 503 HTTP.</li>
                                    <li>Tâche critique : Le cache Redis est toujours accessible pour les super-admins.</li>
                                </ul>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-foreground">Message personnalisé (Bientôt disponible)</label>
                                <Textarea
                                    disabled
                                    
                                    className="min-h-[100px] bg-background"
                                />
                            </div>

                            <div className="pt-4 border-t border-border flex justify-between items-center">
                                <p className="text-sm text-muted-foreground italic">
                                    * L'activation est immédiate (sans redémarrage serveur requis)
                                </p>
                                <Button
                                    disabled={loading || toggling}
                                    variant={isMaintenance ? "default" : "destructive"}
                                    className="gap-2 font-bold"
                                    onClick={toggleMaintenance}
                                >
                                    {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                                    {isMaintenance ? "Désactiver la maintenance" : "Activer la maintenance globale"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TerminalSquare className="w-5 h-5 text-primary" />
                                Actions Techniques
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center p-4 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                                <div>
                                    <h4 className="font-semibold text-foreground">Purger le Cache Redis</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Déclenche une invalidation complète de la base Redis (Sessions, requêtes).</p>
                                </div>
                                <Button onClick={() => handleTechnicalAction("Purger Redis")} variant="outline" size="sm">Exécuter</Button>
                            </div>
                            <div className="flex justify-between items-center p-4 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                                <div>
                                    <h4 className="font-semibold text-foreground">Reconstruire les Index DB</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Optimise PostgreSQL sans downtime significatif `REINDEX CONCURRENTLY`.</p>
                                </div>
                                <Button onClick={() => handleTechnicalAction("Reconstruire DB")} variant="outline" size="sm">Exécuter</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
