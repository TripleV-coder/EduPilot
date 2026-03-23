"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingTable } from "@/components/ui/loading-table";
import { Permission } from "@/lib/rbac/permissions";
import { 
  GraduationCap, ArrowLeft, Award, Download, Loader2, 
  BookOpen, CalendarCheck, Users, BarChart3, BrainCircuit, 
  Edit, ShieldAlert, HeartPulse, DollarSign, Activity, FileText,
  UserCircle
} from "lucide-react";
import { StudentGradesTab } from "@/components/students/student-grades-tab";
import { StudentAttendanceTab } from "@/components/students/student-attendance-tab";
import { StudentParentsTab } from "@/components/students/student-parents-tab";
import { StudentPerformanceDashboard } from "@/components/students/student-performance-dashboard";
import { StudentAiPrediction } from "@/components/students/student-ai-prediction";
import { StudentEditDialog } from "@/components/students/student-edit-dialog";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { RiskBanner } from "@/components/students/RiskBanner";

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
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [fromListTransition, setFromListTransition] = useState(false);

  const fetchStudent = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/students/" + id, { credentials: "include" });
      if (!r.ok) {
        if (r.status === 404) throw new Error("Élève introuvable");
        throw new Error("Erreur de chargement");
      }
      const d = await r.json();
      setStudent(d);
    } catch (e: any) {
      setError(e.message);
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
    } catch (e: any) { setCertError(e.message); }
    finally { setCertLoading(false); }
  };

  const name = student?.user ? `${student.user.firstName} ${student.user.lastName}` : "—";
  const currentEnrollment = student?.enrollments?.find((e) => e.status === "ACTIVE");

  return (
    <PageGuard permission={[Permission.STUDENT_READ, Permission.STUDENT_READ_OWN]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"]}>
      <motion.div
        className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12"
        initial={fromListTransition ? { opacity: 0, y: 12, scale: 0.99 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageHeader
            title={name}
            description={student?.studentNumber ?? student?.matricule ?? "—"}
          />
          <div className="flex items-center gap-3">
            <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
              <Button onClick={() => setIsEditDialogOpen(true)} size="sm" className="h-8 text-[11px] font-bold uppercase gap-2">
                <Edit className="h-3.5 w-3.5" />
                Modifier profil
              </Button>
            </RoleActionGuard>
            <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase" onClick={() => router.back()}>
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
              Retour
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {loading && <LoadingTable rows={6} cols={2} />}
        
        {!loading && !error && !student && (
          <EmptyState icon={GraduationCap} title="Élève introuvable" description="L'élève demandé n'existe pas ou vous n'avez pas les droits pour y accéder." />
        )}

        {!loading && !error && student && (
          <>
            <RiskBanner score={82} label="Risque Élevé" responsibleName="Mme. Diane Soglo" />

            <Tabs defaultValue="profil" className="w-full space-y-6">
              <TabsList className="bg-muted/30 p-1 gap-1 h-auto flex-wrap justify-start border border-border/50">
                <TabsTrigger value="profil" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <UserCircle className="h-3.5 w-3.5" />
                  Profil
                </TabsTrigger>
                <TabsTrigger value="scolarite" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Scolarité
                </TabsTrigger>
                <TabsTrigger value="presences" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Présences
                </TabsTrigger>
                <TabsTrigger value="discipline" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Discipline
                </TabsTrigger>
                <TabsTrigger value="sante" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <HeartPulse className="h-3.5 w-3.5" />
                  Santé
                </TabsTrigger>
                <TabsTrigger value="finances" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <DollarSign className="h-3.5 w-3.5" />
                  Finances
                </TabsTrigger>
                <TabsTrigger value="suivi" className="gap-2 text-[11px] font-bold uppercase tracking-tight py-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Activity className="h-3.5 w-3.5" />
                  Suivi & IA
                </TabsTrigger>
              </TabsList>

              {/* Profil tab */}
              <TabsContent value="profil" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 border-none shadow-none bg-muted/20">
                    <CardHeader className="p-4 border-b border-border/50">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        Informations Personnelles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Identité</p>
                          <p className="font-bold text-sm">{student.user?.firstName} {student.user?.lastName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Matricule</p>
                          <p className="font-mono text-sm font-bold text-primary">{student.studentNumber ?? student.matricule ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Email</p>
                          <p className="text-sm">{student.user?.email ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Téléphone</p>
                          <p className="text-sm">{student.user?.phone ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Statut Compte</p>
                          <Badge className={cn("text-[10px] font-bold uppercase", student.user?.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                            {student.user?.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-none bg-muted/20">
                    <CardHeader className="p-4 border-b border-border/50">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        Documents & Certificats
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Gérez les documents officiels et générez les certificats de scolarité pour cet élève.
                      </p>
                      {certError && <p className="text-[10px] text-destructive font-bold">{certError}</p>}
                      <Button variant="outline" size="sm" className="w-full h-8 text-[10px] font-bold uppercase tracking-tight" onClick={downloadCertificate} disabled={certLoading}>
                        {certLoading ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Download className="h-3 w-3 mr-2" />}
                        Certificat de Scolarité
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <StudentParentsTab parents={student.parentStudents ?? []} />
              </TabsContent>

              {/* Scolarité tab */}
              <TabsContent value="scolarite" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-6">
                  {currentEnrollment && (
                    <Card className="border-none shadow-none bg-primary/5 border border-primary/10">
                      <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="text-primary w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Inscription Active</p>
                            <p className="font-bold text-sm">{currentEnrollment.class?.name} &middot; {currentEnrollment.class?.classLevel?.level}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-background text-[10px] font-bold uppercase">
                          Année {currentEnrollment.academicYear?.name}
                        </Badge>
                      </CardContent>
                    </Card>
                  )}
                  <StudentGradesTab studentId={id} />
                </div>
              </TabsContent>

              {/* Présences tab */}
              <TabsContent value="presences" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
                <StudentAttendanceTab studentId={id} />
              </TabsContent>

              {/* Discipline tab */}
              <TabsContent value="discipline" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
                <Card className="border-none shadow-none bg-muted/20 min-h-[300px] flex items-center justify-center">
                   <div className="text-center p-8">
                      <ShieldAlert className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-sm font-bold text-muted-foreground">Aucun incident disciplinaire signalé.</p>
                      <p className="text-xs text-muted-foreground mt-1">L&apos;historique des sanctions et mérites apparaîtra ici.</p>
                   </div>
                </Card>
              </TabsContent>

              {/* Santé tab */}
              <TabsContent value="sante" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
                <Card className="border-none shadow-none bg-muted/20 min-h-[300px] flex items-center justify-center">
                   <div className="text-center p-8">
                      <HeartPulse className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-sm font-bold text-muted-foreground">Dossier médical vide.</p>
                      <p className="text-xs text-muted-foreground mt-1">Les allergies, traitements et passages infirmerie seront listés ici.</p>
                   </div>
                </Card>
              </TabsContent>

              {/* Finances tab */}
              <TabsContent value="finances" className="mt-0 animate-in fade-in slide-in-from-bottom-2">
                <Card className="border-none shadow-none bg-muted/20 min-h-[300px] flex items-center justify-center">
                   <div className="text-center p-8">
                      <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-sm font-bold text-muted-foreground">État financier non disponible.</p>
                      <p className="text-xs text-muted-foreground mt-1">Consultez l&apos;historique des paiements et les bourses dans le module Finance.</p>
                   </div>
                </Card>
              </TabsContent>

              {/* Suivi & IA tab */}
              <TabsContent value="suivi" className="mt-0 animate-in fade-in slide-in-from-bottom-2 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StudentPerformanceDashboard studentId={id} />
                  <StudentAiPrediction studentId={id} />
                </div>
              </TabsContent>
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
      </motion.div>
    </PageGuard>
  );
}
