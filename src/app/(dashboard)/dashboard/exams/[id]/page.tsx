"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Permission } from "@/lib/rbac/permissions";
import { ArrowLeft, Trash2, Clock, FileText, AlertCircle, PlayCircle } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { useSession } from "next-auth/react";

type ExamDetail = {
  id: string;
  title: string;
  totalPoints: number;
  duration: number;
  isPublished: boolean;
  _count?: { questions: number };
  classSubject?: {
    subject?: { name: string };
    class?: { name: string };
    teacher?: { user: { firstName: string; lastName: string } };
  };
  questions?: { id: string; question: string; points: number; type: string; order: number }[];
};

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const id = params.id as string;

  const { data: exam, error, isLoading } = useSWR<ExamDetail>(`/api/exams/${id}`, fetcher);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteConfirmLoading(true);
    try {
      const res = await fetch(`/api/exams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast({ title: "Succès", description: "L'examen a été supprimé." });
      router.push("/dashboard/exams");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleteConfirmLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">Examen non trouvé</h3>
        <Link href="/dashboard/exams">
          <Button variant="outline" className="mt-4">{t("common.back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <PageGuard permission={[Permission.EVALUATION_READ, Permission.GRADE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/exams">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader
            title={exam.title}
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Examens", href: "/dashboard/exams" },
              { label: exam.title },
            ]}
            actions={
              <div className="flex items-center gap-3">
                {session?.user?.role === "STUDENT" && (
                  <Link href={`/dashboard/exams/${exam.id}/take`}>
                    <Button className="gap-2 font-bold shadow-md">
                      <PlayCircle className="h-4 w-4" /> Passer l&apos;examen
                    </Button>
                  </Link>
                )}
                <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-1" /> {t("common.delete")}
                  </Button>
                </RoleActionGuard>
              </div>
            }
          />
        </div>

        <ConfirmActionDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Supprimer cet examen"
          description="Cette action est irréversible."
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          variant="destructive"
          isConfirmLoading={isDeleteConfirmLoading}
          onConfirm={confirmDelete}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Points total</p>
                  <p className="text-2xl font-bold">{exam.totalPoints}</p>
                </div>
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Durée</p>
                  <p className="text-2xl font-bold">{exam.duration} min</p>
                </div>
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Questions</p>
                  <p className="text-2xl font-bold">{exam._count?.questions ?? exam.questions?.length ?? 0}</p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <Badge variant={exam.isPublished ? "default" : "secondary"} className="mt-3">
                {exam.isPublished ? "Publié" : "Brouillon"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {exam.classSubject && (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {exam.classSubject.class?.name && (
                  <div>
                    <p className="text-muted-foreground">Classe</p>
                    <p className="font-medium">{exam.classSubject.class.name}</p>
                  </div>
                )}
                {exam.classSubject.subject?.name && (
                  <div>
                    <p className="text-muted-foreground">Matière</p>
                    <p className="font-medium">{exam.classSubject.subject.name}</p>
                  </div>
                )}
                {exam.classSubject.teacher?.user && (
                  <div>
                    <p className="text-muted-foreground">Enseignant</p>
                    <p className="font-medium">
                      {exam.classSubject.teacher.user.firstName} {exam.classSubject.teacher.user.lastName}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {exam.questions && exam.questions.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle>Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {exam.questions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                    <span className="text-sm font-bold text-muted-foreground shrink-0">Q{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">{q.points} pts — {q.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageGuard>
  );
}
