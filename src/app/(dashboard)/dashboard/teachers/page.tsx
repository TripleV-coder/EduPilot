"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Users, AlertCircle, Plus, UploadCloud, Trash2, ArrowUpDown, Eye, LayoutGrid, TableProperties } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type Teacher = {
  id: string;
  specialization?: string;
  hireDate?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  classSubjects?: { subject?: { name: string } }[];
};

export default function TeachersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (selectedStatus !== "ALL") queryParams.set("status", selectedStatus);

  const { data: response, error, isLoading: loading } = useSWR<any>(`/api/teachers?${queryParams.toString()}`, fetcher);
  const { mutate } = useSWRConfig();
  const { toast } = useToast();

  const teachers: Teacher[] = response?.data || response?.teachers || (Array.isArray(response) ? response : []);

  const handleExportCSV = () => {
    if (!teachers || teachers.length === 0) {
      toast({ title: "Export impossible", description: "Aucune donnée à exporter.", variant: "destructive" });
      return;
    }
    const headers = ["Nom", "Prénom", "Email", "Statut", "Matières", "Date Embauche"];
    const rows = teachers.map(t => [
      t.user?.lastName || "",
      t.user?.firstName || "",
      t.user?.email || "",
      t.user?.isActive ? "Actif" : "Inactif",
      Array.from(new Set(t.classSubjects?.map(cs => cs.subject?.name).filter(Boolean))).join(" - ") || "",
      t.hireDate ? new Date(t.hireDate).toLocaleDateString("fr-FR") : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enseignants_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const requestDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    setPendingDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/teachers/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      toast({ title: "Succès", description: "L'enseignant a été supprimé." });
      setDeleteDialogOpen(false);
      setPendingDelete(null);
      mutate(`/api/teachers?${queryParams.toString()}`);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const teacherColumns: ColumnDef<Teacher>[] = [
    {
      accessorKey: "lastName",
      accessorFn: (row) => row.user?.lastName ?? "",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Nom
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.user?.lastName ?? "—",
    },
    {
      accessorKey: "firstName",
      accessorFn: (row) => row.user?.firstName ?? "",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Pr\u00e9nom
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.user?.firstName ?? "—",
    },
    {
      accessorKey: "email",
      accessorFn: (row) => row.user?.email ?? "",
      header: "Email",
      cell: ({ row }) => row.original.user?.email ?? "—",
    },
    {
      accessorKey: "specialization",
      header: "Sp\u00e9cialit\u00e9",
      cell: ({ row }) => row.original.specialization ?? "—",
    },
    {
      id: "subjects",
      header: "Mati\u00e8res",
      cell: ({ row }) => {
        const subjects = Array.from(new Set(row.original.classSubjects?.map(cs => cs.subject?.name).filter(Boolean)));
        return subjects.length > 0 ? subjects.join(" \u2022 ") : "Aucune";
      },
    },
    {
      accessorKey: "hireDate",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date d&apos;embauche
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = row.original.hireDate ? new Date(row.original.hireDate) : null;
        return date ? new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "short", day: "numeric" }).format(date) : "—";
      },
    },
    {
      id: "status",
      header: "Statut",
      cell: ({ row }) => {
        const isActive = row.original.user?.isActive;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
            {isActive ? "Actif" : "Inactif"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const teacher = row.original;
        const name = teacher.user ? `${teacher.user.firstName} ${teacher.user.lastName}` : "—";
        return (
          <div className="flex items-center gap-1">
            <Link href={`/dashboard/teachers/${teacher.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => requestDelete(e, teacher.id, name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <PageGuard permission={Permission.TEACHER_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageHeader
            title="Enseignants"
            description="Corps enseignant de l'établissement"
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Enseignants" },
            ]}
          />
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode("grid")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode("table")}>
                <TableProperties className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" className="gap-2 shadow-sm" onClick={handleExportCSV}>
              <UploadCloud className="h-4 w-4" />
              {t("common.exportCsv")}
            </Button>
            <Link href="/dashboard/import">
              <Button variant="outline" className="gap-2 shadow-sm">
                <UploadCloud className="h-4 w-4" />
                {t("common.import")}
              </Button>
            </Link>
            <Link href="/dashboard/teachers/new">
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Ajouter un enseignant
              </Button>
            </Link>
          </div>
        </div>

        <Card className="border-border shadow-sm">
          <div className="p-4 flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Input
                
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[150px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="ACTIVE">Actif</SelectItem>
                  <SelectItem value="INACTIVE">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && teachers.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Aucun professeur</h3>
          </div>
        )}

        {!loading && !error && teachers.length > 0 && viewMode === "table" && (
          <DataTable columns={teacherColumns} data={teachers} searchKey="lastName" searchPlaceholder="Rechercher par nom..." />
        )}

        {!loading && !error && teachers.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teachers.map((teacher) => {
              const name = teacher.user ? `${teacher.user.firstName} ${teacher.user.lastName}` : "—";
              const initials = teacher.user ? `${teacher.user.firstName[0]}${teacher.user.lastName[0]}`.toUpperCase() : "?";

              return (
                <Link key={teacher.id} href={`/dashboard/teachers/${teacher.id}`}>
                  <Card className="border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer group">
                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0 group-hover:scale-105 transition-transform">
                        {initials}
                      </div>
                      <div className="overflow-hidden">
                        <CardTitle className="text-sm font-semibold text-foreground truncate">{name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{teacher.user?.email || "—"}</p>
                      </div>
                      <div className="ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => requestDelete(e, teacher.id, name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${teacher.user?.isActive ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                          {teacher.user?.isActive ? "Actif" : "Inactif"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">
                          {teacher.specialization || "Général"}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <p className="text-[11px] text-muted-foreground font-medium uppercase mb-1.5 flex items-center gap-1.5">Matières enseignées</p>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const uniqueSubjects = Array.from(new Set(teacher.classSubjects?.map(cs => cs.subject?.name).filter(Boolean)));
                            return uniqueSubjects.length > 0 ? (
                              <>
                                {uniqueSubjects.slice(0, 3).map((name, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary">
                                    {name}
                                  </span>
                                ))}
                                {uniqueSubjects.length > 3 && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                                    +{uniqueSubjects.length - 3}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/70 italic">Aucune matière</span>
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmActionDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete ? `Supprimer ${pendingDelete.name} ?` : "Supprimer cet enseignant ?"}
        description="Cette action est définitive. Les liens avec les classes et matières peuvent être affectés."
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="destructive"
        isConfirmLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </PageGuard>
  );
}
