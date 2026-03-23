"use client";

import { useState } from "react";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Permission } from "@/lib/rbac/permissions";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Plus, AlertCircle, FileText, ArrowUpDown, Eye, Trash2, Clock
} from "lucide-react";

import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { PageCallout } from "@/components/layout/page-callout";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type ExamItem = {
  id: string;
  title: string;
  totalPoints: number;
  duration: number;
  isPublished: boolean;
  _count?: { questions: number };
  classSubject?: {
    subject?: { name: string };
    class?: { name: string };
  };
};

export default function ExamsPage() {
  const { data: response, error, isLoading: loading } = useSWR<any>("/api/exams", fetcher);
  const { mutate } = useSWRConfig();
  const { toast } = useToast();

  const exams: ExamItem[] = response?.exams || (Array.isArray(response) ? response : []);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

  const handleDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleteConfirmLoading(true);
    try {
      const res = await fetch(`/api/exams/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast({ title: "Succès", description: "L'examen a été supprimé." });
      mutate("/api/exams");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleteConfirmLoading(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const columns: ColumnDef<ExamItem>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Titre <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium">{row.original.title}</div>,
    },
    {
      id: "questions",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Questions <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      accessorFn: (row) => row._count?.questions ?? 0,
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-sm">
          <FileText className="h-3 w-3" /> {row.original._count?.questions ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "totalPoints",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Points <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{row.original.totalPoints} pts</span>,
    },
    {
      accessorKey: "duration",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Durée <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-sm">
          <Clock className="h-3 w-3" /> {row.original.duration} min
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
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={`/dashboard/exams/${row.original.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(row.original.id, row.original.title)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </RoleActionGuard>
        </div>
      ),
    },
  ];

  return (
    <PageGuard permission={[Permission.EVALUATION_READ, Permission.GRADE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6">
        <PageHeader
          title="Examens"
          description="Création et gestion des modèles d'examens"
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Examens" },
          ]}
          actions={
            <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
              <Link href="/dashboard/exams/new">
                <Button className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Nouvel examen
                </Button>
              </Link>
            </RoleActionGuard>
          }
        />

        <ConfirmActionDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteTarget(null);
          }}
          title="Supprimer l'examen"
          description={deleteTarget ? `Cette action supprimera "${deleteTarget.title}".` : undefined}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          variant="destructive"
          isConfirmLoading={isDeleteConfirmLoading}
          onConfirm={confirmDelete}
        />

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

        {!loading && !error && exams.length === 0 && (
          <PageCallout
            icon={ClipboardList}
            title="Aucun examen créé"
            description="Créez un modèle d’examen, ajoutez des questions puis publiez-le pour permettre une session d’examen."
            actions={[{ label: "Nouvel examen", href: "/dashboard/exams/new" }]}
          />
        )}

        {!loading && !error && exams.length > 0 && (
          <DataTable columns={columns} data={exams} searchKey="title" searchPlaceholder="Rechercher un examen..." />
        )}
      </div>
    </PageGuard>
  );
}
