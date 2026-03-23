"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
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

type StudentPromotion = {
  id: string;
  name: string;
  average: number;
  status: "PROMOTE" | "REPEAT" | "LEAVE";
};

export default function PromotionEnginePage() {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: classes } = useSWR("/api/classes", fetcher);

  const {
    data: gradeStatsData,
    isLoading: gradeStatsLoading,
  } = useSWR(
    selectedClassId ? `/api/grades/statistics?classId=${selectedClassId}&type=class` : null,
    fetcher
  );

  const [students, setStudents] = useState<StudentPromotion[]>([]);

  useEffect(() => {
    const list = gradeStatsData?.ranking?.students ?? [];
    setStudents(
      list.map((s: any) => ({
        id: s.studentId,
        name: s.studentName,
        average: Number(s.average),
        status: Number(s.average) >= 10 ? "PROMOTE" : "REPEAT",
      }))
    );
  }, [gradeStatsData]);

  const setStatus = (id: string, status: "PROMOTE" | "REPEAT" | "LEAVE") => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handlePromotion = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const promoteCount = students.filter((s) => s.status === "PROMOTE").length;
      toast({
        title: "Décisions enregistrées",
        description: `Promotion: ${promoteCount} élève(s). La migration backend reste à implémenter dans cette version.`,
      });
    }, 2000);
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
              {classes?.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
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
                          <span className={cn(
                            "text-sm font-black px-2.5 py-1 rounded-lg",
                            s.average >= 10 ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]" : "bg-destructive/10 text-destructive"
                          )}>{s.average.toFixed(2)} / 20</span>
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
                   <p className="text-xs text-muted-foreground">Cette action migrera les {students.filter(s => s.status === "PROMOTE").length} élèves vers l&apos;année suivante.</p>
                </div>
             </div>
             <Button 
              disabled={isProcessing || !selectedClassId || gradeStatsLoading || students.length === 0} 
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
