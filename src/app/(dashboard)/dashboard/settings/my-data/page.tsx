"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { ShieldCheck, Download, Trash2, FileText, Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

export default function MyDataSettingsPage() {
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleExportData = async () => {
        setExporting(true);
        try {
            const res = await fetch("/api/user/data");
            if (!res.ok) throw new Error("Erreur lors de l'export");
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `mes-donnees-edupilot-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert("Impossible d'exporter vos données. Veuillez réessayer.");
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteAccount = () => {
        setDeleteDialogOpen(true);
    };

    const confirmDeleteAccount = async () => {
        setDeleting(true);
        try {
            const res = await fetch("/api/user/data", { method: "DELETE" });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            alert("Votre demande de suppression a été enregistrée.");
        } catch (error) {
            alert("Impossible de traiter votre demande. Veuillez réessayer.");
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    };
    return (
        <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Mes Données Personnelles"
                    description="Contrôlez vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD)."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Données Personnelles" },
                    ]}
                />

                <ConfirmActionDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    title="Supprimer votre compte"
                    description="Cette action est irréversible. Toutes les données associées seront traitées selon les politiques de conservation."
                    confirmLabel={t("common.delete")}
                    cancelLabel={t("common.cancel")}
                    variant="destructive"
                    isConfirmLoading={deleting}
                    onConfirm={confirmDeleteAccount}
                />

                <div className="grid gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Download className="w-5 h-5 text-primary" />
                                Droit à la portabilité (Exporter)
                            </CardTitle>
                            <CardDescription>
                                Vous pouvez demander une copie de vos données personnelles conservées sur EduPilot.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                                <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/20">
                                <FileText className="w-8 h-8 text-primary shrink-0" />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-foreground">Archive Complète (JSON & PDF)</h4>
                                    <p className="text-sm text-muted-foreground mt-1">Comprend votre profil, l'historique de présence, et les bulletins disponibles.</p>
                                </div>
                                <Button className="gap-2 shrink-0" onClick={handleExportData} disabled={exporting}>
                                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    {exporting ? "Export en cours..." : "Demander l'Archive"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground italic">La génération de l'archive peut prendre jusqu'à 24 heures. Un lien de téléchargement vous sera envoyé par e-mail.</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm border-t-2 border-t-destructive">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                                <Trash2 className="w-5 h-5" />
                                Droit à l'oubli (Suppression)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-2">
                                    <ShieldCheck className="w-4 h-4 text-warning" /> Attention aux obligations légales
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                    La suppression définitive de votre compte est irréversible.
                                    Notez que certaines données liées à la facturation ou au registre scolaire peuvent être conservées légalement par l'établissement pour une durée minimale, même après la fermeture du compte.
                                </p>
                            </div>
                            <div className="flex justify-between items-center bg-card">
                                <span className="text-sm font-medium">Lancer la procédure de suppression</span>
                                <Button variant="outline" className="text-destructive border-border hover:bg-destructive hover:text-destructive-foreground" onClick={handleDeleteAccount} disabled={deleting}>
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Supprimer mon compte
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Fingerprint className="w-5 h-5 text-primary" />
                                Consentements
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-border pb-4">
                                    <div>
                                        <h4 className="font-medium text-foreground text-sm">Utilisation des données pour analyse (Anonymisé)</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">Nous permet d'améliorer l'application sans vous identifier.</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-primary">Gérer</Button>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <div>
                                        <h4 className="font-medium text-foreground text-sm">Droit à l'image</h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">Consentement pour la parution d'images de l'élève (Parents uniquement).</p>
                                    </div>
                                    <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))]">Accordé</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
