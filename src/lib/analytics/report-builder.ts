export interface ReportFilters {
  schoolId?: string;
  academicYearId?: string;
  periodId?: string;
  classIds?: string[];
  subjectIds?: string[];
}

export type ReportBlockKey =
  | "overview"
  | "performances"
  | "attendance"
  | "risks"
  | "finance";

export type ReportBlocks = Record<ReportBlockKey, boolean>;

export interface ReportSection {
  key: ReportBlockKey;
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

interface BuilderInput {
  filters: ReportFilters;
  blocks: ReportBlocks;
  order: ReportBlockKey[];
}

const SECTION_TITLES: Record<ReportBlockKey, string> = {
  overview: "Synthèse Globale",
  performances: "Performances Académiques",
  attendance: "Assiduité & Ponctualité",
  risks: "Risques & Décrochage",
  finance: "Santé Financière",
};

function fmtNumber(n: number, digits = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function fmtPercent(ratio: number, digits = 1): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio * 100)} %`;
}

function toQuery(filters: ReportFilters): string {
  const sp = new URLSearchParams();
  if (filters.schoolId && filters.schoolId !== "ALL") sp.set("schoolId", filters.schoolId);
  if (filters.academicYearId && filters.academicYearId !== "ALL") sp.set("academicYearId", filters.academicYearId);
  if (filters.periodId && filters.periodId !== "ALL") sp.set("periodId", filters.periodId);
  if (filters.classIds?.length === 1) sp.set("classId", filters.classIds[0]);
  if (filters.subjectIds?.length === 1) sp.set("subjectId", filters.subjectIds[0]);
  return sp.toString();
}

interface DashboardPayload {
  totalStudents?: number;
  averageGrade?: number;
  attendanceRate?: number;
  passRate?: number;
  subjectPerformance?: Array<{ subject: string; average: number }>;
  attendanceByMonth?: Array<{ month: string; rate: number }>;
  atRiskStudents?: Array<{ name: string; level: string; reason?: string }>;
  finance?: {
    totalFees?: number;
    collected?: number;
    outstanding?: number;
    collectionRate?: number;
  };
}

async function fetchDashboard(
  filters: ReportFilters,
  signal?: AbortSignal,
): Promise<DashboardPayload> {
  const qs = toQuery(filters);
  const url = `/api/analytics/dashboard${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Analytics dashboard fetch failed: ${res.status}`);
  return (await res.json()) as DashboardPayload;
}

function overviewSection(payload: DashboardPayload): ReportSection {
  return {
    key: "overview",
    title: SECTION_TITLES.overview,
    headers: ["Indicateur", "Valeur"],
    rows: [
      ["Élèves", String(payload.totalStudents ?? 0)],
      ["Moyenne générale", fmtNumber(payload.averageGrade ?? 0)],
      ["Taux d'assiduité", fmtPercent(payload.attendanceRate ?? 0)],
      ["Taux de réussite", fmtPercent(payload.passRate ?? 0)],
    ],
  };
}

function performancesSection(payload: DashboardPayload): ReportSection {
  return {
    key: "performances",
    title: SECTION_TITLES.performances,
    headers: ["Matière", "Moyenne"],
    rows: (payload.subjectPerformance ?? []).map((s) => [
      s.subject,
      fmtNumber(s.average),
    ]),
  };
}

function attendanceSection(payload: DashboardPayload): ReportSection {
  return {
    key: "attendance",
    title: SECTION_TITLES.attendance,
    headers: ["Mois", "Taux"],
    rows: (payload.attendanceByMonth ?? []).map((m) => [m.month, fmtPercent(m.rate)]),
  };
}

function risksSection(payload: DashboardPayload): ReportSection {
  return {
    key: "risks",
    title: SECTION_TITLES.risks,
    headers: ["Élève", "Niveau", "Motif"],
    rows: (payload.atRiskStudents ?? []).map((s) => [s.name, s.level, s.reason ?? ""]),
  };
}

function financeSection(payload: DashboardPayload): ReportSection {
  const f = payload.finance ?? {};
  return {
    key: "finance",
    title: SECTION_TITLES.finance,
    headers: ["Indicateur", "Valeur"],
    rows: [
      ["Frais totaux", fmtNumber(f.totalFees ?? 0, 0)],
      ["Encaissé", fmtNumber(f.collected ?? 0, 0)],
      ["Impayés", fmtNumber(f.outstanding ?? 0, 0)],
      ["Taux de recouvrement", fmtPercent(f.collectionRate ?? 0)],
    ],
  };
}

export async function buildReportSections(input: BuilderInput): Promise<ReportSection[]> {
  const enabled = input.order.filter((key) => input.blocks[key]);
  if (enabled.length === 0) return [];

  const payload = await fetchDashboard(input.filters);
  const builders: Record<ReportBlockKey, (p: DashboardPayload) => ReportSection> = {
    overview: overviewSection,
    performances: performancesSection,
    attendance: attendanceSection,
    risks: risksSection,
    finance: financeSection,
  };

  return enabled.map((key) => builders[key](payload));
}
