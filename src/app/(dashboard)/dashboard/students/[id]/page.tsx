"use client";

import type React from "react";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { SignatureBlock } from "@/components/signatures/signature-block";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Permission } from "@/lib/rbac/permissions";
import { 
  GraduationCap, ArrowLeft, Download, Loader2, 
  CalendarCheck, 
  Edit, ShieldAlert, HeartPulse, Banknote, Activity, 
  UserCircle, CreditCard
} from "lucide-react";
import { StudentGradesTab } from "@/components/students/student-grades-tab";
import { ExternalAveragesCard } from "@/components/students/external-averages-card";
import { StudentAttendanceTab } from "@/components/students/student-attendance-tab";
import { StudentPerformanceDashboard } from "@/components/students/student-performance-dashboard";
import { StudentAiPrediction } from "@/components/students/student-ai-prediction";
import { StudentDisciplineTab } from "@/components/students/student-discipline-tab";
import { StudentHealthTab } from "@/components/students/student-health-tab";
import { StudentFinanceTab } from "@/components/students/student-finance-tab";
import {
  StudentRiskCard,
  StudentOrientationAction,
  StudentInterventionPlan,
} from "@/components/ai/student-risk-card";
import { StudentEditDialog } from "@/components/students/student-edit-dialog";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { StudentProfile360 } from "@/components/students/student-profile-360";
import { ParentLinkCodeDialog } from "@/components/students/parent-link-code-dialog";
import { getErrorMessage } from "@/lib/utils/error-message";
import { FetchError } from "@/lib/http-error";

type StudentDetail = {
  id: string;
  studentNumber?: string;
  matricule?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    school?: { name: string };
  };
  enrollments?: Array<{
    class?: { name: string; classLevel?: { level: string } };
    academicYear?: { name: string };
    status: string;
  }>;
  guardians?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string;
  }>;
  parentStudents?: Array<{
    relationship?: string;
    parent?: {
      user?: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string | null;
      };
    };
  }>;
};

