"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { Permission } from "@/lib/rbac/permissions";
import { ArrowLeft, Save, ClipboardList } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";

export default function NewExamPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [classSubjectId, setClassSubjectId] = useState("");
  const [totalPoints, setTotalPoints] = useState(20);
  const [duration, setDuration] = useState(60);
  const [isPublished, setIsPublished] = useState(false);

  const { data: classSubjects } = useSWR<any[]>("/api/class-subjects", fetcher);
  const subjects = Array.isArray(classSubjects) ? classSubjects : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !classSubjectId) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, classSubjectId, totalPoints, duration, isPublished }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast({ title: "Succès", description: "L'examen a été créé." });
      router.push("/dashboard/exams");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageGuard permission={[Permission.EVALUATION_CREATE]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6 max-w-3xl mx-auto pb-10">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/exams">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader
            title="Nouvel Examen"
            description="Créez un modèle d'examen"
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Examens", href: "/dashboard/exams" },
              { label: t("common.new") },
            ]}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Informations de l&apos;examen
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label>Titre <span className="text-destructive">*</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Matière / Classe <span className="text-destructive">*</span></Label>
                <Select value={classSubjectId} onValueChange={setClassSubjectId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((cs: any) => (
                      <SelectItem key={cs.id} value={cs.id}>
                        {cs.class?.name} — {cs.subject?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points total</Label>
                  <Input type="number" min={1} value={totalPoints} onChange={(e) => setTotalPoints(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Durée (minutes)</Label>
                  <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label>{t("common.publishNow")}</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/dashboard/exams">
              <Button type="button" variant="outline" disabled={loading}>{t("common.cancel")}</Button>
            </Link>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />}
              <Save className="h-4 w-4" />
              {t("appActions.createExam")}
            </Button>
          </div>
        </form>
      </div>
    </PageGuard>
  );
}
