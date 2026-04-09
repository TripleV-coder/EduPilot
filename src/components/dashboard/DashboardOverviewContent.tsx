"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { fr } from "date-fns/locale/fr";
import type { UserRole } from "@prisma/client";
import {
  Activity,
  AlertCircle,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  GraduationCap,
  HardDrive,
  MessageSquare,
  ShieldAlert,
  TrendingUp,
  Users,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const SubjectRadarChart = dynamic(() => import("@/components/charts/SubjectRadarChart").then((m) => m.SubjectRadarChart), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[300px] rounded-lg" />,
});
const PerformanceBarChart = dynamic(() => import("@/components/charts/PerformanceBarChart").then((m) => m.PerformanceBarChart), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[300px] rounded-lg" />,
});
const RiskPieChart = dynamic(() => import("@/components/charts/RiskPieChart").then((m) => m.RiskPieChart), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[300px] rounded-lg" />,
});
const TrendLineChart = dynamic(() => import("@/components/charts/TrendLineChart").then((m) => m.TrendLineChart), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[300px] rounded-lg" />,
});
import { StatCard, QuickAction, ActivityItem } from "./DashboardUI";
import { formatAction, translateEntity } from "@/lib/utils/entity-translator";
import { t } from "@/lib/i18n";
import type {
  getAdminDashboardData,
  getGlobalDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getParentDashboardData,
  getAccountantDashboardData,
  getStaffDashboardData,
} from "@/lib/services/analytics-dashboard";

export type GlobalAnalytics = Awaited<ReturnType<typeof getGlobalDashboardData>>;
export type AdminAnalytics = Awaited<ReturnType<typeof getAdminDashboardData>>;
export type TeacherAnalytics = Awaited<ReturnType<typeof getTeacherDashboardData>>;
export type StudentAnalytics = Awaited<ReturnType<typeof getStudentDashboardData>>;
export type ParentAnalytics = Awaited<ReturnType<typeof getParentDashboardData>>;
export type AccountantAnalytics = Awaited<ReturnType<typeof getAccountantDashboardData>>;
export type StaffAnalytics = Awaited<ReturnType<typeof getStaffDashboardData>>;

export type DashboardAnalytics =
  | GlobalAnalytics
  | AdminAnalytics
  | TeacherAnalytics
  | StudentAnalytics
  | ParentAnalytics
  | AccountantAnalytics
  | StaffAnalytics;

type ActivityLog = {
  id: string;
  action: string;
  entity: string;
  createdAt: string | Date;
  user?: { firstName?: string; lastName?: string };
};

type ChildDashboard = {
  name: string;
  myAverage: number;
  myRank: number | null;
  attendanceRate: number;
  subjectPerformances: Array<{ name: string; average: number }>;
  monthlyTrend: Array<{ name: string; value: number }>;
};

interface DashboardOverviewProps {
  analytics: DashboardAnalytics | null;
  isSuperAdminGlobal: boolean;
  role: UserRole;
}

function formatCount(value: string | number | null | undefined) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-BJ", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function getActivityLogStatus(action: string, entity: string): "info" | "success" | "incident" | "grade" | "attendance" {
  const aLower = action.toLowerCase();
  const eLower = entity.toLowerCase();

  if (aLower.includes("login") && !aLower.includes("fail")) return "success";
  if (aLower.includes("create")) return "success";
  if (aLower.includes("delete") || aLower.includes("fail") || aLower.includes("locked")) return "incident";
  if (eLower === "grade") return "grade";
  if (eLower === "attendance") return "attendance";
  return "info";
}

