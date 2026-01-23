import { formatCurrency } from "@/lib/design-system/tokens";
import { ActivityItem, GradeDistribution, SchoolStats } from "@/hooks/use-analytics";
import { PriorityQueue } from "@/domain/apogee/queue";
import {
  ActivityEntry,
  ActivityPulse,
  ApogeeDashboardModel,
  ApogeeMetric,
  ApogeeQueueSnapshot,
  PerformanceBand,
  Signal,
  TelemetryLog,
} from "@/domain/apogee/model";
import {
  evaluateAttendanceSignal,
  evaluateEngagementSignal,
  evaluateFinanceSignal,
  evaluateGradeSignal,
  evaluateLibrarySignal,
  SIGNAL_SEVERITY_WEIGHT,
} from "@/domain/apogee/telemetry";

export interface DashboardComposerInput {
  readonly stats: SchoolStats;
  readonly grades: GradeDistribution;
  readonly activity: ActivityItem[];
  readonly now?: Date;
}

const formatCompactNumber = (value: number): string =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const sanitizeRate = (value: number): number => (Number.isFinite(value) ? Math.round(value) : 0);

const buildMetrics = (stats: SchoolStats): ApogeeMetric[] => {
  const attendanceRate = sanitizeRate(stats.attendance.rate);
  const paymentTotal = stats.payments.total;

  return [
    {
      id: "students",
      label: "Élèves actifs",
      value: formatCompactNumber(stats.students),
      hint: "Distribution par classe synchronisée.",
      tone: "cobalt",
    },
    {
      id: "teachers",
      label: "Corps enseignant",
      value: formatCompactNumber(stats.teachers),
      hint: "Capacité pédagogique en ligne.",
      tone: "emerald",
    },
    {
      id: "classes",
      label: "Classes en service",
      value: formatCompactNumber(stats.classes),
      hint: "Niveaux actifs consolidés.",
      tone: "graphite",
    },
    {
      id: "attendance",
      label: "Présence journalière",
      value: `${attendanceRate}%`,
      hint: `${stats.attendance.present} présents · ${stats.attendance.absent} absents`,
      tone: attendanceRate >= 88 ? "emerald" : attendanceRate >= 80 ? "gold" : "crimson",
    },
    {
      id: "payments",
      label: "Flux financier (mois)",
      value: formatCurrency(paymentTotal),
      hint: `${stats.payments.count} transactions validées`,
      tone: paymentTotal > 0 ? "gold" : "crimson",
      delta: `${formatCompactNumber(stats.payments.count)} ops`,
    },
    {
      id: "streak",
      label: "Cadence d'exécution",
      value: `${stats.userStats.streak} j`,
      hint: stats.userStats.todayCompleted
        ? "Rythme quotidien verrouillé."
        : "Rituel quotidien incomplet.",
      tone: stats.userStats.streak >= 7 ? "emerald" : "cobalt",
    },
  ];
};

const buildSignals = (stats: SchoolStats, grades: GradeDistribution): Signal[] => {
  const perStudent = stats.students > 0 ? stats.payments.total / stats.students : 0;

  return [
    evaluateAttendanceSignal({
      rate: stats.attendance.rate,
      present: stats.attendance.present,
      absent: stats.attendance.absent,
    }),
    evaluateFinanceSignal({
      total: stats.payments.total,
      count: stats.payments.count,
      perStudent,
    }),
    evaluateGradeSignal(grades),
    evaluateEngagementSignal(stats.userStats),
    evaluateLibrarySignal({ overdue: stats.overdueBooks }),
  ];
};

const buildQueueSnapshot = (signals: Signal[]): ApogeeQueueSnapshot => {
  const queue = new PriorityQueue<Signal>(
    (signal) => SIGNAL_SEVERITY_WEIGHT[signal.severity] * 100 + signal.score
  );
  signals.forEach((signal) => queue.enqueue(signal));
  const ordered = queue.toArray();

  return {
    primary: ordered.slice(0, 3),
    backlog: ordered.slice(3, 7),
  };
};

