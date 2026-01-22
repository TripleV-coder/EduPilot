"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Trash2, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useUsers, useDeleteUser } from "@/hooks/use-users";
import { useSuperAdminDashboard } from "@/hooks/useSuperAdminDashboard"; // Using existing hook for stats/logs
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    // 1. Fetch Real Users
    const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useUsers({
        page,
        limit: 10,
        search: searchTerm
    });

    // 2. Fetch Real Dashboard Stats & Logs
    const { data: dashboardData, isLoading: isLoadingStats } = useSuperAdminDashboard();

    const deleteUserMutation = useDeleteUser();

    const handleDelete = async (id: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) return;

        try {
            await deleteUserMutation.mutateAsync(id);
            toast.success("Utilisateur supprimé");
            refetchUsers();
        } catch (_error) {
            toast.error("Erreur lors de la suppression");
        }
    };

    const _isLoading = isLoadingUsers || isLoadingStats;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Administration Système</h1>
                    <p className="text-muted-foreground">Panneau de contrôle global et journaux d&apos;audit.</p>
                </div>
                {/* 
                <Button variant="destructive">
                    <AlertCircle className="mr-2 h-4 w-4" /> Mode Maintenance
                </Button> 
                */}
            </div>

            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card variant="glass">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Utilisateurs Totaux</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStats ? <Loader2 className="animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold">{dashboardData?.userStats?.totalUsers || 0}</div>
                                <p className="text-xs text-muted-foreground">
                                    {dashboardData?.userStats?.newUsersThisMonth || 0} nouveaux ce mois-ci
                                </p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Système Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStats ? <Loader2 className="animate-spin" /> : (
                            <>
                                <div className="text-2xl font-bold text-green-500 flex items-center gap-2">
                                    <CheckCircle className="h-6 w-6" /> Opérationnel
                                </div>
                                <p className="text-xs text-muted-foreground">Santé {dashboardData?.stats?.systemHealth || 100}%</p>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card variant="glass">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Version</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">v3.0.0</div>
                        <p className="text-xs text-muted-foreground">Build 2026-01-15 (Full Stack)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Users Table */}
                <Card className="md:col-span-2" variant="glass">
                    <CardHeader>
                        <CardTitle>Gestion des Utilisateurs</CardTitle>
                        <CardDescription>Vue globale de tous les comptes enregistrés.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher par nom ou email..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" onClick={() => refetchUsers()}>Rafraîchir</Button>
                        </div>

                        {isLoadingUsers ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Utilisateur</TableHead>
                                        <TableHead>Rôle</TableHead>
                                        <TableHead>Statut</TableHead>
                                        {/* <TableHead>Créé le</TableHead> */}
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {usersData?.data?.map((user: any) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="font-medium">{user.firstName} {user.lastName}</div>
                                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.role === 'SUPER_ADMIN' ? 'destructive' : 'outline'}>
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.isActive ? 'success' : 'secondary'} className={user.isActive ? "bg-green-100 text-green-800" : ""}>
                                                    {user.isActive ? 'Actif' : 'Inactif'}
                                                </Badge>
                                            </TableCell>
                                            {/* <TableCell className="text-muted-foreground text-sm">
                                                {format(new Date(user.createdAt), "dd MMM yyyy", { locale: fr })}
                                            </TableCell> */}
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(user.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!usersData?.data || usersData.data.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                Aucun utilisateur trouvé.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}

                        {/* Simple Pagination */}
                        {usersData?.pagination && (
                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    Précédent
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= usersData.pagination.pages}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Suivant
                                </Button>
                            </div>
                        )}

                    </CardContent>
                </Card>

                {/* System Logs */}
                <Card variant="glass">
                    <CardHeader>
                        <CardTitle>Logs Système</CardTitle>
                        <CardDescription>Dernières activités (Temps réel).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingStats ? <Loader2 className="animate-spin" /> : (
                            <div className="space-y-6 relative">
                                {dashboardData?.recentLogins?.map((log, i) => (
                                    <div key={log.id} className="flex gap-4 relative">
                                        {i !== (dashboardData.recentLogins.length - 1) && (
                                            <div className="absolute left-[11px] top-6 bottom-[-20px] w-[1px] bg-muted-foreground/20"></div>
                                        )}
                                        <div className={`mt-1 h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-600`}>
                                            <div className="h-2 w-2 rounded-full bg-current" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">Connexion Utilisateur</p>
                                            <p className="text-xs text-muted-foreground">
                                                {log.userName} ({log.role})
                                            </p>
                                            <div className="flex items-center pt-1 text-xs text-muted-foreground/70">
                                                <Clock className="mr-1 h-3 w-3" />
                                                {format(new Date(log.timestamp), "HH:mm", { locale: fr })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!dashboardData?.recentLogins || dashboardData.recentLogins.length === 0) && (
                                    <p className="text-sm text-muted-foreground text-center">Aucun log récent.</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
