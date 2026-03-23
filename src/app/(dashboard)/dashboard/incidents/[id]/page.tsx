"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Permission } from "@/lib/rbac/permissions";
import { ArrowLeft, CheckCircle2, AlertTriangle, Shield, Clock, MapPin, User, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ToastAction } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

const SANCTION_TYPES = [
    { value: "WARNING", label: "Avertissement" },
    { value: "DETENTION", label: "Retenue" },
    { value: "SUSPENSION", label: "Exclusion Temporaire" },
    { value: "EXPULSION", label: "Exclusion Définitive" },
    { value: "COMMUNITY_SERVICE", label: "Travail d'Intérêt Général" },
    { value: "LOSS_OF_PRIVILEGE", label: "Privation de Droit" },
    { value: "PARENT_CONFERENCE", label: "Convocation des Parents" },
    { value: "COUNSELING", label: "Accompagnement Éducatif" },
    { value: "OTHER", label: "Autre" }
];

const FLOW_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

export default function IncidentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;

    const { data: incident, isLoading, mutate } = useSWR(`/api/incidents/${id}`, fetcher);

    // Dialog states
    const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
    const [sanctionDialogOpen, setSanctionDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fromListTransition, setFromListTransition] = useState(false);

    // Form states
    const [followUpNotes, setFollowUpNotes] = useState("");
    const [sanctionType, setSanctionType] = useState("WARNING");
    const [sanctionDescription, setSanctionDescription] = useState("");
    const [sanctionStartDate, setSanctionStartDate] = useState(new Date().toISOString().slice(0, 16));
    const [sanctionEndDate, setSanctionEndDate] = useState("");

    useEffect(() => {
        if (typeof window === "undefined") return;
        const value = window.sessionStorage.getItem("edupilot-incident-transition");
        if (value === id) setFromListTransition(true);
        window.sessionStorage.removeItem("edupilot-incident-transition");
    }, [id]);

    if (isLoading) return <div className="p-12 flex justify-center"><AlertTriangle className="animate-pulse text-muted-foreground" /></div>;
    if (!incident) return <div className="p-12 text-center text-red-500">Incident introuvable.</div>;

    const handleResolve = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/incidents/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isResolved: true, followUpNotes })
            });
            if (!res.ok) throw new Error("Erreur de résolution");

            toast({
                title: t("incidentDetails.toasts.resolvedTitle"),
                description: t("incidentDetails.toasts.resolvedDescription"),
                action: (
                    <ToastAction altText={t("incidentDetails.toasts.backToListAlt")} onClick={() => router.push("/dashboard/incidents")}>
                        {t("incidentDetails.toasts.viewList")}
                    </ToastAction>
                ),
            });
            setResolveDialogOpen(false);
            mutate();
            router.refresh();
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible de résoudre l'incident", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddSanction = async () => {
        setIsSubmitting(true);
        try {
            const bodyData: any = {
                type: sanctionType,
                startDate: new Date(sanctionStartDate).toISOString(),
                description: sanctionDescription || undefined
            };
            if (sanctionEndDate) bodyData.endDate = new Date(sanctionEndDate).toISOString();

            const res = await fetch(`/api/incidents/${id}/sanctions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyData)
            });
            if (!res.ok) throw new Error("Erreur lors de l'attribution");

            toast({
                title: t("incidentDetails.toasts.sanctionAddedTitle"),
                description: t("incidentDetails.toasts.sanctionAddedDescription"),
                action: (
                    <ToastAction altText={t("incidentDetails.toasts.refreshAlt")} onClick={() => mutate()}>
                        {t("incidentDetails.toasts.refresh")}
                    </ToastAction>
                ),
            });
            setSanctionDialogOpen(false);

            // Reset form
            setSanctionType("WARNING");
            setSanctionDescription("");
            setSanctionEndDate("");

            mutate();
        } catch (error) {
            toast({ title: "Erreur", description: "Impossible d'attribuer la sanction", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <motion.div
                className="space-y-6 max-w-5xl mx-auto pb-12"
                initial={fromListTransition ? { opacity: 0, y: 12, scale: 0.99 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={FLOW_TRANSITION}
            >
                <PageHeader
                    title="Détails de l'Incident"
                    description={`Signalement du ${new Date(incident.date).toLocaleDateString()}`}
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Vie Scolaire", href: "/dashboard/incidents" },
                        { label: "Incidents", href: "/dashboard/incidents" },
                        { label: "Détails" }
                    ]}
                    actions={
                        <Button variant="outline" asChild>
                            <Link href="/dashboard/incidents"><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Link>
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Colonne Principale (Détails) */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-primary" />
                                    {incident.student?.user.firstName} {incident.student?.user.lastName}
                                </CardTitle>
                                {incident.isResolved ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 px-3"><CheckCircle2 className="w-4 h-4 mr-1" /> Dossier Clos</Badge>
                                ) : (
                                    <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 px-3"><AlertTriangle className="w-4 h-4 mr-1" /> En attente</Badge>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-6 pt-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Date & Heure</span>
                                        <p className="font-medium">{new Date(incident.date).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Lieu</span>
                                        <p className="font-medium">{incident.location || "Non spécifié"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Type & Gravité</span>
                                        <p className="font-medium">{incident.incidentType} / {incident.severity}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-muted-foreground flex items-center gap-1"><User className="w-3.5 h-3.5" /> Signalé par</span>
                                        <p className="font-medium">{incident.reportedBy?.firstName} {incident.reportedBy?.lastName} ({incident.reportedBy?.role})</p>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-border">
                                    <h4 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Description des faits</h4>
                                    <p className="text-sm text-foreground/80 whitespace-pre-wrap bg-muted/30 p-4 rounded-lg">{incident.description}</p>
                                </div>

                                {(incident.actionTaken || incident.followUpNotes) && (
                                    <div className="space-y-2 pt-4 border-t border-border">
                                        <h4 className="font-semibold">Mesures conservatoires et suivi</h4>
                                        {incident.actionTaken && <p className="text-sm bg-blue-500/5 text-blue-700/90 p-3 rounded-lg border border-blue-500/10"><b>Action immédiate:</b> {incident.actionTaken}</p>}
                                        {incident.followUpNotes && <p className="text-sm bg-emerald-500/5 text-emerald-700/90 p-3 rounded-lg border border-emerald-500/10"><b>Notes de clôture:</b> {incident.followUpNotes}</p>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Colonne Secondaire (Actions & Sanctions) */}
                    <div className="space-y-6">
                        {!incident.isResolved && (
                            <Card className="border-primary/20 bg-primary/5 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Actions Requises</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white action-critical touch-target"><CheckCircle2 className="w-4 h-4 mr-2" /> Clore l'incident</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Clôturer le dossier</DialogTitle>
                                                <DialogDescription>Ajoutez une note finale de suivi avant de marquer cet incident comme résolu.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Notes de clôture / Conclusion</Label>
                                                    <Textarea
                                                        
                                                        value={followUpNotes}
                                                        onChange={(e) => setFollowUpNotes(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>{t("common.cancel")}</Button>
                                                <Button onClick={handleResolve} disabled={isSubmitting || !followUpNotes} className="action-critical touch-target">Confirmer la clôture</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>

                                    <Dialog open={sanctionDialogOpen} onOpenChange={setSanctionDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" className="w-full touch-target"><Plus className="w-4 h-4 mr-2" /> Assigner une Sanction</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Nouvelle Sanction Disciplinaire</DialogTitle>
                                                <DialogDescription>Cette décision sera enregistrée dans le dossier permanent de l'élève.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Type de Sanction</Label>
                                                    <Select onValueChange={setSanctionType} defaultValue={sanctionType}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {SANCTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Début (Date & Heure)</Label>
                                                        <Input type="datetime-local" value={sanctionStartDate} onChange={(e) => setSanctionStartDate(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Fin (Optionnel)</Label>
                                                        <Input type="datetime-local" value={sanctionEndDate} onChange={(e) => setSanctionEndDate(e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Motif / Travail demandé</Label>
                                                    <Textarea
                                                        
                                                        value={sanctionDescription}
                                                        onChange={(e) => setSanctionDescription(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setSanctionDialogOpen(false)}>{t("common.cancel")}</Button>
                                                <Button onClick={handleAddSanction} disabled={isSubmitting}>Valider la sanction</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardContent>
                            </Card>
                        )}

                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Historique des Sanctions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {incident.sanctions?.length === 0 ? (
                                    <p className="text-sm text-center text-muted-foreground py-4">Aucune sanction assignée à ce jour pour cet incident.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {incident.sanctions?.map((sanction: any) => (
                                            <div key={sanction.id} className="p-3 border rounded-lg bg-card text-sm space-y-2">
                                                <div className="flex items-center justify-between font-medium">
                                                    <span>{SANCTION_TYPES.find(t => t.value === sanction.type)?.label || sanction.type}</span>
                                                </div>
                                                <div className="text-muted-foreground text-xs space-y-1">
                                                    <p>Du: {new Date(sanction.startDate).toLocaleString()}</p>
                                                    {sanction.endDate && <p>Au: {new Date(sanction.endDate).toLocaleString()}</p>}
                                                </div>
                                                {sanction.description && <p className="mt-2 text-foreground/80">{sanction.description}</p>}
                                                <p className="text-[10px] text-muted-foreground text-right pt-2 border-t border-border mt-2">
                                                    Par: {sanction.assignedBy?.firstName} {sanction.assignedBy?.lastName}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </motion.div>
        </PageGuard>
    );
}
