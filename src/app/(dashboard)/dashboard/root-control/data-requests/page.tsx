"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, UserX, Download, CheckCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type DataRequest = {
    id: string;
    userId: string;
    type: "ACCESS" | "EXPORT" | "DELETE";
    status: "PENDING" | "COMPLETED" | "REJECTED";
    requestedAt: string;
    completedAt: string | null;
    user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        role: string;
    };
};

export default function RootDataRequestsPage() {
    const [requests, setRequests] = useState<DataRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/root/data-requests", { credentials: "include" });
            if (!res.ok) throw new Error("Erreur serveur lors du chargement des requêtes");
            const data = await res.json();
            setRequests(data.data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const processRequest = async (id: string, action: "APPROVE" | "REJECT") => {
        setProcessingId(id);
        try {
            const res = await fetch("/api/root/data-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, action }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Échec de la mise à jour");

            toast({
                title: "Succès",
                description: `Demande ${action === "APPROVE" ? "approuvée" : "rejetée"} avec succès.`,
            });
            fetchRequests();
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: err.message,
            });
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (d: string) => {
        return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
    };

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <PageHeader
                    title="Conformité RGPD / Demandes"
                    description="Traitement centralisé des demandes d'exportation de données et de suppression de compte (Droit à l'oubli)."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Root Control", href: "/dashboard/root-control" },
                        { label: "Requêtes Données" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6 text-center">
                            <ShieldCheck className="w-8 h-8 text-primary mx-auto mb-2" />
                            <h3 className="text-2xl font-bold">{requests.length}</h3>
                            <p className="text-sm text-muted-foreground">Demandes trouvées</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm border-t-2 border-t-orange-500">
                        <CardContent className="pt-6 text-center">
                            <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                            <h3 className="text-2xl font-bold">{requests.filter(r => r.status === "PENDING").length}</h3>
                            <p className="text-sm text-muted-foreground">Demandes en attente</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border shadow-sm border-t-2 border-t-[hsl(var(--success))]">
                        <CardContent className="pt-6 text-center">
                            <CheckCircle className="w-8 h-8 text-[hsl(var(--success))] mx-auto mb-2" />
                            <h3 className="text-2xl font-bold">{requests.filter(r => r.status === "COMPLETED").length}</h3>
                            <p className="text-sm text-muted-foreground">Demandes traitées</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border shadow-sm">
                    <CardHeader className="bg-muted/10 border-b border-border">
                        <CardTitle>Registre des Demandes</CardTitle>
                        <CardDescription>
                            Vous devez traiter ces demandes conformément au RGPD (Délai légal d'un mois).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {error && (
                            <div className="p-4 bg-[hsl(var(--error-bg))] text-destructive flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead>Utilisateur</TableHead>
                                    <TableHead>Type de Requête</TableHead>
                                    <TableHead>Reçue le</TableHead>
                                    <TableHead>Statut</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Aucune demande RGPD en attente.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((req) => (
                                        <TableRow key={req.id}>
                                            <TableCell>
                                                <p className="font-medium text-sm text-foreground">
                                                    {req.user.firstName} {req.user.lastName}
                                                    <Badge variant="secondary" className="ml-2 text-[10px]">{req.user.role}</Badge>
                                                </p>
                                                <p className="text-xs text-muted-foreground">{req.user.email}</p>
                                            </TableCell>
                                            <TableCell>
                                                {req.type === "DELETE" ? (
                                                    <span className="flex items-center gap-1 text-sm font-medium text-destructive">
                                                        <UserX className="w-4 h-4" /> Suppression
                                                    </span>
                                                ) : req.type === "EXPORT" ? (
                                                    <span className="flex items-center gap-1 text-sm font-medium text-blue-600">
                                                        <Download className="w-4 h-4" /> Exportation
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                                                        <ShieldCheck className="w-4 h-4" /> Accès
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{formatDate(req.requestedAt)}</TableCell>
                                            <TableCell>
                                                {req.status === "PENDING" ? (
                                                    <Badge variant="outline" className="border-orange-500/30 text-orange-600 bg-orange-500/10 font-normal">
                                                        En attente
                                                    </Badge>
                                                ) : req.status === "REJECTED" ? (
                                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-normal">
                                                        Rejeté
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">
                                                        Traité
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {req.status === "PENDING" ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => processRequest(req.id, "REJECT")}
                                                            disabled={processingId === req.id}
                                                            className="text-destructive hover:bg-destructive shadow-none hover:text-destructive-foreground">
                                                            Rejeter
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => processRequest(req.id, "APPROVE")}
                                                            disabled={processingId === req.id}>
                                                            {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approuver"}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic mr-2">Fermée</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