export default function StudentDetailPage() {
    // Garde avant chargement (TD-024) : aucune requête tant que le rôle n'est pas admis.
    return (
        <PageGuard permission={[Permission.STUDENT_READ, Permission.STUDENT_READ_OWN]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF", "PARENT", "STUDENT"]}>
            <StudentDetailPageContent />
        </PageGuard>
    );
}

function StudentDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Erreur d'origine (code HTTP) : un refus ou une fiche non rattachée ne
  // s'affiche plus comme une panne à « réessayer » (audit AUD-12).
  const [loadError, setLoadError] = useState<unknown>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [fromListTransition, setFromListTransition] = useState(false);
  const { data: sessionData } = useSession();
  const role = sessionData?.user?.role ?? "";
  const canSignBulletin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NETWORK_ADMIN"].includes(role);
  // Onglets montés seulement pour les rôles que leur API accepte : jamais un
  // onglet qui ne mène qu'à un refus.
  const DIRECTION = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
  const tabs = {
    // Notes : GRADE_READ (le personnel administratif ne l'a pas, TD-022)
    grades: role !== "STAFF",
    // Incidents : direction, enseignants, personnel de vie scolaire
    discipline: [...DIRECTION, "TEACHER", "STAFF"].includes(role),
    // Santé : direction, infirmerie, secrétariat, famille (secret médical)
    health: [...DIRECTION, "NURSE", "SECRETARY", "PARENT", "STUDENT"].includes(role),
    // Situation financière : direction et comptable
    finance: [...DIRECTION, "ACCOUNTANT"].includes(role),
    // Analyses IA : pas pour le personnel administratif (décision TD-022)
    ai: [...DIRECTION, "TEACHER", "PARENT", "STUDENT"].includes(role),
  };

  const fetchStudent = async () => {
    setLoading(true);
    // Un nouvel essai efface l'erreur précédente (elle restait affichée après un succès).
    setError(null);
    setLoadError(null);
    try {
      const r = await fetch("/api/students/" + id, { credentials: "include" });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.status === 404) throw new FetchError(404, "Élève introuvable, ou fiche non rattachée à votre compte.");
        if (r.status === 403) throw new FetchError(403, body.error || "Vous n'avez pas accès à cette fiche.");
        throw new FetchError(r.status, body.error || "Erreur de chargement de la fiche élève.");
      }
      const d = await r.json();
      setStudent(d);
    } catch (e) {
      setError(getErrorMessage(e));
      setLoadError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const studentId = window.sessionStorage.getItem("edupilot-student-transition");
    if (studentId === id) setFromListTransition(true);
    window.sessionStorage.removeItem("edupilot-student-transition");
  }, [id]);

  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);

  const downloadCertificate = async () => {
    setCertLoading(true);
    setCertError(null);
    try {
      const res = await fetch(`/api/certificates/${id}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Impossible de récupérer le certificat");
      }
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `certificat-${id}.pdf`; a.click();
        URL.revokeObjectURL(url);
      } else {
        await res.json();
      }
    } catch (e) { setCertError(getErrorMessage(e)); }
    finally { setCertLoading(false); }
  };

  const name = student?.user ? `${student.user.firstName} ${student.user.lastName}` : "—";
  const currentEnrollment = student?.enrollments?.find((e) => e.status === "ACTIVE");

  return (
    <>
      <PageShell>
      {/* Perf (2026-09-18) : entrée en CSS. L'animation ne joue toujours que
          lorsqu'on arrive depuis la liste (`fromListTransition`). */}
      <div
        className={fromListTransition ? "edu-enter-up flex flex-col gap-6" : "flex flex-col gap-6"}
        style={{ "--edu-enter-dy": "12px", "--edu-enter-s": "0.99", "--edu-enter-d": "280ms" } as React.CSSProperties}
      >
        <PageHeader
          title={loading ? "Chargement…" : name}
          description={student?.studentNumber ?? student?.matricule ?? "Fiche élève"}
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Élèves", href: "/dashboard/students" },
            { label: loading ? "…" : name },
          ]}
          actions={
            <div className="flex items-center gap-3">
              <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}>
                {student?.id ? <ParentLinkCodeDialog studentId={student.id} /> : null}
              </RoleActionGuard>
              <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}>
                {student?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold gap-2"
                    onClick={() => window.open(`/dashboard/cards/print?studentId=${student.id}`, "_blank")}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Carte scolaire
                  </Button>
                ) : null}
              </RoleActionGuard>
              <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
                {student?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-bold gap-2"
                    onClick={() => router.push(`/dashboard/finance/payments/new?studentId=${student.id}`)}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Encaisser
                  </Button>
                ) : null}
              </RoleActionGuard>
              <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
                <Button onClick={() => setIsEditDialogOpen(true)} size="sm" className="h-8 text-xs font-bold gap-2">
                  <Edit className="h-3.5 w-3.5" />
                  Modifier le profil
                </Button>
              </RoleActionGuard>
              <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => router.back()}>
                <ArrowLeft className="h-3.5 w-3.5 mr-2" />
                Retour
              </Button>
            </div>
          }
        />

        {error && <PageError error={loadError} message={error} onRetry={fetchStudent} />}
        
        {loading && !error && <PageLoading label="Chargement de la fiche élève…" />}
        
        {!loading && !error && !student && (
          <PageEmpty
            icon="users"
            title="Élève introuvable"
            description="L'élève demandé n'existe pas ou vous n'avez pas les droits pour y accéder."
            actions={[{ label: "Retour à la liste", href: "/dashboard/students" }]}
          />
        )}

        {!loading && !error && student && (
          <>
            <Tabs defaultValue="profil" className="w-full space-y-6">
              <TabsList className="bg-muted/30 p-1 gap-1 h-auto flex-wrap justify-start border border-border/50">
                <TabsTrigger value="profil" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <UserCircle className="h-3.5 w-3.5" />
                  Vue 360°
                </TabsTrigger>
                {tabs.grades ? (
                  <TabsTrigger value="scolarite" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Scolarité
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="presences" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Présences
                </TabsTrigger>
                {tabs.discipline ? (
                  <TabsTrigger value="discipline" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Discipline
                  </TabsTrigger>
                ) : null}
                {tabs.health ? (
                  <TabsTrigger value="sante" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <HeartPulse className="h-3.5 w-3.5" />
                    Santé
                  </TabsTrigger>
                ) : null}
                {tabs.finance ? (
                  <TabsTrigger value="finances" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Banknote className="h-3.5 w-3.5" />
                    Finances
                  </TabsTrigger>
                ) : null}
                {tabs.ai ? (
                  <TabsTrigger value="suivi" className="gap-2 text-xs font-bold tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Activity className="h-3.5 w-3.5" />
                    Suivi & IA
                  </TabsTrigger>
                ) : null}
              </TabsList>

              {/* Vue 360° tab */}
              <TabsContent value="profil" className="mt-0 space-y-4">
                <StudentProfile360 studentId={id} />

                <Card className="border-none shadow-none bg-muted/20">
                  <CardHeader className="p-4 border-b border-border/50">
                    <CardTitle className="text-xs font-bold text-muted-foreground">Famille</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {(student.guardians?.length ?? 0) === 0 && (student.parentStudents?.length ?? 0) === 0 ? (
                      <p className="text-[12px] text-muted-foreground">
                        Aucun responsable enregistré. Envoyez un code de liaison au parent depuis le menu de la fiche.
                      </p>
                    ) : null}
                    {student.guardians?.map((g) => (
                      <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                        <span>
                          <span className="font-semibold">{g.firstName} {g.lastName}</span>
                          <span className="text-muted-foreground"> · {g.relationship}</span>
                        </span>
                        <a href={`tel:${g.phone}`} className="font-semibold text-primary no-underline">{g.phone}</a>
                      </div>
                    ))}
                    {student.parentStudents?.map((ps, i) =>
                      ps.parent?.user ? (
                        <div key={`account-${i}`} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                          <span>
                            <span className="font-semibold">{ps.parent.user.firstName} {ps.parent.user.lastName}</span>
                            <span className="text-muted-foreground"> · compte parent actif</span>
                          </span>
                          {ps.parent.user.phone ? (
                            <a href={`tel:${ps.parent.user.phone}`} className="font-semibold text-primary no-underline">{ps.parent.user.phone}</a>
                          ) : null}
                        </div>
                      ) : null,
                    )}
                  </CardContent>
                </Card>

                <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
                  <StudentRiskCard studentId={id} />
                </RoleActionGuard>

                <Card className="border-none shadow-none bg-muted/20">
                  <CardHeader className="p-4 border-b border-border/50">
                    <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                      Documents et certificats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Gérez les documents officiels et générez les certificats de scolarité pour cet élève.
                    </p>
                    {certError && <p className="text-xs text-destructive font-bold">{certError}</p>}
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold tracking-tight" onClick={downloadCertificate} disabled={certLoading}>
                      {certLoading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Download className="h-3 w-3 mr-2" />}
                      Certificat de scolarité
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Scolarité tab */}
              {tabs.grades ? (
              <TabsContent value="scolarite" className="mt-0">
                <div className="space-y-6">
                  {currentEnrollment && (
                    <Card className="border-none shadow-none bg-primary/5 border border-primary/10">
                      <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="text-primary w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-muted-foreground">Inscription active</p>
                            <p className="font-bold text-sm">{currentEnrollment.class?.name} &middot; {currentEnrollment.class?.classLevel?.level}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-background text-xs font-bold">
                          Année {currentEnrollment.academicYear?.name}
                        </Badge>
                      </CardContent>
                    </Card>
                  )}
                  <StudentGradesTab studentId={id} />
                  {canSignBulletin ? <ExternalAveragesCard studentId={id} /> : null}
                  <SignatureBlock
                    docType="REPORT_CARD"
                    docId={id}
                    payload={{
                      studentId: id,
                      class: currentEnrollment?.class?.name ?? null,
                      year: currentEnrollment?.academicYear?.name ?? null,
                    }}
                    canSign={canSignBulletin}
                    title="Signature du bulletin"
                  />
                </div>
              </TabsContent>
              ) : null}

              {/* Présences tab */}
              <TabsContent value="presences" className="mt-0">
                <StudentAttendanceTab studentId={id} />
              </TabsContent>

              {/* Discipline tab */}
              {tabs.discipline ? (
                <TabsContent value="discipline" className="mt-0">
                  <StudentDisciplineTab studentId={id} />
                </TabsContent>
              ) : null}

              {/* Santé tab */}
              {tabs.health ? (
                <TabsContent value="sante" className="mt-0">
                  <StudentHealthTab studentId={id} />
                </TabsContent>
              ) : null}

              {/* Finances tab */}
              {tabs.finance ? (
                <TabsContent value="finances" className="mt-0">
                  <StudentFinanceTab studentId={id} />
                </TabsContent>
              ) : null}

              {/* Suivi & IA tab */}
              {tabs.ai ? (
              <TabsContent value="suivi" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StudentPerformanceDashboard studentId={id} />
                  <StudentAiPrediction studentId={id} />
                </div>
                <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <StudentOrientationAction studentId={id} />
                    <StudentInterventionPlan studentId={id} />
                  </div>
                </RoleActionGuard>
              </TabsContent>
              ) : null}
            </Tabs>
          </>
        )}

        {student && (
          <StudentEditDialog
            student={student}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={fetchStudent}
          />
        )}
      </div>
      </PageShell>
    </>
  );
}
