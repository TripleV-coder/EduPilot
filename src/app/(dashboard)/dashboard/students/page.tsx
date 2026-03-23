"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { GraduationCap, AlertCircle, Plus, UploadCloud, Trash2, Search as SearchIcon, Filter, Eye, LayoutGrid, TableProperties, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { PageCallout } from "@/components/layout/page-callout";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type Student = {
  id: string;
  studentNumber?: string;
  matricule?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  enrollments?: {
    class?: {
      name: string;
    }
  }[];
};

export default function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const activeFiltersCount = [
    selectedClassId !== "ALL",
    selectedStatus !== "ALL",
    !!searchTerm.trim(),
  ].filter(Boolean).length;

  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(pageSize));
  queryParams.set("page", String(currentPage));
  if (selectedClassId !== "ALL") queryParams.set("classId", selectedClassId);
  if (selectedStatus !== "ALL") queryParams.set("status", selectedStatus);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);

  const { data: response, error, isLoading: loading } = useSWR<any>(`/api/students?${queryParams.toString()}`, fetcher);
  const { data: classesData } = useSWR<any>("/api/classes", fetcher);

  const { mutate } = useSWRConfig();
  const { toast } = useToast();

  const students: Student[] = response?.data || response?.students || (Array.isArray(response) ? response : []);
  const pagination = response?.pagination || null;
  const totalStudents = pagination?.total ?? students.length;
  const totalPages = pagination?.totalPages ?? 1;
  const classes = classesData?.data || classesData?.classes || (Array.isArray(classesData) ? classesData : []);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (!students || students.length === 0) {
      toast({ title: "Export impossible", description: "Aucune donnée à exporter.", variant: "destructive" });
      return;
    }
    const headers = ["Matricule", "Nom", "Prénom", "Classe", "Statut d'inscription"];
    const rows = students.map(s => {
      const className = Array.isArray(s.enrollments) && s.enrollments.length > 0
        ? s.enrollments[0].class?.name
        : "Non assigné";

      return [
        s.matricule || s.studentNumber || "",
        s.user?.lastName || "",
        s.user?.firstName || "",
        className || "",
        s.user?.isActive ? "Actif" : "Inactif"
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eleves_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const requestDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault(); // prevent link navigation
    setPendingDelete({ id, name });
    setDeleteDialogOpen(true);
  };

  const markStudentTransition = (studentId: string) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("edupilot-student-transition", studentId);
  };
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedClassId("ALL");
    setSelectedStatus("ALL");
    setCurrentPage(1);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/students/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast({ title: "Succès", description: "L'élève a été supprimé." });
      setDeleteDialogOpen(false);
      setPendingDelete(null);
      mutate(`/api/students?${queryParams.toString()}`);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const studentColumns: ColumnDef<Student>[] = [
    {
      accessorKey: "matricule",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Matricule <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.matricule || row.original.studentNumber || "—",
    },
    {
      id: "lastName",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Nom <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => row.user?.lastName || "",
    },
    {
      id: "firstName",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Prénom <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => row.user?.firstName || "",
    },
    {
      id: "class",
      header: "Classe",
      accessorFn: (row) =>
        (Array.isArray(row.enrollments) && row.enrollments.length > 0
          ? row.enrollments[0].class?.name
          : "Non assigné") || "Non assigné",
    },
    {
      id: "status",
      header: "Statut",
      accessorFn: (row) => (row.user?.isActive ? "Actif" : "Inactif"),
      cell: ({ row }) => {
        const isActive = row.original.user?.isActive;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${isActive ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
              }`}
          >
            {isActive ? "Actif" : "Inactif"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const student = row.original;
        const name = student.user
          ? `${student.user.firstName} ${student.user.lastName}`
          : student.studentNumber ?? student.matricule ?? "—";
        return (
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/students/${student.id}`} onClick={() => markStudentTransition(student.id)}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => requestDelete(e, student.id, name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </RoleActionGuard>
          </div>
        );
      },
    },
  ];

  const deleteDialogTitle = pendingDelete ? `Supprimer ${pendingDelete.name} ?` : "Supprimer cet élève ?";

  return (
    <PageGuard permission={[Permission.STUDENT_READ, Permission.STUDENT_READ_OWN]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"]}>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageHeader
            title="Élèves"
            description="Liste et gestion des élèves de l'établissement"
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Élèves" },
            ]}
          />
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center border rounded-lg bg-background p-0.5">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="rounded-md touch-target"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Grille
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="rounded-md touch-target"
                onClick={() => setViewMode("table")}
              >
                <TableProperties className="w-4 h-4 mr-2" />
                Tableau
              </Button>
            </div>
            <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
              <Button variant="outline" className="gap-2 shadow-sm touch-target" onClick={handleExportCSV}>
                <UploadCloud className="h-4 w-4" />
                {t("common.exportCsv")}
              </Button>
              <Link href="/dashboard/import">
                <Button variant="outline" className="gap-2 shadow-sm touch-target">
                  <UploadCloud className="h-4 w-4" />
                  {t("common.import")}
                </Button>
              </Link>
              <Link href="/dashboard/students/new">
                <Button className="gap-2 shadow-sm touch-target action-critical">
                  <Plus className="h-4 w-4" />
                  Inscrire un élève
                </Button>
              </Link>
            </RoleActionGuard>
          </div>
        </div>

        {/* Barre de Filtres */}
        <Card className="border-border shadow-sm">
          <div className="p-4 flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
            <div className="relative flex-1 w-full max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                
                className="pl-9 bg-background touch-target"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                <Select value={selectedClassId} onValueChange={handleFilterChange(setSelectedClassId)}>
                  <SelectTrigger className="w-[180px] bg-background touch-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les classes</SelectItem>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={selectedStatus} onValueChange={handleFilterChange(setSelectedStatus)}>
                <SelectTrigger className="w-[150px] bg-background touch-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les statuts</SelectItem>
                  <SelectItem value="ACTIVE">Actif</SelectItem>
                  <SelectItem value="INACTIVE">Inactif</SelectItem>
                </SelectContent>
              </Select>
              {activeFiltersCount > 0 && (
                <>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{activeFiltersCount} filtre{activeFiltersCount > 1 ? "s" : ""}</span>
                  <Button variant="ghost" size="sm" className="touch-target" onClick={resetFilters}>
                    {t("common.reset")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {loading && (
          <div className="space-y-3 py-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-14 rounded-lg bg-muted/40 skeleton-shimmer" />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && students.length === 0 && (
          <PageCallout
            icon={GraduationCap}
            title="Aucun élève enregistré"
            description="Ajoutez vos élèves manuellement ou via import. Une fois inscrits, vous pourrez suivre leur présence, leurs notes et leurs documents."
            actions={[
              { label: t("common.import"), href: "/dashboard/import", variant: "outline" },
              { label: "Inscrire un élève", href: "/dashboard/students/new" },
            ]}
          />
        )}

        {!loading && !error && students.length > 0 && viewMode === "table" && (
          <DataTable columns={studentColumns} data={students} searchKey="lastName" searchPlaceholder="Rechercher par nom..." />
        )}

        {!loading && !error && students.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {students.map((student) => {
              const name = student.user
                ? `${student.user.firstName} ${student.user.lastName}`
                : student.studentNumber ?? student.matricule ?? "—";
              const initials = student.user
                ? `${student.user.firstName[0] ?? ""}${student.user.lastName[0] ?? ""}`.toUpperCase()
                : "?";
              return (
                <Link key={student.id} href={`/dashboard/students/${student.id}`} onClick={() => markStudentTransition(student.id)}>
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
                  <Card className="border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer group">
                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0 group-hover:scale-105 transition-transform">
                        {initials}
                      </div>
                      <div className="overflow-hidden">
                        <CardTitle className="text-sm font-semibold text-foreground truncate">{name}</CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{student.user?.email ?? "—"}</p>
                      </div>
                      <div className="ml-auto">
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => requestDelete(e, student.id, name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </RoleActionGuard>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${student.user?.isActive ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                        {student.user?.isActive ? "Actif" : "Inactif"}
                      </span>
                    </CardContent>
                  </Card>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalStudents > 0 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {totalStudents} élève{totalStudents > 1 ? "s" : ""} au total — Page {currentPage} sur {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="touch-target"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="touch-target"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Suivant
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      <ConfirmActionDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setPendingDelete(null);
        }}
        title={deleteDialogTitle}
        description="Cette action est définitive. Les données liées (inscriptions, historique) peuvent être affectées."
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="destructive"
        isConfirmLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </PageGuard>
  );
}