const buildPerformance = (grades: GradeDistribution): PerformanceBand[] => {
  const total = grades.A + grades.B + grades.C + grades.D + grades.F;
  const resolveIntensity = (count: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  return [
    { grade: "A", count: grades.A, intensity: resolveIntensity(grades.A), tone: "emerald" },
    { grade: "B", count: grades.B, intensity: resolveIntensity(grades.B), tone: "cobalt" },
    { grade: "C", count: grades.C, intensity: resolveIntensity(grades.C), tone: "gold" },
    { grade: "D", count: grades.D, intensity: resolveIntensity(grades.D), tone: "graphite" },
    { grade: "F", count: grades.F, intensity: resolveIntensity(grades.F), tone: "crimson" },
  ];
};

const buildActivityPulse = (items: ActivityItem[], now: Date): ActivityPulse => {
  const entries: ActivityEntry[] = items.map((item) => ({ ...item }));
  const timeValue = (time: string): number => {
    const parsed = new Date(time).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const ordered = [...entries].sort((a, b) => timeValue(b.time) - timeValue(a.time));
  const lastTime = ordered.length > 0 ? timeValue(ordered[0].time) : 0;
  const ageMinutes = lastTime > 0 ? Math.floor((now.getTime() - lastTime) / 60000) : 0;
  const freshness = normalizeScale(120 - ageMinutes, 0, 100);

  const tempo = ordered.filter((entry) => now.getTime() - timeValue(entry.time) <= 3600000).length;
  const tempoScore = normalizeScale(tempo * 18, 12, 100);

  return {
    items: ordered.slice(0, 8),
    tempo: tempoScore,
    freshness,
  };
};

const buildLogbook = (stats: SchoolStats, signals: Signal[], now: Date): TelemetryLog[] => {
  const chronicle = (offsetMinutes: number, scope: Signal["domain"], message: string, context: TelemetryLog["context"]): TelemetryLog => ({
    id: `log:${scope.toLowerCase()}:${offsetMinutes}`,
    timestamp: new Date(now.getTime() - offsetMinutes * 60000).toISOString(),
    scope,
    message,
    context,
  });

  const topSignal = signals[0];

  return [
    chronicle(
      12,
      "SYSTEM",
      "Sync de la matrice opérationnelle stabilisé.",
      { nodes: 5, latencyMs: 12 }
    ),
    chronicle(
      24,
      "ATTENDANCE",
      "Pointage consolidé sur les classes prioritaires.",
      {
        rate: sanitizeRate(stats.attendance.rate),
        present: stats.attendance.present,
        absent: stats.attendance.absent,
      }
    ),
    chronicle(
      38,
      "FINANCE",
      "Boucle de paiement alignée sur le rythme de collecte.",
      { total: stats.payments.total, count: stats.payments.count }
    ),
    chronicle(
      55,
      topSignal?.domain ?? "ACADEMICS",
      "Recommandation prioritaire mise en file d'attente.",
      { label: topSignal?.label ?? "Signal indisponible" }
    ),
  ];
};

const normalizeScale = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
};

export const composeApogeeDashboard = ({
  stats,
  grades,
  activity,
  now = new Date(),
}: DashboardComposerInput): ApogeeDashboardModel => {
  const metrics = buildMetrics(stats);
  const signals = buildSignals(stats, grades);
  const queue = buildQueueSnapshot(signals);
  const performance = buildPerformance(grades);
  const activityPulse = buildActivityPulse(activity, now);
  const logbook = buildLogbook(stats, queue.primary, now);

  const headline =
    queue.primary[0]?.severity === "CLEAR"
      ? "Cadence souveraine"
      : "Vigilance orchestrée";
  const subline = queue.primary[0]
    ? `${queue.primary[0].label} · ${queue.primary[0].hint}`
    : "Synchronisation des flux en cours.";

  return {
    narrative: { headline, subline },
    metrics,
    signals,
    queue,
    performance,
    activity: activityPulse,
    logbook,
  };
};
