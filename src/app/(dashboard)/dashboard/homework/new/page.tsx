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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { Permission } from "@/lib/rbac/permissions";
import { ArrowLeft, Save, FileText } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";

export default function NewHomeworkPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [classSubjectId, setClassSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxGrade, setMaxGrade] = useState(20);
  const [coefficient, setCoefficient] = useState(1);
  const [isPublished, setIsPublished] = useState(true);

  const { data: classSubjects } = useSWR<any[]>("/api/class-subjects", fetcher);
  const subjects = Array.isArray(classSubjects) ? classSubjects : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!classSubjectId || !title || !description || !dueDate) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
      return;
    }

    if (title.length < 3) {
      toast({ title: "Erreur", description: "Le titre doit faire au moins 3 caractères.", variant: "destructive" });
      return;
    }

    if (description.length < 10) {
      toast({ title: "Erreur", description: "La description doit faire au moins 10 caractères.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSubjectId,
          title,
          description,
          dueDate: new Date(dueDate).toISOString(),
          maxGrade,
          coefficient,
          isPublished,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast({ title: "Succès", description: "Le devoir a été créé avec succès." });
      router.push("/dashboard/homework");
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
          <Link href="/dashboard/homework">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader
            title={`${t("common.new")} Devoir`}
            description="Créez un devoir et assignez-le à une classe"
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Devoirs", href: "/dashboard/homework" },
              { label: t("common.new") },
            ]}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Informations du devoir
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
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

              <div className="space-y-2">
                <Label>Titre <span className="text-destructive">*</span></Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  
                />
              </div>

              <div className="space-y-2">
                <Label>Description <span className="text-destructive">*</span></Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date limite <span className="text-destructive">*</span></Label>
                  <Input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note maximale</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={maxGrade}
                    onChange={(e) => setMaxGrade(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coefficient</Label>
                  <Input
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={coefficient}
                    onChange={(e) => setCoefficient(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                <Label>{t("common.publishNow")}</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/dashboard/homework">
              <Button type="button" variant="outline" disabled={loading}>{t("common.cancel")}</Button>
            </Link>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />}
              <Save className="h-4 w-4" />
              {t("appActions.createHomework")}
            </Button>
          </div>
        </form>
      </div>
    </PageGuard>
  );
}
