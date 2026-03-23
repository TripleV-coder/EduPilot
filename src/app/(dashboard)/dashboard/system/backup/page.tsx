"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { HardDriveDownload, DatabaseBackup, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";

type Backup = {
    filename: string;
    path: string;
    size: number;
    sizeFormatted: string;
    createdAt: string;
    modifiedAt: string;
    checksum: string | null;
};

type BackupData = {
    backups: Backup[];
    count: number;
    totalSize?: number;
    totalSizeFormatted?: string;
    message?: string;
};

export default function SystemBackupPage() {
    const { toast } = useToast();
    const { mutate } = useSWRConfig();
    const [isGenerating, setIsGenerating] = useState(false);

    const { data, error, isLoading } = useSWR<BackupData>("/api/system/backup", fetcher);
    const backups = data?.backups || [];

    const handleBackup = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch("/api/system/backup", { method: "POST" });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erreur lors de la sauvegarde");
            toast({ title: "Succès", description: result.message || "Sauvegarde créée avec succès." });
            mutate("/api/system/backup");
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        }).format(new Date(d));

    const lastBackup = backups.length > 0 ? backups[0] : null;
    const lastBackupAgo = lastBackup
        ? getTimeAgo(new Date(lastBackup.createdAt))
        : "Aucune";

    return (
        <PageGuard permission={[Permission.SYSTEM_BACKUP_CREATE, Permission.SYSTEM_BACKUP_VIEW]} roles={["SUPER_ADMIN"]}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Sauvegardes Système"
                        description="Gestion des sauvegardes de la base de données et des fichiers"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Système" },
                            { label: "Sauvegardes" },
                        ]}
                    />
                    <div className="flex gap-3 shrink-0">
                        <Button className="gap-2 shadow-sm" onClick={handleBackup} disabled={isGenerating}>
                            {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <DatabaseBackup className="w-4 h-4" />
                            )}
                            {isGenerating ? "Création..." : "Nouvelle sauvegarde"}
                        </Button>
                    </div>
                </div>

                {isLoading && (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {error && (
                    <div className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <p>{error.message || "Erreur de chargement"}</p>
                    </div>
                )}

                {!isLoading && !error && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Dernière Sauvegarde</p>
                                            <p className="text-xl font-bold text-foreground">{lastBackupAgo}</p>
                                        </div>
                                        <div className="p-2 bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] rounded-lg">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4">
                                        {lastBackup ? formatDate(lastBackup.createdAt) : "Aucune sauvegarde disponible"}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Taille Totale</p>
                                            <p className="text-xl font-bold text-foreground">{data?.totalSizeFormatted || "0 MB"}</p>
                                        </div>
                                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                            <HardDriveDownload className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4">{data?.count ?? 0} sauvegarde(s) disponible(s)</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border shadow-sm">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-muted-foreground">Politique de Rétention</p>
                                            <p className="text-xl font-bold text-foreground">30 Jours</p>
                                        </div>
                                        <div className="p-2 bg-muted text-muted-foreground rounded-lg">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4 text-orange-500">Nettoyage automatique activé</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle>Historique des sauvegardes</CardTitle>
                                <CardDescription>Liste des sauvegardes disponibles pour restauration.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {backups.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <DatabaseBackup className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">Aucune sauvegarde trouvée</p>
                                        <p className="text-sm mt-1">Lancez une sauvegarde pour commencer.</p>
                                    </div>
                                ) : (
                                    <div className="border border-border rounded-lg overflow-hidden bg-background">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Fichier</TableHead>
                                                    <TableHead>Taille</TableHead>
                                                    <TableHead>Statut</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {backups.map((backup) => (
                                                    <TableRow key={backup.filename}>
                                                        <TableCell className="font-medium">{formatDate(backup.createdAt)}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground font-mono">{backup.filename}</TableCell>
                                                        <TableCell>{backup.sizeFormatted}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">
                                                                Terminé
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
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

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days} jour(s)`;
}
