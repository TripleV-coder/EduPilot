"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-shell";
import { PageGuard } from "@/components/guard/page-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ArrowUpRight, Users, GraduationCap, 
  Loader2, Save, 
  ChevronRight, Lock, History, UserMinus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// UNDECIDED = statut UI par défaut tant que le staff n'a pas tranché.
// Il n'est jamais envoyé au backend : seules les décisions explicites sont
// appliquées (évite de réinscrire automatiquement des redoublants).
type PromotionStatus = "PROMOTE" | "REPEAT" | "LEAVE" | "UNDECIDED";

type StudentPromotion = {
  id: string;
  name: string;
  average: number | null;
  status: PromotionStatus;
};

type RankedStudent = {
  studentId: string;
  studentName: string;
  average: number | string;
};

type RosterStudent = {
  id: string;
  user: { firstName: string; lastName: string };
};

type AcademicYearOption = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
};

type ClassOption = {
  id: string;
  name: string;
  classLevel?: {
    level: string;
  } | null;
};

export default function PromotionEnginePage() {
  return (
    <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
      <PromotionEngineContent />
    </PageGuard>
  );
}

function PromotionEngineContent() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, PromotionStatus>>({});

  const { data: classesData } = useSWR<ClassOption[] | { data?: ClassOption[] }>("/api/classes", fetcher);
  const classes: ClassOption[] = Array.isArray(classesData) ? classesData : classesData?.data || [];
  const { data: academicYears } = useSWR<AcademicYearOption[]>("/api/academic-years", fetcher);

  // Effectif complet de la classe (année courante), y compris les élèves sans
  // note : ils doivent aussi pouvoir être promus / diplômés / déscolarisés.
  const {
    data: rosterData,
    isLoading: rosterLoading,
  } = useSWR<{ data: RosterStudent[] }>(
    selectedClassId ? `/api/students?classId=${selectedClassId}&limit=100` : null,
    fetcher
  );

  const {
    data: gradeStatsData,
    isLoading: gradeStatsLoading,
  } = useSWR(
    selectedClassId ? `/api/grades/statistics?classId=${selectedClassId}&type=class` : null,
    fetcher
  );

  const students = useMemo<StudentPromotion[]>(() => {
    const roster = (rosterData?.data ?? []) as RosterStudent[];
    // Moyennes par élève (seuls ceux ayant des notes apparaissent ici).
    const averageById = new Map<string, number>();
    for (const r of (gradeStatsData?.ranking?.students ?? []) as RankedStudent[]) {
      averageById.set(r.studentId, Number(r.average));
    }

    return roster.map((student) => {
      const average = averageById.has(student.id) ? averageById.get(student.id)! : null;
      // Suggestion par défaut : promotion pour une moyenne >= 10. Tous les autres
      // cas (sous la moyenne OU sans note) restent « non décidés » et exigent un
      // choix explicite — aucune réinscription/redoublement n'est appliqué à l'aveugle.
      const defaultStatus: PromotionStatus =
        average !== null && average >= 10 ? "PROMOTE" : "UNDECIDED";

      return {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`.trim(),
        average,
        status: statusOverrides[student.id] ?? defaultStatus,
      };
    });
  }, [rosterData, gradeStatsData, statusOverrides]);

  const decidedStudents = useMemo(
    () => students.filter((s) => s.status !== "UNDECIDED"),
    [students]
  );
  const undecidedCount = students.length - decidedStudents.length;

  const setStatus = (id: string, status: "PROMOTE" | "REPEAT" | "LEAVE") => {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  };

  // Cibles valides : années postérieures à l'année courante uniquement
  // (le backend rejette aussi les années antérieures ou égales).
  const targetYearOptions = useMemo(() => {
    const years = academicYears ?? [];
    const current = years.find((y) => y.isCurrent);
    return years
      .filter(
        (y) =>
          !y.isCurrent &&
          (!current || new Date(y.startDate).getTime() > new Date(current.startDate).getTime())
      )
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [academicYears]);

  const handlePromotion = async () => {
    if (!selectedClassId || students.length === 0) return;
    if (!targetYearId) {
      toast({
        title: "Année cible requise",
        description: "Sélectionnez l'année académique de destination avant d'appliquer les promotions.",
        variant: "destructive",
      });
      return;
    }
    if (decidedStudents.length === 0) {
      toast({
        title: "Aucune décision",
        description: "Choisissez une action (promouvoir, redoubler ou partant) pour au moins un élève.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAcademicYearId: targetYearId,
          // Seules les décisions explicites sont envoyées ; les élèves « non
          // décidés » restent inchangés dans leur classe actuelle.
          decisions: decidedStudents.map((s) => ({ studentId: s.id, decision: s.status })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Échec de la promotion");
      }

      const parts = [
        data.promoted ? `${data.promoted} promu(s)` : null,
        data.graduated ? `${data.graduated} diplômé(s)` : null,
        data.repeated ? `${data.repeated} redoublant(s)` : null,
        data.left ? `${data.left} départ(s)` : null,
      ].filter(Boolean);

      toast({
        title: "Promotions appliquées",
        description:
          (parts.length ? parts.join(", ") : "Aucun changement") +
          (data.skipped?.length ? ` — ${data.skipped.length} ignoré(s)` : ""),
      });
      setStatusOverrides({});
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Promotion & Fin d'Année" 
          description="Gérez le passage des élèves en classe supérieure et la clôture de l'exercice académique."
        />
        <div className="flex items-center gap-2">
           <Button variant="destructive" className="h-10 px-6 rounded-xl font-bold uppercase gap-2 shadow-lg shadow-destructive/20">
             <Lock className="w-4 h-4" />
             Clôturer l&apos;Année
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar selection */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-none bg-muted/20">
            <CardHeader className="p-4 border-b border-border/50">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Sélection de Classe
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedClassId(c.id);
                    setStatusOverrides({});
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    selectedClassId === c.id 
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                      : "bg-background border-border/50 hover:border-primary/30 text-foreground"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{c.name}</span>
                    <span className={cn("text-[10px] font-medium uppercase opacity-70", selectedClassId === c.id ? "text-white" : "text-muted-foreground")}>
                      {c.classLevel?.level || "Niveau 1"}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-none bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] p-6">
             <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center shrink-0">
                   <History className="w-5 h-5 text-[hsl(var(--success))]" />
                </div>
                <div className="space-y-1">
                   <h4 className="font-bold text-sm">Archivage automatique</h4>
                   <p className="text-xs text-muted-foreground leading-relaxed">En clôturant l&apos;année, toutes les notes sont figées et les bulletins finaux sont générés en arrière-plan.</p>
                </div>
             </div>
          </Card>
        </div>

        {/* List of students */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-none bg-muted/20 overflow-hidden">
            <CardHeader className="p-4 border-b border-border/50 bg-background/40 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Décisions de Promotion</CardTitle>
              <div className="flex gap-4 items-center">
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Admis: {students.filter(s => s.status === "PROMOTE").length}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Redouble: {students.filter(s => s.status === "REPEAT").length}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">À décider: {undecidedCount}</span>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4 text-left">Élève</th>
                      <th className="px-6 py-4 text-center">Moyenne Générale</th>
                      <th className="px-6 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-background/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold">{s.name}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {s.average === null ? (
                            <span className="text-sm font-bold px-2.5 py-1 rounded-lg bg-muted text-muted-foreground">Aucune note</span>
                          ) : (
                            <span className={cn(
                              "text-sm font-black px-2.5 py-1 rounded-lg",
                              s.average >= 10 ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]" : "bg-destructive/10 text-destructive"
                            )}>{s.average.toFixed(2)} / 20</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => setStatus(s.id, "PROMOTE")}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                                s.status === "PROMOTE" ? "bg-[hsl(var(--success))] border-[hsl(var(--success))] text-white shadow-md shadow-[hsl(var(--success))]/20" : "bg-background border-border/50 text-muted-foreground hover:border-[hsl(var(--success))]/50"
                              )}
                            >
                              <ArrowUpRight className="w-3 h-3" /> Promouvoir
                            </button>
                            <button 
                              onClick={() => setStatus(s.id, "REPEAT")}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                                s.status === "REPEAT" ? "bg-warning border-warning text-white shadow-md shadow-warning/20" : "bg-background border-border/50 text-muted-foreground hover:border-warning/50"
                              )}
                            >
                              <GraduationCap className="w-3 h-3" /> Redoubler
                            </button>
                            <button 
                              onClick={() => setStatus(s.id, "LEAVE")}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border",
                                s.status === "LEAVE" ? "bg-destructive border-destructive text-white shadow-md shadow-destructive/20" : "bg-background border-border/50 text-muted-foreground hover:border-destructive/50"
                              )}
                            >
                              <UserMinus className="w-3 h-3" /> Partant
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="p-6 rounded-2xl bg-muted/40 text-foreground flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                   <Save className="w-6 h-6 text-primary" />
                </div>
                <div>
                   <h3 className="text-lg font-black tracking-tight">Appliquer les promotions</h3>
                   <p className="text-xs text-muted-foreground">
                     {decidedStudents.length} décision(s) seront appliquées vers l&apos;année cible.
                     {undecidedCount > 0 && ` ${undecidedCount} élève(s) « à décider » resteront inchangés.`}
                   </p>
                </div>
             </div>
             <Button
              disabled={isProcessing || !selectedClassId || rosterLoading || gradeStatsLoading || students.length === 0}
               onClick={handlePromotion}
               className="h-12 px-10 rounded-xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white"
             >
               {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
               Enregistrer les Décisions
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
