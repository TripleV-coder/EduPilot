"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Database, FileText, Activity, Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type EnforcementResult = {
    success: boolean;
    executedAt: string;
    totalDeleted: number;
    details: { policy: string; deletedCount: number }[];
};

export default function SystemRetentionPage() {
    const { toast } = useToast();
    const [running, setRunning] = useState(false);
    const [lastResult, setLastResult] = useState<EnforcementResult | null>(null);
    const [enforceDialogOpen, setEnforceDialogOpen] = useState(false);

    const handleEnforce = () => {
        setEnforceDialogOpen(true);
    };

    const confirmEnforce = async () => {
        setRunning(true);
        try {
            const res = await fetch("/api/system/retention", { method: "POST" });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erreur");
            setLastResult(result);
            toast({
                title: "Enforcement terminé",
                description: `${result.totalDeleted} enregistrement(s) supprimé(s).`,
            });
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setRunning(false);
            setEnforceDialogOpen(false);
        }
    };

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Rétention & RGPD"
                    description="Règles d'archivage et de suppression automatique des données"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Système" },
                        { label: "Rétention" },
                    ]}
                />

                <ConfirmActionDialog
                    open={enforceDialogOpen}
                    onOpenChange={setEnforceDialogOpen}
                    title="Lancer l'enforcement RGPD"
                    description="Les données obsolètes seront supprimées."
                    confirmLabel="Lancer"
                    cancelLabel={t("common.cancel")}
                    variant="destructive"
                    isConfirmLoading={running}
                    onConfirm={confirmEnforce}
                />

                {/* Last enforcement result */}
                {lastResult && (
                    <Card className="border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))]">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-foreground">Enforcement exécuté avec succès</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {lastResult.totalDeleted} enregistrement(s) supprimé(s) le{" "}
                                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastResult.executedAt))}
                                    </p>
                                    {lastResult.details.length > 0 && (
                                        <ul className="mt-2 text-sm space-y-1">
                                            {lastResult.details.map((d, i) => (
                                                <li key={i} className="text-muted-foreground">
                                                    {d.policy}: <span className="font-medium text-foreground">{d.deletedCount}</span> supprimé(s)
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-6">
                        <Card className="border-border shadow-sm border-dashed bg-muted/20">
                            <CardContent className="pt-6 text-center space-y-4">
                                <ShieldCheck className="w-12 h-12 text-primary mx-auto" />
                                <div>
                                    <h3 className="font-semibold text-foreground">Conformité RGPD</h3>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Le paramétrage des durées de conservation garantit la conformité de l&apos;établissement vis-à-vis de la réglementation sur les données personnelles.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-2">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="bg-muted/30 border-b border-border">
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="w-5 h-5 text-primary" />
                                    Politiques de cycle de vie
                                </CardTitle>
                                <CardDescription>
                                    Durées de conservation configurées dans le système. Ces paramètres sont appliqués lors de l&apos;enforcement.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="pt-6 space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-foreground font-medium border-b border-border pb-2">
                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                        Dossiers Académiques
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm text-muted-foreground">Élèves inactifs/anciens</Label>
                                            <Select defaultValue="5years">
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1year">1 an après le départ</SelectItem>
                                                    <SelectItem value="3years">3 ans après le départ</SelectItem>
                                                    <SelectItem value="5years">5 ans après le départ</SelectItem>
                                                    <SelectItem value="10years">10 ans (Archive longue)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm text-muted-foreground">Bulletins et Notes</Label>
                                            <Select defaultValue="10years">
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="3years">3 ans</SelectItem>
                                                    <SelectItem value="5years">5 ans</SelectItem>
                                                    <SelectItem value="10years">10 ans (Recommandé)</SelectItem>
                                                    <SelectItem value="indefinite">Conservation illimitée</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-foreground font-medium border-b border-border pb-2">
                                        <Activity className="w-4 h-4 text-muted-foreground" />
                                        Journaux Système (Logs)
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm text-muted-foreground">Historique de Connexion</Label>
                                            <Select defaultValue="6months">
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1month">1 mois</SelectItem>
                                                    <SelectItem value="3months">3 mois</SelectItem>
                                                    <SelectItem value="6months">6 mois</SelectItem>
                                                    <SelectItem value="1year">1 an</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm text-muted-foreground">Audit de Sécurité (Modifications)</Label>
                                            <Select defaultValue="1year">
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="6months">6 mois</SelectItem>
                                                    <SelectItem value="1year">1 an (Recommandé)</SelectItem>
                                                    <SelectItem value="3years">3 ans</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="bg-muted/10 border-t border-border mt-4 py-4 flex justify-end">
                                <Button onClick={handleEnforce} disabled={running} className="gap-2">
                                    {running ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                    {running ? "Exécution en cours..." : "Lancer l'enforcement RGPD"}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
