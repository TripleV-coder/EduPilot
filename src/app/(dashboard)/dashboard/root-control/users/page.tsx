"use client";

import { useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Users, Search, MoreHorizontal, ShieldCheck, Mail, Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

type RootUser = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    school: { name: string; code: string } | null;
    sessionCount: number;
    updatedAt: string;
};

const fetcher = (url: string) => fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error("Erreur serveur");
    return res.json();
});

export default function RootUsersPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const { data, error, isLoading } = useSWR<{ data: RootUser[] }>(
        `/api/root/users?search=${encodeURIComponent(searchTerm)}&limit=50`,
        fetcher
    );

    const users = data?.data || [];

    const formatDate = (d: string) => {
        return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
    };

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-7xl mx-auto">
                <PageHeader
                    title="Annuaire Global"
                    description="Console d'administration globale: Recherche et gestion de tous les utilisateurs inter-écoles."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Root Control", href: "/dashboard/root-control" },
                        { label: "Utilisateurs Globaux" },
                    ]}
                />

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
                                    <TableHead className="w-[250px] font-semibold text-muted-foreground">Utilisateur</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground">Rôle D'accès</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground">Établissement</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground">Dernière Activité</TableHead>
                                    <TableHead className="font-semibold text-muted-foreground text-right">Contrôle</TableHead>
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
                                            Erreur lors du chargement des utilisateurs.
                                        </TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Aucun utilisateur trouvé.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase
                                                        ${user.isActive ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                                                        {user.firstName ? user.firstName.charAt(0) : user.email.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground text-sm flex items-center gap-2">
                                                            {user.firstName} {user.lastName}
                                                            {!user.isActive && <Badge variant="destructive" className="h-4 text-[9px] px-1">Suspendu</Badge>}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Mail className="w-3 h-3" /> {user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.role === "SUPER_ADMIN" ? (
                                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20 font-bold gap-1 shadow-none">
                                                        <ShieldCheck className="w-3 h-3" /> ADMIN SYSTÈME
                                                    </Badge>
                                                ) : user.role === "SCHOOL_ADMIN" ? (
                                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-none">
                                                        ADMIN ÉTABLISSEMENT
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="font-normal text-[10px]">
                                                        {formatUserRoleLabel(user.role)}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {!user.school ? (
                                                    <span className="text-muted-foreground italic">Système Global</span>
                                                ) : (
                                                    user.school.name
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                <div className="flex flex-col">
                                                    <span>{formatDate(user.updatedAt)}</span>
                                                    <span className="text-xs opacity-70">{user.sessionCount} sessions au total</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </PageGuard>
    );
}
