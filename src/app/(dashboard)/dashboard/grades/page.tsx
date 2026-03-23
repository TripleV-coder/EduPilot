"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Download, FileText, BarChart3, GraduationCap, 
  Filter, Calendar, TrendingUp, TrendingDown, BookOpen 
} from "lucide-react";
import { EvaluationList } from "@/components/evaluations/EvaluationList";
import { EvaluationSheet } from "@/components/evaluations/EvaluationSheet";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { SubjectRadarChart } from "@/components/charts/SubjectRadarChart";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { PageCallout } from "@/components/layout/page-callout";
import { t } from "@/lib/i18n";

export default function GradesPage() {
  const { data: session } = useSession();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("list");

  const { data: evaluations, isLoading: evalsLoading } = useSWR("/api/evaluations", fetcher);
  const { data: statsData, isLoading: statsLoading } = useSWR("/api/grades/statistics", fetcher);

  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session?.user?.role || "");
  const isTeacher = session?.user?.role === "TEACHER";

  const getScoreColor = (score: number) => {
    if (score >= 16) return "text-emerald-600";
    if (score >= 12) return "text-primary";
    if (score >= 10) return "text-orange-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Notes & Évaluations" 
          description="Gérez les devoirs, saisissez les notes et suivez les performances académiques."
        />
        <div className="flex items-center gap-2 flex-wrap">
           <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase">
             <Download className="w-3.5 h-3.5 mr-2" />
             {t("common.export")}
           </Button>
           <Link href="/dashboard/grades/bulletins">
              <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase">
                <FileText className="w-3.5 h-3.5 mr-2" />
                Bulletins
              </Button>
           </Link>
           {(isAdmin || isTeacher) && (
             <Button onClick={() => setIsSheetOpen(true)} size="sm" className="h-8 text-[11px] font-bold uppercase">
               <Plus className="w-3.5 h-3.5 mr-2" />
               Nouvelle Évaluation
             </Button>
           )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center border-b border-border/50 pb-px">
          <TabsList className="bg-transparent h-auto p-0 gap-6 rounded-none">
            <TabsTrigger 
              value="list" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Liste des Évaluations
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-2 text-xs font-bold uppercase tracking-wider"
            >
              Statistiques & Analyse
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase text-muted-foreground">
              <Filter className="w-3 h-3 mr-1.5" />
              Filtrer par classe
            </Button>
          </div>
        </div>

        <TabsContent value="list" className="mt-0">
          <EvaluationList evaluations={evaluations || []} isLoading={evalsLoading} />
        </TabsContent>

        <TabsContent value="stats" className="mt-0 space-y-6">
          {!statsLoading && !statsData?.statistics && (
            <PageCallout
              icon={BarChart3}
              title="Aucune statistique disponible"
              description="Les statistiques apparaîtront dès que des évaluations auront des notes enregistrées. Commencez par créer une évaluation puis saisissez les notes."
              actions={[
                { label: "Créer une évaluation", href: "/dashboard/grades/entry", variant: "outline" },
              ]}
            />
          )}
          {!statsLoading && statsData?.statistics && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Moyenne Générale</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className={cn("text-2xl font-bold", getScoreColor(statsData.statistics.average))}>
                        {statsData.statistics.average.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 20</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Taux de Réussite</p>
                    <div className="text-2xl font-bold mt-1">
                      {statsData.statistics.passRate.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Plus Haute Note</p>
                    <div className="text-2xl font-bold mt-1 text-emerald-600">
                      {statsData.statistics.highest.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none bg-muted/20 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Plus Basse Note</p>
                    <div className="text-2xl font-bold mt-1 text-destructive">
                      {statsData.statistics.lowest.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Visuals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-none bg-muted/20">
                  <CardHeader className="p-4 border-b border-border/50">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Distribution des Résultats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <PerformanceBarChart data={{
                      excellent: statsData.statistics.gradeDistribution.excellent,
                      good: statsData.statistics.gradeDistribution.good,
                      average: statsData.statistics.gradeDistribution.average,
                      insufficient: statsData.statistics.gradeDistribution.poor,
                      veryGood: 0, weak: 0
                    }} />
                  </CardContent>
                </Card>

                <Card className="border-none shadow-none bg-muted/20">
                  <CardHeader className="p-4 border-b border-border/50">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Radar par Matière
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <SubjectRadarChart data={
                      Object.entries(statsData.statistics.bySubject)
                        .map(([subject, stats]: any) => ({ name: subject, average: stats.average }))
                    } />
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <EvaluationSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} />
    </div>
  );
}