function RecentActivityList({
  items,
  href,
  title,
  emptyLabel = "Aucune activité récente",
}: {
  items?: ActivityLog[];
  href: string;
  title: string;
  emptyLabel?: string;
}) {
  return (
    <Card className="border-none shadow-none bg-muted/20">
      <div className="p-4 border-b border-border/50 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          {title}
        </h3>
        <Link href={href} className="text-[10px] font-bold text-primary uppercase hover:underline">
          Tout voir
        </Link>
      </div>
      <CardContent className="p-4 pt-0">
        {items && items.length > 0 ? (
          items.map((log) => {
            const actor = `${log.user?.firstName || "Système"} ${log.user?.lastName || ""}`.trim();
            const type = getActivityLogStatus(log.action, log.entity);

            return (
              <ActivityItem
                key={log.id}
                type={type}
                title={formatAction(log.action, log.entity)}
                description={`${actor} a agi sur ${translateEntity(log.entity).toLowerCase()}.`}
                time={formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
              />
            );
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
            <Activity className="w-8 h-8 mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest">{emptyLabel}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-none shadow-none bg-muted/20">
      <CardHeader className="border-b border-border/50 space-y-1">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

function SummaryTable({
  rows,
  columns,
}: {
  rows: Array<Record<string, any>>;
  columns: Array<{ key: string; label: string; align?: "left" | "right" | "center" }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-4 py-3 ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row, index) => (
            <tr key={row.id || `${row.name || "row"}-${index}`} className="hover:bg-background/50 transition-colors">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-4 py-3 ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntroCard({ analytics, role, isSuperAdminGlobal }: DashboardOverviewProps) {
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboardOverview.greeting.morning");
    if (h < 18) return t("dashboardOverview.greeting.afternoon");
    return t("dashboardOverview.greeting.evening");
  }, []);

  const progress = useMemo(() => {
    if (isSuperAdminGlobal) return 100;
    
    // Safety check for null analytics
    if (!analytics) return 0;

    if (role === "TEACHER") {
      const a = analytics as TeacherAnalytics;
      let score = 0;
      if (Number(a.myClasses || 0) > 0) score += 30;
      if (Number(a.myStudents || 0) > 0) score += 30;
      if (Array.isArray(a.monthlyTrend) && a.monthlyTrend.length > 0) score += 40;
      return score;
    }
    if (role === "STUDENT") {
      const a = analytics as StudentAnalytics;
      let score = 0;
      if (Number(a.myAverage || 0) > 0) score += 30;
      if (Number(a.attendanceRate || 0) > 0) score += 30;
      if (Array.isArray(a.subjectPerformances) && a.subjectPerformances.length > 0) score += 40;
      return score;
    }
    if (role === "PARENT") {
      const a = analytics as ParentAnalytics;
      return Array.isArray(a.children) && a.children.length > 0 ? 100 : 25;
    }
    if (role === "ACCOUNTANT") {
      const a = analytics as AccountantAnalytics;
      return Number(a.totalFees || 0) > 0 ? 100 : 50;
    }

    const a = analytics as AdminAnalytics | StaffAnalytics;
    let score = 0;
    if (Number(a.totalStudents || 0) > 0) score += 25;
    if (Number(a.attendanceRate || 0) > 0) score += 25;
    
    // subjectSummary exists on AdminAnalytics
    if ("subjectSummary" in a && Array.isArray(a.subjectSummary) && a.subjectSummary.length > 0) score += 25;
    if (Array.isArray(a.classSummary) && a.classSummary.length > 0) score += 25;
    return Math.min(100, score);
  }, [analytics, isSuperAdminGlobal, role]);

  return (
    <Card className="dashboard-block border-border bg-card/90" data-reveal>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{greeting}</span>, {t("dashboardOverview.statusSuffix")}
          </p>
          <div className="min-w-[260px]">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Visibilité du cockpit</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[hsl(var(--success))] transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GlobalDashboard({ analytics }: { analytics: GlobalAnalytics }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Établissements actifs" value={formatCount(analytics?.totalSchools)} icon={Building2} />
        <StatCard title="Utilisateurs actifs" value={formatCount(analytics?.totalUsers)} icon={Users} />
        <StatCard title="Stockage estimé" value={analytics?.storageUsed || "0 GB"} icon={HardDrive} />
        <StatCard title="Écoles récentes" value={formatCount(analytics?.recentSchools?.length)} icon={Activity} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QuickAction label="Établissements" icon={Building2} href="/dashboard/root-control/schools" color="text-blue-500" />
        <QuickAction label="Utilisateurs" icon={Users} href="/dashboard/root-control/users" color="text-purple-500" />
        <QuickAction label="Monitoring" icon={Activity} href="/dashboard/root-control/monitoring" color="text-emerald-500" />
        <QuickAction label="Journal infra" icon={ShieldAlert} href="/dashboard/root-control/logs" color="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityList items={analytics?.recentActivity} href="/dashboard/root-control/logs" title="Journal infrastructure" />
        <SectionCard title="Derniers établissements" description="Vue rapide des créations récentes">
          <SummaryTable
            rows={(analytics?.recentSchools || []).map((school) => ({
              id: school.id,
              name: school.name,
              city: school.city || "N/A",
              action: <Link href="/dashboard/root-control/schools" className="text-primary font-bold hover:underline">Gérer</Link>,
            }))}
            columns={[
              { key: "name", label: "Établissement" },
              { key: "city", label: "Ville" },
              { key: "action", label: "Action", align: "right" },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}

function AdminDashboard({ analytics }: { analytics: AdminAnalytics }) {
  const hasAnnexes = Number(analytics?.annexesCount || 0) > 0;
  const hasSiteComparison = Array.isArray((analytics as any)?.siteComparison) && (analytics as any).siteComparison.length > 0;

  return (
    <>
      {hasAnnexes && (
        <div className="mb-4">
          <SectionCard 
            title="Réseau d'Établissements" 
            description={`Cet espace agrège ${analytics?.annexesCount} autre(s) site(s) accessibles`}
          >
            <div className="flex items-center gap-4">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard/schools">Voir les sites</Link>
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

      {hasSiteComparison && (
        <SectionCard
          title="Comparaison inter-sites"
          description="Lecture rapide des performances entre les sites accessibles dans le même réseau"
        >
          <SummaryTable
            rows={((analytics as any).siteComparison || []).map((site: any) => ({
              id: site.id,
              name: site.name,
              city: site.city,
              studentCount: site.comparisonNote ? "N/A" : formatCount(site.studentCount),
              averageGrade: site.comparisonNote
                ? "N/A"
                : <span className="font-bold text-primary">{Number(site.averageGrade || 0).toFixed(1)}/20</span>,
              attendanceRate: site.comparisonNote ? "N/A" : formatPercent(site.attendanceRate),
              passRate: site.comparisonNote ? "N/A" : formatPercent(site.passRate),
              topSubject: site.comparisonNote || site.topSubject || "N/A",
            }))}
            columns={[
              { key: "name", label: "Site" },
              { key: "city", label: "Ville" },
              { key: "studentCount", label: "Effectif", align: "center" },
              { key: "averageGrade", label: "Moyenne", align: "center" },
              { key: "attendanceRate", label: "Présence", align: "center" },
              { key: "passRate", label: "Réussite", align: "center" },
              { key: "topSubject", label: "Statut / matière", align: "right" },
            ]}
          />
        </SectionCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Effectif total" value={formatCount(analytics?.totalStudents)} delta={analytics?.studentGrowth ? `${analytics.studentGrowth > 0 ? "+" : ""}${analytics.studentGrowth}%` : null} trend={analytics?.studentGrowth && analytics.studentGrowth < 0 ? "down" : "up"} icon={Users} />
        <StatCard title="Taux de présence" value={formatPercent(analytics?.attendanceRate)} delta={analytics?.attendanceGrowth ? `${analytics.attendanceGrowth > 0 ? "+" : ""}${analytics.attendanceGrowth}%` : null} trend={analytics?.attendanceGrowth && analytics.attendanceGrowth < 0 ? "down" : "up"} icon={CheckCircle} />
        <StatCard title="Moyenne générale" value={`${Number(analytics?.averageGrade || 0).toFixed(1)}/20`} delta={analytics?.averageGrowth ? `${analytics.averageGrowth > 0 ? "+" : ""}${analytics.averageGrowth}` : null} trend={analytics?.averageGrowth && analytics.averageGrowth < 0 ? "down" : "up"} icon={GraduationCap} />
        <StatCard title="Alertes actives" value={formatCount(analytics?.activeAlerts)} icon={AlertCircle} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickAction label="Feuille d'appel" icon={UserCheck} href="/dashboard/attendance" color="text-emerald-500" />
        <QuickAction label="Notes" icon={FileText} href="/dashboard/grades/entry" color="text-blue-500" />
        <QuickAction label="Messages" icon={MessageSquare} href="/dashboard/messages" color="text-purple-500" />
        <QuickAction label="Bulletins" icon={GraduationCap} href="/dashboard/grades/bulletins" color="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityList items={analytics?.recentActivity} href="/dashboard/audit-logs" title="Activité récente" />
        <SectionCard title="Performance globale" description="Répartition des niveaux de performance">
          <PerformanceBarChart data={analytics?.performanceDistribution} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Risques & décrochage" description="Distribution des signaux académiques">
          <RiskPieChart data={analytics?.riskDistribution} />
        </SectionCard>
        <SectionCard title="Moyennes par matière" description="Synthèse des matières les plus performantes">
          <SubjectRadarChart data={analytics?.subjectSummary || []} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Top classes" description="Classes les plus solides de la période">
          <SummaryTable
            rows={(analytics?.classSummary || []).map((classe) => ({
              id: classe.name,
              name: classe.name,
              studentCount: formatCount(classe.studentCount),
              average: <span className="font-bold text-primary">{classe.average}/20</span>,
            }))}
            columns={[
              { key: "name", label: "Classe" },
              { key: "studentCount", label: "Effectif", align: "center" },
              { key: "average", label: "Moyenne", align: "right" },
            ]}
          />
        </SectionCard>
        <SectionCard title="Élèves à risque" description="Priorités de suivi du moment">
          <SummaryTable
            rows={(analytics?.atRiskStudents || []).map((student) => ({
              id: student.id,
              name: student.name,
              className: student.className,
              riskLevel: <span className="font-bold text-destructive uppercase">{student.riskLevel}</span>,
            }))}
            columns={[
              { key: "name", label: "Élève" },
              { key: "className", label: "Classe" },
              { key: "riskLevel", label: "Risque", align: "right" },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}

function TeacherDashboard({ analytics }: { analytics: TeacherAnalytics }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Mes classes" value={formatCount(analytics?.myClasses)} icon={Building2} />
        <StatCard title="Mes élèves" value={formatCount(analytics?.myStudents)} icon={Users} />
        <StatCard title="Moyenne suivie" value={`${Number(analytics?.classAverage || 0).toFixed(1)}/20`} icon={TrendingUp} />
        <StatCard title="Élèves à risque" value={formatCount(analytics?.atRiskStudents?.length)} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickAction label="Faire l'appel" icon={UserCheck} href="/dashboard/attendance" color="text-emerald-500" />
        <QuickAction label="Saisir des notes" icon={FileText} href="/dashboard/grades/entry" color="text-blue-500" />
        <QuickAction label="Cours" icon={BookOpen} href="/dashboard/courses" color="text-amber-500" />
        <QuickAction label="Messages" icon={MessageSquare} href="/dashboard/messages" color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Performance par classe" description="Comparaison des classes suivies">
          <SubjectRadarChart data={analytics?.classPerformance || []} />
        </SectionCard>
        <SectionCard title="Tendance académique" description="Évolution moyenne sur les périodes">
          <TrendLineChart data={analytics?.monthlyTrend || []} label="Moyenne" />
        </SectionCard>
      </div>

      <SectionCard title="Élèves à suivre" description="Liste courte pour les interventions rapides">
        <SummaryTable
          rows={(analytics?.atRiskStudents || []).map((student) => ({
            id: student.id,
            name: student.name,
            className: student.className,
            average: `${Number(student.average || 0).toFixed(1)}/20`,
            riskLevel: <span className="font-bold text-destructive uppercase">{student.riskLevel}</span>,
          }))}
          columns={[
            { key: "name", label: "Élève" },
            { key: "className", label: "Classe" },
            { key: "average", label: "Moyenne", align: "center" },
            { key: "riskLevel", label: "Risque", align: "right" },
          ]}
        />
      </SectionCard>
    </>
  );
}

function StudentDashboard({ analytics }: { analytics: StudentAnalytics }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ma moyenne" value={`${Number(analytics?.myAverage || 0).toFixed(1)}/20`} icon={GraduationCap} />
        <StatCard title="Mon rang" value={analytics?.myRank ?? "N/A"} icon={TrendingUp} />
        <StatCard title="Présence" value={formatPercent(analytics?.attendanceRate)} icon={CheckCircle} />
        <StatCard title="Matières suivies" value={formatCount(analytics?.subjectPerformances?.length)} icon={BookOpen} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickAction label="Mes cours" icon={BookOpen} href="/dashboard/courses" color="text-amber-500" />
        <QuickAction label="Devoirs" icon={FileText} href="/dashboard/homework" color="text-blue-500" />
        <QuickAction label="Examens" icon={CalendarClock} href="/dashboard/exams" color="text-emerald-500" />
        <QuickAction label="Orientation" icon={GraduationCap} href="/dashboard/orientation" color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Mes matières" description="Vue radar des résultats actuels">
          <SubjectRadarChart data={analytics?.subjectPerformances || []} />
        </SectionCard>
        <SectionCard title="Progression" description="Évolution par période">
          <TrendLineChart data={analytics?.monthlyTrend || []} label="Moyenne" />
        </SectionCard>
      </div>
    </>
  );
}

function ParentDashboard({ analytics }: { analytics: ParentAnalytics }) {
  const children = (analytics?.children || []) as ChildDashboard[];
  const childrenAverage = children.length > 0
    ? children.reduce((sum, child) => sum + Number(child.myAverage || 0), 0) / children.length
    : 0;
  const attendanceAverage = children.length > 0
    ? children.reduce((sum, child) => sum + Number(child.attendanceRate || 0), 0) / children.length
    : 0;
  const needsAttention = children.filter((child) => Number(child.myAverage || 0) < 10 || Number(child.attendanceRate || 0) < 75).length;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Enfants suivis" value={formatCount(children.length)} icon={Users} />
        <StatCard title="Moyenne familiale" value={`${childrenAverage.toFixed(1)}/20`} icon={GraduationCap} />
        <StatCard title="Présence moyenne" value={formatPercent(attendanceAverage)} icon={CheckCircle} />
        <StatCard title="Suivi prioritaire" value={formatCount(needsAttention)} icon={AlertCircle} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickAction label="Paiements" icon={DollarSign} href="/dashboard/finance" color="text-emerald-500" />
        <QuickAction label="Rendez-vous" icon={CalendarClock} href="/dashboard/appointments" color="text-blue-500" />
        <QuickAction label="Annonces" icon={MessageSquare} href="/dashboard/announcements" color="text-amber-500" />
        <QuickAction label="Messages" icon={MessageSquare} href="/dashboard/messages" color="text-purple-500" />
      </div>

      <SectionCard title="Suivi par enfant" description="Vue synthétique des indicateurs clés">
        <SummaryTable
          rows={children.map((child, index) => ({
            id: `${child.name}-${index}`,
            name: child.name,
            myAverage: `${Number(child.myAverage || 0).toFixed(1)}/20`,
            myRank: child.myRank ?? "N/A",
            attendanceRate: formatPercent(child.attendanceRate),
          }))}
          columns={[
            { key: "name", label: "Élève" },
            { key: "myAverage", label: "Moyenne", align: "center" },
            { key: "myRank", label: "Rang", align: "center" },
            { key: "attendanceRate", label: "Présence", align: "right" },
          ]}
        />
      </SectionCard>

      {children[0]?.monthlyTrend?.length ? (
        <SectionCard title={`Progression de ${children[0].name}`} description="Évolution récente du premier enfant suivi">
          <TrendLineChart data={children[0].monthlyTrend} label="Moyenne" />
        </SectionCard>
      ) : null}
    </>
  );
}

function AccountantDashboard({ analytics }: { analytics: AccountantAnalytics }) {
  const collectionRate = Number(analytics?.totalFees || 0) > 0
    ? (Number(analytics?.paymentsReceived || 0) / Number(analytics?.totalFees || 0)) * 100
    : 0;
  const monthlyTrend = (analytics?.paymentsByMonth || []).map((item) => ({
    name: item.month,
    value: Number(item.received || 0),
  }));
  const maxValue = monthlyTrend.length > 0
    ? Math.max(...monthlyTrend.map((item) => item.value), 0)    
    : 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Encaissements" value={formatCurrency(analytics?.paymentsReceived)} icon={DollarSign} />
        <StatCard title="En attente" value={formatCurrency(analytics?.paymentsPending)} icon={AlertCircle} />
        <StatCard title="Assiette totale" value={formatCurrency(analytics?.totalFees)} icon={CreditCard} />
        <StatCard title="Taux de recouvrement" value={formatPercent(collectionRate)} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickAction label="Frais & paiements" icon={DollarSign} href="/dashboard/finance" color="text-emerald-500" />
        <QuickAction label="Gérer les frais" icon={CreditCard} href="/dashboard/finance/fees" color="text-blue-500" />
        <QuickAction label="Encaissement" icon={CheckCircle} href="/dashboard/finance/payments/new" color="text-amber-500" />
        <QuickAction label="Exports" icon={FileText} href="/dashboard/finance/export" color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Encaissements mensuels" description="Montants reçus par mois">
          <TrendLineChart data={monthlyTrend} label="Encaissements" domain={[0, maxValue > 0 ? maxValue : 1]} />
        </SectionCard>
        <SectionCard title="Statuts de paiement" description="Distribution des traitements">
          <SummaryTable
            rows={[
              { id: "verified", label: "Vérifiés", value: formatCount(analytics?.paymentStatusDistribution?.verified) },
              { id: "pending", label: "En attente", value: formatCount(analytics?.paymentStatusDistribution?.pending) },
              { id: "reconciled", label: "Rapprochés", value: formatCount(analytics?.paymentStatusDistribution?.reconciled) },
              { id: "cancelled", label: "Annulés", value: formatCount(analytics?.paymentStatusDistribution?.cancelled) },
            ]}
            columns={[
              { key: "label", label: "Statut" },
              { key: "value", label: "Volume", align: "right" },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}

function StaffDashboard({ analytics }: { analytics: StaffAnalytics }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Élèves suivis" value={formatCount(analytics?.totalStudents)} icon={Users} />
        <StatCard title="Classes actives" value={formatCount(analytics?.totalClasses)} icon={Building2} />
        <StatCard title="Présence du jour" value={formatPercent(analytics?.attendanceRate)} icon={UserCheck} />
        <StatCard title="Incidents ouverts" value={formatCount(analytics?.activeAlerts)} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <QuickAction label="Appels" icon={UserCheck} href="/dashboard/attendance" color="text-emerald-500" />
        <QuickAction label="Incidents" icon={ShieldAlert} href="/dashboard/incidents" color="text-red-500" />
        <QuickAction label="Élèves" icon={Users} href="/dashboard/students" color="text-blue-500" />
        <QuickAction label="Calendrier" icon={CalendarClock} href="/dashboard/calendar" color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityList items={analytics?.recentActivity} href="/dashboard/audit-logs" title="Activité opérationnelle" />
        <SectionCard title="Classes les plus chargées" description="Effectifs actifs par classe">
          <SummaryTable
            rows={(analytics?.classSummary || []).map((classe: any) => ({
              id: classe.name,
              name: classe.name,
              studentCount: formatCount(classe.studentCount),
            }))}
            columns={[
              { key: "name", label: "Classe" },
              { key: "studentCount", label: "Effectif", align: "right" },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}

export default function DashboardOverviewContent({ analytics, isSuperAdminGlobal, role }: DashboardOverviewProps) {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <IntroCard analytics={analytics} role={role} isSuperAdminGlobal={isSuperAdminGlobal} />

      {isSuperAdminGlobal ? <GlobalDashboard analytics={analytics as GlobalAnalytics} /> : null}
      {!isSuperAdminGlobal && (role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN" || role === "DIRECTOR") ? <AdminDashboard analytics={analytics as AdminAnalytics} /> : null}
      {!isSuperAdminGlobal && role === "TEACHER" ? <TeacherDashboard analytics={analytics as TeacherAnalytics} /> : null}
      {!isSuperAdminGlobal && role === "STUDENT" ? <StudentDashboard analytics={analytics as StudentAnalytics} /> : null}
      {!isSuperAdminGlobal && role === "PARENT" ? <ParentDashboard analytics={analytics as ParentAnalytics} /> : null}
      {!isSuperAdminGlobal && role === "ACCOUNTANT" ? <AccountantDashboard analytics={analytics as AccountantAnalytics} /> : null}
      {!isSuperAdminGlobal && role === "STAFF" ? <StaffDashboard analytics={analytics as StaffAnalytics} /> : null}

      {!isSuperAdminGlobal && !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"].includes(role) ? (
        <SectionCard title="Dashboard indisponible" description="Le rôle courant n'a pas encore de cockpit dédié.">
          <Button asChild>
            <Link href="/dashboard/settings/profile">Ouvrir mon profil</Link>
          </Button>
        </SectionCard>
      ) : null}
    </div>
  );
}
