"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Users, AlertCircle, Plus, Search, Trash2, ArrowUpDown, Download } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { formatUserRoleLabel } from "@/lib/utils/role-label";
import { t } from "@/lib/i18n";

type User = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    schoolId: string | null;
    school?: {
        name: string;
    } | null;
};

const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super administrateur",
    SCHOOL_ADMIN: "Administrateur établissement",
    DIRECTOR: "Directeur",
    SECRETAIRE: "Secrétaire",
    ACCOUNTANT: "Comptable",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    PARENT: "Parent",
};

export default function UsersPage() {
    const { mutate } = useSWRConfig();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const searchParams = new URLSearchParams();
    if (debouncedSearch) searchParams.set("search", debouncedSearch);
    if (roleFilter !== "ALL") searchParams.set("role", roleFilter);
    const queryString = searchParams.toString();
    const url = `/api/users${queryString ? `?${queryString}` : ""}`;

    const { data: response, error, isLoading: loading } = useSWR<any>(url, fetcher);

    const users: User[] = response?.data || response?.users || (Array.isArray(response) ? response : []);

    const requestDelete = (id: string, name: string) => {
        setPendingDelete({ id, name });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/users/${pendingDelete.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Erreur de suppression");
            toast({ title: "Succès", description: "L'utilisateur a été supprimé." });
            setDeleteDialogOpen(false);
            setPendingDelete(null);
            mutate(url);
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Prénom", "Email", "Rôle", "École", "Statut", "Inscrit le"];
        const rows = users.map(u => [
            u.lastName, u.firstName, u.email,
            roleLabels[u.role] || formatUserRoleLabel(u.role),
            u.school?.name || "Global",
            u.isActive ? "Actif" : "Inactif",
            format(new Date(u.createdAt), "dd/MM/yyyy", { locale: fr }),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `utilisateurs_${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const columns: ColumnDef<User>[] = [
        {
            id: "name",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Utilisateur <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.firstName} ${row.lastName}`,
            cell: ({ row }) => {
                const u = row.original;
                return (
                    <div>
                        <p className="font-medium text-foreground">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                );
            },
        },
        {
            id: "role",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Rôle <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => roleLabels[row.role] || formatUserRoleLabel(row.role),
            cell: ({ row }) => (
                <Badge variant="outline" className="font-normal bg-primary/5 text-primary border-primary/20">
                    {roleLabels[row.original.role] || formatUserRoleLabel(row.original.role)}
                </Badge>
            ),
        },
        {
            id: "school",
            header: "École",
            accessorFn: (row) => row.school?.name || "Global",
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">{row.original.school?.name || "Global"}</span>
            ),
        },
        {
            id: "status",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Statut <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.isActive ? "Actif" : "Inactif",
            cell: ({ row }) => row.original.isActive ? (
                <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">
                    Actif
                </Badge>
            ) : (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-normal">
                    Inactif
                </Badge>
            ),
        },
        {
            id: "createdAt",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Inscrit le <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => new Date(row.createdAt).getTime(),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {format(new Date(row.original.createdAt), "dd MMM yyyy", { locale: fr })}
                </span>
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => requestDelete(row.original.id, `${row.original.firstName} ${row.original.lastName}`)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageGuard permission={[Permission.USER_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Utilisateurs"
                        description="Gestion centralisée des comptes utilisateurs"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Utilisateurs" },
                        ]}
                    />
                    <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={users.length === 0}>
                            <Download className="h-4 w-4" /> CSV
                        </Button>
                        <Link href="/dashboard/users/new">
                            <Button className="gap-2 shadow-sm">
                                <Plus className="h-4 w-4" />
                                Nouvel utilisateur
                            </Button>
                        </Link>
                    </div>
                </div>

                <Card className="p-4 rounded-xl shadow-sm border border-border">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="w-full sm:w-[200px]">
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="bg-muted/50 border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Tous les rôles</SelectItem>
                                    {Object.entries(roleLabels).map(([val, label]) => (
                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {loading && users.length === 0 ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                    ) : error ? (
                        <div className="flex justify-center items-center gap-2 h-32 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <p>{error.message || "Erreur"}</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 h-40 text-muted-foreground">
                            <Users className="h-8 w-8 text-muted-foreground/50" />
                            <p>Aucun utilisateur trouvé.</p>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={users}
                            searchKey="name"
                            searchPlaceholder="Rechercher par nom..."
                        />
                    )}
                </Card>
            </div>

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setPendingDelete(null);
                }}
                title={pendingDelete ? `Supprimer ${pendingDelete.name} ?` : "Supprimer cet utilisateur ?"}
                description="Cette action est définitive. L’utilisateur perdra l’accès à la plateforme."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleting}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

