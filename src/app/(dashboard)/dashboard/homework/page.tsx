"use client";

import { useState } from "react";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Permission } from "@/lib/rbac/permissions";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import {
  FileText, Plus, AlertCircle, Clock, ArrowUpDown, Eye, Trash2,
  Search, Filter, UploadCloud, Pencil
} from "lucide-react";
import { PageCallout } from "@/components/layout/page-callout";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type HomeworkItem = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  maxGrade?: number;
  coefficient?: number;
  isPublished: boolean;
  classSubject?: {
    subject?: { name: string };
    class?: { name: string };
  };
  _count?: { submissions: number };
  createdBy?: { firstName: string; lastName: string };
};

export default function HomeworkPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

  const { data: response, error, isLoading: loading } = useSWR<any>(
    "/api/homework?limit=100",
    fetcher
  );
  const { data: classesData } = useSWR<any>("/api/classes", fetcher);
  const { mutate } = useSWRConfig();
  const { toast } = useToast();

  const allHomeworks: HomeworkItem[] = response?.homeworks || (Array.isArray(response) ? response : []);
  const classes = classesData?.data || classesData?.classes || (Array.isArray(classesData) ? classesData : []);

  // Client-side filtering
  const homeworks = allHomeworks.filter((hw) => {
    if (selectedStatus !== "ALL") {
      if (selectedStatus === "PUBLISHED" && !hw.isPublished) return false;
      if (selectedStatus === "DRAFT" && hw.isPublished) return false;
    }
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      if (
        !hw.title.toLowerCase().includes(s) &&
        !(hw.classSubject?.subject?.name || "").toLowerCase().includes(s) &&
        !(hw.classSubject?.class?.name || "").toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const handleDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleteConfirmLoading(true);
    try {
      const res = await fetch(`/api/homework/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast({ title: "Succès", description: "Le devoir a été supprimé." });
      mutate("/api/homework?limit=100");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleteConfirmLoading(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleExportCSV = () => {
    if (!homeworks.length) {
      toast({ title: "Export impossible", description: "Aucune donnée à exporter.", variant: "destructive" });
      return;
    }
    const headers = ["Titre", "Matière", "Classe", "Date limite", "Note max", "Statut", "Soumissions"];
    const rows = homeworks.map((hw) => [
      hw.title,
      hw.classSubject?.subject?.name || "",
      hw.classSubject?.class?.name || "",
      new Date(hw.dueDate).toLocaleDateString("fr-FR"),
      hw.maxGrade?.toString() || "20",
      hw.isPublished ? "Publié" : "Brouillon",
      (hw._count?.submissions ?? 0).toString(),
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `devoirs_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));

  const isDueSoon = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  };

  const columns: ColumnDef<HomeworkItem>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Titre <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      id: "subject",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Matière <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => row.classSubject?.subject?.name || "—",
    },
    {
      id: "class",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Classe <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => row.classSubject?.class?.name || "—",
    },
    {
      id: "dueDate",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Date limite <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => new Date(row.dueDate).getTime(),
      cell: ({ row }) => (
        <span className={`flex items-center gap-1 text-sm ${isDueSoon(row.original.dueDate) ? "text-warning font-medium" : ""}`}>
          <Clock className="h-3 w-3" /> {formatDate(row.original.dueDate)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      accessorFn: (row) => row.isPublished ? "Publié" : "Brouillon",
      cell: ({ row }) => (
        <Badge variant={row.original.isPublished ? "default" : "secondary"}>
          {row.original.isPublished ? "Publié" : "Brouillon"}
        </Badge>
      ),
    },
    {
      id: "submissions",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Soumissions <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => row._count?.submissions ?? 0,
      cell: ({ row }) => (
        <span className="text-sm">{row.original._count?.submissions ?? 0}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/homework/${row.original.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(row.original.id, row.original.title)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageGuard permission={[Permission.EVALUATION_READ, Permission.GRADE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6">
        <PageHeader
          title="Devoirs"
          description="Gestion et suivi des devoirs par classe"
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Devoirs" },
          ]}
          actions={
            <div className="flex items-center gap-3">
              <Button variant="outline" className="gap-2 shadow-sm" onClick={handleExportCSV}>
                <UploadCloud className="h-4 w-4" />
                {t("common.exportCsv")}
              </Button>
              <Link href="/dashboard/homework/new">
                <Button className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  {t("appActions.createHomework")}
                </Button>
              </Link>
            </div>
          }
        />

        <ConfirmActionDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Supprimer le devoir"
          description={deleteTarget ? `Cette action supprimera "${deleteTarget.title}".` : undefined}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          variant="destructive"
          isConfirmLoading={isDeleteConfirmLoading}
          onConfirm={confirmDelete}
        />

        {/* Filters */}
        <Card className="border-border shadow-sm">
          <div className="p-4 flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                
                className="pl-9 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[150px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="PUBLISHED">Publiés</SelectItem>
                  <SelectItem value="DRAFT">Brouillons</SelectItem>
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
          <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error.message || "Erreur de chargement"}</p>
          </div>
        )}

        {!loading && !error && homeworks.length === 0 && (
          <PageCallout
            icon={FileText}
            title="Aucun devoir"
            description="Créez un devoir pour une classe et suivez ensuite les soumissions. Vous pouvez aussi exporter la liste au format CSV."
            actions={[{ label: t("appActions.createHomework"), href: "/dashboard/homework/new" }]}
          />
        )}

        {!loading && !error && homeworks.length > 0 && (
          <DataTable columns={columns} data={homeworks} searchKey="title" searchPlaceholder="Filtrer par titre..." />
        )}
      </div>
    </PageGuard>
  );
}
