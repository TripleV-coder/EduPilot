"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Users, AlertCircle, Plus, Trash2, ArrowUpDown, Download, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";
import { useSession } from "next-auth/react";

type ParentUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
};

export default function ParentsPage() {
    const { mutate } = useSWRConfig();
    const { toast } = useToast();
    const { data: session } = useSession();
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 30;
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; email: string } | null>(null);
    const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

    const searchParams = new URLSearchParams();
    searchParams.set("role", "PARENT");
    searchParams.set("limit", String(pageSize));
    searchParams.set("page", String(currentPage));
    if (debouncedSearch) searchParams.set("search", debouncedSearch);
    const queryString = searchParams.toString();
    const url = `/api/users?${queryString}`;

    const { data: response, error, isLoading: loading } = useSWR<any>(url, fetcher);
    const parents: ParentUser[] = response?.data || response?.users || (Array.isArray(response) ? response : []);
    const pagination = response?.pagination || null;
    const totalParents = pagination?.total ?? parents.length;
    const totalPages = pagination?.totalPages ?? 1;

    const handleDelete = (id: string, name: string, email: string) => {
        setDeleteTarget({ id, name, email });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleteConfirmLoading(true);
        try {
            const res = await fetch(`/api/users/${deleteTarget.id}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    confirmEmail: deleteTarget.email,
                    deleteType: "SOFT",
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || "Erreur de suppression");
            toast({
                title: "Succès",
                description: data?.message || "Le compte parent a été anonymisé avec succès.",
            });
            mutate(url);
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsDeleteConfirmLoading(false);
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        }
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Prénom", "Email", "Téléphone", "Statut", "Inscrit le"];
        const rows = parents.map(p => [
            p.lastName, p.firstName, p.email,
            p.phone || "N/A",
            p.isActive ? "Actif" : "Inactif",
            format(new Date(p.createdAt), "dd/MM/yyyy", { locale: fr }),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = `parents_${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(dlUrl);
    };

    const columns: ColumnDef<ParentUser>[] = [
        {
            id: "name",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Parent <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.firstName} ${row.lastName}`,
            cell: ({ row }) => {
                const p = row.original;
                return (
                    <div>
                        <p className="font-medium text-foreground">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>
                );
            },
        },
        {
            id: "phone",
            header: "Contact",
            accessorFn: (row) => row.phone || "Non spécifié",
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">{row.original.phone || "Non spécifié"}</span>
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
                <div className="flex items-center justify-end gap-1">
                    {session?.user?.role === "SUPER_ADMIN" ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                                handleDelete(
                                    row.original.id,
                                    `${row.original.firstName} ${row.original.lastName}`,
                                    row.original.email
                                )
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    ) : (
                        <span className="text-xs text-muted-foreground">Aucune action</span>
                    )}
                </div>
            ),
        },
    ];

    return (
        <PageGuard permission={[Permission.USER_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Parents d'élèves"
                        description="Gestion et annuaire des parents d'élèves"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Parents" },
                        ]}
                    />
                    <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={parents.length === 0}>
                            <Download className="h-4 w-4" /> CSV
                        </Button>
                        <Link href="/dashboard/users/new">
                            <Button className="gap-2 shadow-sm">
                                <Plus className="h-4 w-4" />
                                Inviter un parent
                            </Button>
                        </Link>
                    </div>
                </div>

                <ConfirmActionDialog
                    open={deleteDialogOpen}
                    onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) setDeleteTarget(null);
                    }}
                    title="Anonymiser le parent"
                    description={
                        deleteTarget
                            ? `Cette action utilisera la route RGPD existante pour anonymiser "${deleteTarget.name}".`
                            : undefined
                    }
                    confirmLabel={t("common.delete")}
                    cancelLabel={t("common.cancel")}
                    variant="destructive"
                    isConfirmLoading={isDeleteConfirmLoading}
                    onConfirm={confirmDelete}
                />

                <Card className="p-4 rounded-xl shadow-sm border border-border">
                    {loading && parents.length === 0 ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                    ) : error ? (
                        <div className="flex justify-center items-center gap-2 h-32 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <p>{error.message || "Erreur"}</p>
                        </div>
                    ) : parents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 h-40 text-muted-foreground">
                            <Users className="h-8 w-8 text-muted-foreground/50" />
                            <p>Aucun parent trouvé.</p>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={parents}
                            searchKey="name"
                            searchPlaceholder="Rechercher par nom..."
                        />
                    )}
                </Card>

                {/* Pagination */}
                {!loading && !error && totalParents > 0 && (
                    <div className="flex items-center justify-between border-t border-border pt-4">
                        <p className="text-sm text-muted-foreground">
                            {totalParents} parent{totalParents > 1 ? "s" : ""} au total — Page {currentPage} sur {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Précédent
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                            >
                                Suivant
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
