"use client";

import { useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Building, Plus, Search, Settings, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";
import { 
    User, 
    Mail, 
    Lock, 
    Globe, 
    MapPin, 
    Phone, 
    School as SchoolIcon,
    Building2,
    Info
} from "lucide-react";

type SchoolStat = {
    id: string;
    name: string;
    code: string;
    city: string | null;
    isActive: boolean;
    planId: string | null;
    stats: {
        users: number;
        classes: number;
        students: number;
        teachers: number;
    };
};

type SubscriptionPlan = {
    id: string;
    name: string;
    code: string;
    maxStudents: number;
    maxTeachers: number;
    isActive: boolean;
};

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error("Erreur serveur");
    return res.json();
});

export default function RootSchoolsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("school");
    const [selectedSchool, setSelectedSchool] = useState<SchoolStat | null>(null);
    const [isQuotaDialogOpen, setIsQuotaDialogOpen] = useState(false);
    
    const { data, error, isLoading, mutate } = useSWR<{ data: SchoolStat[] }>(
        `/api/root/schools?search=${encodeURIComponent(searchTerm)}&limit=50`,
        fetcher
    );

    const { data: plansData } = useSWR<{ data: SubscriptionPlan[] }>(
        "/api/root/plans",
        fetcher
    );

    const schools = data?.data || [];
    const plans = plansData?.data || [];

    const handleCreateSchool = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        
        const payload = {
            name: formData.get("name") as string,
            type: formData.get("type") as string,
            level: formData.get("level") as string,
            city: formData.get("city") as string,
            phone: formData.get("phone") as string,
            address: formData.get("address") as string,
            email: formData.get("email") as string,
            website: formData.get("website") as string,
            adminFirstName: formData.get("adminFirstName") as string,
            adminLastName: formData.get("adminLastName") as string,
            adminEmail: formData.get("adminEmail") as string,
            adminPassword: formData.get("adminPassword") as string,
        };

        try {
            const res = await fetch("/api/root/schools", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erreur lors de la création");
            }

            toast({
                title: "Succès",
                description: "L'établissement et son administrateur ont été créés.",
            });
            setIsCreateDialogOpen(false);
            mutate();
        } catch (err: any) {
            toast({
                title: "Erreur",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateQuotas = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedSchool) return;

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);
        const planId = formData.get("planId");
        const payload = {
            id: selectedSchool.id,
            planId: planId === "none" ? null : (planId || null),
            isActive: formData.get("isActive") === "true",
        };

        try {
            const res = await fetch("/api/root/schools", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erreur lors de la mise à jour");
            }

            toast({
                title: "Succès",
                description: "Les quotas et le statut ont été mis à jour.",
            });
            setIsQuotaDialogOpen(false);
            mutate();
        } catch (err: any) {
            toast({
                title: "Erreur",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageGuard permission={["*" as Permission] /* Needs SUPER_ADMIN */} roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Établissements Clients (Tenants)"
                        description="Gestion centrale des souscriptions et déploiement de nouveaux établissements."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Root Control", href: "/dashboard/root-control" },
                            { label: "Écoles" },
                        ]}
                    />
                    
                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shadow-md bg-orange-600 hover:bg-orange-700 text-white border-0 transition-all active:scale-95">
                                <Plus className="w-4 h-4" />
                                Déployer un Établissement
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] overflow-hidden p-0 gap-0 border-0 shadow-2xl">
                            <form onSubmit={handleCreateSchool} className="flex flex-col max-h-[90vh]">
                                <DialogHeader className="p-6 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <DialogTitle className="text-xl font-bold text-orange-950">Déploiement d'Établissement</DialogTitle>
                                    </div>
                                    <DialogDescription className="text-orange-900/70">
                                        Configurez le socle technique du nouvel établissement et son administrateur principal.
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <Tabs defaultValue="school" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                                    <div className="px-6 border-b bg-muted/20">
                                        <TabsList className="h-12 bg-transparent gap-6">
                                            <TabsTrigger value="school" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-orange-600 rounded-none border-b-2 border-transparent px-2 h-12 gap-2">
                                                <SchoolIcon className="w-4 h-4" />
                                                Établissement
                                            </TabsTrigger>
                                            <TabsTrigger value="admin" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-orange-600 rounded-none border-b-2 border-transparent px-2 h-12 gap-2">
                                                <User className="w-4 h-4" />
                                                Admin Principal
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="p-6 overflow-y-auto min-h-[400px]">
                                        <TabsContent value="school" className="mt-0 space-y-4" forceMount>
                                            <div className="grid gap-4 data-[state=inactive]:hidden" data-state={activeTab === 'school' ? 'active' : 'inactive'}>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="create-name" className="flex items-center gap-2">
                                                        <Info className="w-3 h-3 text-orange-600" /> Nom de l'établissement
                                                    </Label>
                                                    <Input id="create-name" name="name" className="h-11 focus-visible:ring-orange-600" required />
                                                </div>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="create-type">Type</Label>
                                                        <Select name="type" defaultValue="PRIVATE">
                                                            <SelectTrigger id="create-type" className="h-11">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="PUBLIC">Public</SelectItem>
                                                                <SelectItem value="PRIVATE">Privé</SelectItem>
                                                                <SelectItem value="RELIGIOUS">Religieux (Confessionnel)</SelectItem>
                                                                <SelectItem value="INTERNATIONAL">International</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="create-level">Niveau Principal</Label>
                                                        <Select name="level" defaultValue="SECONDARY">
                                                            <SelectTrigger id="create-level" className="h-11">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="PRIMARY">Primaire</SelectItem>
                                                                <SelectItem value="SECONDARY_COLLEGE">Secondaire (Collège)</SelectItem>
                                                                <SelectItem value="SECONDARY_LYCEE">Secondaire (Lycée)</SelectItem>
                                                                <SelectItem value="MIXED">Mixte</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="create-city" className="flex items-center gap-2">
                                                            <MapPin className="w-3 h-3 text-muted-foreground" /> Ville
                                                        </Label>
                                                        <Input id="create-city" name="city" className="h-11" />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="create-phone" className="flex items-center gap-2">
                                                            <Phone className="w-3 h-3 text-muted-foreground" /> Téléphone
                                                        </Label>
                                                        <Input id="create-phone" name="phone" className="h-11" />
                                                    </div>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="create-address">Adresse physique</Label>
                                                    <Input id="create-address" name="address" className="h-11" />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="create-email" className="flex items-center gap-2">
                                                            <Mail className="w-3 h-3 text-muted-foreground" /> Email institutionnel
                                                        </Label>
                                                        <Input id="create-email" name="email" type="email" className="h-11" />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="create-website" className="flex items-center gap-2">
                                                            <Globe className="w-3 h-3 text-muted-foreground" /> Site Web
                                                        </Label>
                                                        <Input id="create-website" name="website" className="h-11" />
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="admin" className="mt-0 space-y-6" forceMount>
                                            <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-lg flex gap-3 text-sm text-orange-900/80 data-[state=inactive]:hidden" data-state={activeTab === 'admin' ? 'active' : 'inactive'}>
                                                <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0" />
                                                <p>Cet utilisateur sera créé avec le rôle <strong>Admin Établissement</strong> et aura un accès complet au dashboard de cette école.</p>
                                            </div>

                                            <div className="grid gap-4 data-[state=inactive]:hidden" data-state={activeTab === 'admin' ? 'active' : 'inactive'}>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="admin-firstname">Prénom</Label>
                                                        <Input id="admin-firstname" name="adminFirstName" className="h-11 focus-visible:ring-orange-600" required />
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="admin-lastname">Nom de famille</Label>
                                                        <Input id="admin-lastname" name="adminLastName" className="h-11 focus-visible:ring-orange-600" required />
                                                    </div>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="admin-email" className="flex items-center gap-2">
                                                        <Mail className="w-3 h-3 text-muted-foreground" /> Email de connexion
                                                    </Label>
                                                    <Input id="admin-email" name="adminEmail" type="email" className="h-11 focus-visible:ring-orange-600" required />
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label htmlFor="admin-password" className="flex items-center gap-2">
                                                        <Lock className="w-3 h-3 text-muted-foreground" /> Mot de passe temporaire
                                                    </Label>
                                                    <Input id="admin-password" name="adminPassword" type="password" className="h-11 focus-visible:ring-orange-600" required />
                                                    <p className="text-[10px] text-muted-foreground">8 caractères min, lettres et chiffres recommandés.</p>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </div>
                                </Tabs>

                                <DialogFooter className="p-6 bg-muted/20 border-t flex items-center justify-between sm:justify-between w-full">
                                    <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>{t("common.cancel")}</Button>
                                    <div className="flex gap-2">
                                        {activeTab === "school" ? (
                                            <Button type="button" variant="outline" className="gap-2" onClick={() => setActiveTab("admin")}>
                                                Étape Suivante <Plus className="w-4 h-4 text-orange-600" />
                                            </Button>
                                        ) : (
                                            <>
                                            <Button type="button" variant="outline" onClick={() => setActiveTab("school")}>{t("common.back")}</Button>
                                            <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={isSubmitting}>
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                {t("appActions.finalizeDeployment")}
                                            </Button>
                                            </>
                                        )}
                                    </div>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <Card className="p-4 rounded-xl shadow-sm border border-border">
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                
                                className="pl-9 bg-muted/50 border-border"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden bg-background">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-semibold text-muted-foreground">Nom & Code</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground">Localisation</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground">Utilisateurs</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground">Statut Compte</TableHead>
                                    <TableHead className="text-right font-semibold text-muted-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : error ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-destructive">
                                            Erreur lors du chargement des établissements.
                                        </TableCell>
                                    </TableRow>
                                ) : schools.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Aucun établissement trouvé.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    schools.map((school) => (
                                        <TableRow key={school.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <Building className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-foreground text-sm">{school.name}</p>
                                                        <Badge variant="secondary" className="mt-1 font-mono text-[10px] uppercase">{school.code}</Badge>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-muted-foreground">
                                                {school.city || "Non spécifié"}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {school.stats?.users?.toLocaleString() || 0}
                                            </TableCell>
                                            <TableCell>
                                                {school.isActive ? (
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-normal">
                                                        Actif (En règle)
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-bold gap-1">
                                                        <ShieldAlert className="w-3 h-3" /> Suspendu
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="gap-2 border-border text-foreground hover:bg-muted"
                                                    onClick={() => {
                                                        setSelectedSchool(school);
                                                        setIsQuotaDialogOpen(true);
                                                    }}
                                                >
                                                    <Settings className="w-4 h-4" /> Ajuster Quotas
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                <Dialog open={isQuotaDialogOpen} onOpenChange={setIsQuotaDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        {selectedSchool && (
                            <form onSubmit={handleUpdateQuotas}>
                                <DialogHeader>
                                    <DialogTitle>Ajuster les Quotas : {selectedSchool.name}</DialogTitle>
                                    <DialogDescription>
                                        Modifiez le plan de souscription et l'état d'activation de l'établissement.
                                    </DialogDescription>
                                </DialogHeader>
                                
                                <div className="grid gap-6 py-6">
                                    <div className="grid gap-2">
                                        <Label htmlFor="planId">Plan de souscription</Label>
                                        <Select name="planId" defaultValue={selectedSchool.planId || "none"}>
                                            <SelectTrigger id="planId" className="h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {plans.map((plan) => (
                                                    <SelectItem key={plan.id} value={plan.id}>
                                                        {plan.name} ({plan.maxStudents} élèves / {plan.maxTeachers} ens.)
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="none">Aucun plan (Par défaut)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="isActive">Statut de l'établissement</Label>
                                        <Select name="isActive" defaultValue={selectedSchool.isActive ? "true" : "false"}>
                                            <SelectTrigger id="isActive" className="h-11">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">Actif (Accès autorisé)</SelectItem>
                                                <SelectItem value="false">Suspendu (Accès bloqué)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-xs">
                                        <p className="font-bold flex items-center gap-2">
                                            <Info className="w-4 h-4 text-primary" /> Utilisation actuelle :
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-muted-foreground">Élèves :</p>
                                                <p className="font-mono text-sm">{selectedSchool.stats.students}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Enseignants :</p>
                                                <p className="font-mono text-sm">{selectedSchool.stats.teachers}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsQuotaDialogOpen(false)}>{t("common.cancel")}</Button>
                                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enregistrer les modifications
                                    </Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </PageGuard>
    );
}
