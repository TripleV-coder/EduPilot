"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Permission } from "@/lib/rbac/permissions";
import {
  ArrowLeft, Pencil, Trash2, Clock, BookOpen, Users,
  CheckCircle2, AlertCircle, Send, Save
} from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type Submission = {
  id: string;
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
  gradedAt: string | null;
  student: {
    user: { firstName: string; lastName: string };
  };
};

type HomeworkDetail = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  maxGrade: number | null;
  coefficient: number | null;
  isPublished: boolean;
  classSubject: {
    subject: { name: string };
    class: { name: string };
    teacher?: { user: { firstName: string; lastName: string } };
  };
  createdBy?: { firstName: string; lastName: string };
  submissions: Submission[];
};

export default function HomeworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const { data: homework, error, isLoading, mutate } = useSWR<HomeworkDetail>(
    `/api/homework/${id}`,
    fetcher
  );

  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState<number>(0);
  const [feedbackValue, setFeedbackValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleteConfirmLoading, setIsDeleteConfirmLoading] = useState(false);

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(d));

  const handleGrade = async (submissionId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/homework/submissions/${submissionId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: gradeValue, feedback: feedbackValue || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      toast({ title: "Succès", description: "La soumission a été notée." });
      setGradingId(null);
      setGradeValue(0);
      setFeedbackValue("");
      mutate();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteConfirmLoading(true);
    try {
      const res = await fetch(`/api/homework/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      toast({ title: "Succès", description: "Le devoir a été supprimé." });
      router.push("/dashboard/homework");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsDeleteConfirmLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!homework) return;
    try {
      const res = await fetch(`/api/homework/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !homework.isPublished }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast({ title: "Succès", description: homework.isPublished ? "Dépublié" : "Publié" });
      mutate();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !homework) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium">Devoir non trouvé</h3>
        <Link href="/dashboard/homework">
          <Button variant="outline" className="mt-4">{t("common.back")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <PageGuard permission={[Permission.EVALUATION_READ, Permission.GRADE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/homework">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader
            title={homework.title}
            description={`${homework.classSubject.class.name} — ${homework.classSubject.subject.name}`}
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Devoirs", href: "/dashboard/homework" },
              { label: homework.title },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleTogglePublish}>
                  {homework.isPublished ? t("common.unpublish") : t("common.publish")}
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-1" /> {t("common.delete")}
                </Button>
              </div>
            }
          />

          <ConfirmActionDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="Supprimer ce devoir"
            description="Cette action est irréversible."
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
            variant="destructive"
            isConfirmLoading={isDeleteConfirmLoading}
            onConfirm={confirmDelete}
          />
        </div>

        {/* Homework details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Détails du devoir
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap">{homework.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge variant={homework.isPublished ? "default" : "secondary"}>
                  {homework.isPublished ? "Publié" : "Brouillon"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date limite</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDate(homework.dueDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Note max</span>
                <span>{homework.maxGrade ?? 20}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coefficient</span>
                <span>{homework.coefficient ?? 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soumissions</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {homework.submissions.length}
                </span>
              </div>
              {homework.createdBy && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créé par</span>
                  <span>{homework.createdBy.firstName} {homework.createdBy.lastName}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submissions */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Soumissions ({homework.submissions.length})
            </CardTitle>
            <CardDescription>Notez les soumissions des élèves</CardDescription>
          </CardHeader>
          <CardContent>
            {homework.submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune soumission pour ce devoir.
              </p>
            ) : (
              <div className="space-y-4">
                {homework.submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {sub.student.user.firstName[0]}{sub.student.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {sub.student.user.firstName} {sub.student.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Soumis le {formatDate(sub.submittedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {sub.grade !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                            <CheckCircle2 className="h-4 w-4" />
                            {sub.grade}/{homework.maxGrade ?? 20}
                          </span>
                          {sub.feedback && (
                            <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={sub.feedback}>
                              — {sub.feedback}
                            </span>
                          )}
                        </div>
                      ) : gradingId === sub.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            type="number"
                            min={0}
                            max={homework.maxGrade ?? 20}
                            value={gradeValue}
                            onChange={(e) => setGradeValue(Number(e.target.value))}
                            className="w-20 h-8"
                            
                          />
                          <span className="text-sm text-muted-foreground">/{homework.maxGrade ?? 20}</span>
                          <Input
                            value={feedbackValue}
                            onChange={(e) => setFeedbackValue(e.target.value)}
                            className="w-48 h-8"
                            
                          />
                          <Button
                            size="sm"
                            onClick={() => handleGrade(sub.id)}
                            disabled={submitting}
                            className="gap-1"
                          >
                            <Send className="h-3 w-3" /> Noter
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setGradingId(null)}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGradingId(sub.id);
                            setGradeValue(0);
                            setFeedbackValue("");
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Noter
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageGuard>
  );
}
