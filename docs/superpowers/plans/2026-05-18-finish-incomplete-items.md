# Finish Incomplete Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four real placeholders surfaced by the 2026-05-18 audit (fake report export, fake recent-reports list, `alert()` calls and unwired consent UI in /settings/my-data), then commit/push pending work and refresh project memory.

**Architecture:** Pure-function data builder in `src/lib/analytics/report-builder.ts` aggregates analytics data via `fetch()` against existing endpoints (`/api/analytics/dashboard`, `/api/analytics/students`, `/api/analytics/class-comparison` if needed). `AnalyticsReportsTab` calls it, then feeds the result to `exportToCSV`/`exportToPDF` already living in `src/lib/utils/export.ts` (dynamic-imports `jspdf` + `jspdf-autotable`). Recent-reports history is persisted in `localStorage` (no new Prisma model needed). Consent toggles reuse the existing `user.preferences` JSON column via `/api/user/profile` PATCH.

**Tech Stack:** Next.js App Router, React 19, sonner (toast), jspdf + jspdf-autotable (already in deps), vitest, Playwright, Prisma (no schema change).

---

## File Structure

**Create:**
- `src/lib/analytics/report-builder.ts` — pure data builder + section types
- `tests/unit/lib/analytics/report-builder.test.ts` — unit tests for the builder
- `src/lib/storage/report-history.ts` — typed localStorage helpers for recent reports

**Modify:**
- `src/components/analytics/AnalyticsReportsTab.tsx` — real `handleExport`, real recent list
- `src/app/(dashboard)/dashboard/settings/my-data/page.tsx` — toast instead of alert, real consents
- `src/lib/i18n.ts` (only if a new translation key is needed; otherwise inline FR labels)
- `/home/triple-v/.claude/projects/-home-triple-v-Documents-Projets-Personnels-edupilot-master/memory/MEMORY.md` — refresh audit progress

**Reuse as-is:**
- `src/lib/utils/export.ts` (`exportToCSV`, `exportToPDF`)
- `src/components/analytics/AnalyticsContext.tsx` (`useAnalytics`)
- `src/app/api/user/profile/route.ts` (GET + PATCH preferences)
- `src/app/api/analytics/dashboard/route.ts`

---

## Task 1 — Build analytics report data-builder

**Files:**
- Create: `src/lib/analytics/report-builder.ts`
- Create: `tests/unit/lib/analytics/report-builder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/analytics/report-builder.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildReportSections, type ReportFilters, type ReportBlocks } from "@/lib/analytics/report-builder";

const filters: ReportFilters = {
  schoolId: "school-1",
  academicYearId: "year-1",
  periodId: "ALL",
  classIds: [],
  subjectIds: [],
};
const blocks: ReportBlocks = {
  overview: true,
  performances: true,
  attendance: false,
  risks: false,
  finance: false,
};

const dashboardResponse = {
  totalStudents: 120,
  averageGrade: 12.4,
  attendanceRate: 0.94,
  passRate: 0.81,
  subjectPerformance: [
    { subject: "Maths", average: 11.2 },
    { subject: "Français", average: 13.5 },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/analytics/dashboard")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(dashboardResponse) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }),
  );
});

describe("buildReportSections", () => {
  it("returns sections in the requested order, skipping disabled blocks", async () => {
    const sections = await buildReportSections({
      filters,
      blocks,
      order: ["overview", "performances", "attendance", "risks", "finance"],
    });

    expect(sections.map((s) => s.key)).toEqual(["overview", "performances"]);
  });

  it("overview section exposes KPI rows", async () => {
    const sections = await buildReportSections({
      filters,
      blocks: { ...blocks, performances: false },
      order: ["overview"],
    });

    expect(sections[0].title).toBe("Synthèse Globale");
    expect(sections[0].headers).toEqual(["Indicateur", "Valeur"]);
    expect(sections[0].rows).toContainEqual(["Élèves", "120"]);
    expect(sections[0].rows).toContainEqual(["Moyenne générale", "12,40"]);
    expect(sections[0].rows).toContainEqual(["Taux d'assiduité", "94,0 %"]);
    expect(sections[0].rows).toContainEqual(["Taux de réussite", "81,0 %"]);
  });

  it("performances section lists subjects with their average", async () => {
    const sections = await buildReportSections({
      filters,
      blocks: { ...blocks, overview: false },
      order: ["performances"],
    });

    expect(sections[0].title).toBe("Performances Académiques");
    expect(sections[0].headers).toEqual(["Matière", "Moyenne"]);
    expect(sections[0].rows).toEqual([
      ["Maths", "11,20"],
      ["Français", "13,50"],
    ]);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run tests/unit/lib/analytics/report-builder.test.ts`
Expected: FAIL with `Cannot find module '@/lib/analytics/report-builder'`.

- [ ] **Step 3: Implement the builder**

```ts
// src/lib/analytics/report-builder.ts
export interface ReportFilters {
  schoolId?: string;
  academicYearId?: string;
  periodId?: string;
  classIds?: string[];
  subjectIds?: string[];
}

export type ReportBlockKey = "overview" | "performances" | "attendance" | "risks" | "finance";

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
  finance?: { totalFees?: number; collected?: number; outstanding?: number; collectionRate?: number };
}

async function fetchDashboard(filters: ReportFilters, signal?: AbortSignal): Promise<DashboardPayload> {
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
    rows: (payload.subjectPerformance ?? []).map((s) => [s.subject, fmtNumber(s.average)]),
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
  const payload = await fetchDashboard(input.filters);
  const builders: Record<ReportBlockKey, (p: DashboardPayload) => ReportSection> = {
    overview: overviewSection,
    performances: performancesSection,
    attendance: attendanceSection,
    risks: risksSection,
    finance: financeSection,
  };

  return input.order
    .filter((key) => input.blocks[key])
    .map((key) => builders[key](payload));
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `npx vitest run tests/unit/lib/analytics/report-builder.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Run type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/report-builder.ts tests/unit/lib/analytics/report-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(analytics): add report-builder for multi-section PDF/CSV exports

Pure-function pipeline that aggregates analytics dashboard data into
ordered ReportSection[]. Honors the user's block selection and order so
AnalyticsReportsTab can ship a real export instead of a setTimeout stub.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Wire real PDF/CSV export in AnalyticsReportsTab

**Files:**
- Modify: `src/components/analytics/AnalyticsReportsTab.tsx`

- [ ] **Step 1: Add imports for builder, exporters, and useAnalytics**

Add to the top of `src/components/analytics/AnalyticsReportsTab.tsx`:

```tsx
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { buildReportSections, type ReportBlockKey } from "@/lib/analytics/report-builder";
import { exportToCSV, exportToPDF } from "@/lib/utils/export";
```

Replace the existing `useState<Record<string, boolean>>` declaration to use the typed key:

```tsx
const [reportBlocks, setReportBlocks] = useState<Record<ReportBlockKey, boolean>>({
    overview: true,
    performances: true,
    attendance: true,
    risks: true,
    finance: false,
});
const [reportBlockOrder, setReportBlockOrder] = useState<ReportBlockKey[]>([
    "overview", "performances", "attendance", "risks", "finance",
]);
```

Update `dragItem`/`dragOverItem` ref types to `useRef<ReportBlockKey | null>(null)`.

- [ ] **Step 2: Pull filters from context, add busy state**

Just below the existing `useState` calls, add:

```tsx
const { establishmentId, academicYearId, periodId, classIds, subjectIds } = useAnalytics();
const [busy, setBusy] = useState<"PDF" | "CSV" | null>(null);
```

- [ ] **Step 3: Replace the stub handleExport with the real implementation**

Replace lines 45-51 (the current `handleExport`) with:

```tsx
const handleExport = useCallback(async (format: "PDF" | "CSV") => {
    if (busy) return;
    setBusy(format);
    const toastId = toast.loading(`Génération du rapport ${format}…`);
    try {
        const sections = await buildReportSections({
            filters: {
                schoolId: establishmentId,
                academicYearId,
                periodId,
                classIds,
                subjectIds,
            },
            blocks: reportBlocks,
            order: reportBlockOrder,
        });

        if (sections.length === 0) {
            toast.error("Sélectionnez au moins une section à exporter.", { id: toastId });
            return;
        }

        const timestamp = new Date();
        if (format === "CSV") {
            // One CSV per section keeps the file readable; concat with a blank line.
            const merged = sections.flatMap((s, idx) => [
                ...(idx > 0 ? [[""], [""]] : []),
                [s.title],
                s.headers,
                ...s.rows,
            ]);
            exportToCSV({
                title: reportTitle,
                headers: [],
                rows: merged,
                timestamp,
            });
        } else {
            const { jsPDF } = await import("jspdf");
            const autoTable = (await import("jspdf-autotable")).default;
            const doc = new jsPDF();
            const date = timestamp.toLocaleDateString("fr-FR");
            doc.setFontSize(16);
            doc.text(reportTitle, 14, 18);
            doc.setFontSize(10);
            doc.text(`Généré le ${date}`, 14, 26);
            let cursorY = 34;
            sections.forEach((section, idx) => {
                if (idx > 0) cursorY += 8;
                doc.setFontSize(12);
                doc.text(section.title, 14, cursorY);
                cursorY += 4;
                autoTable(doc, {
                    head: [section.headers],
                    body: section.rows,
                    startY: cursorY,
                    margin: { left: 14, right: 14 },
                });
                // jspdf-autotable mutates doc.lastAutoTable.finalY
                cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
            });
            const safe = reportTitle.replace(/[^a-z0-9-_]+/gi, "_");
            doc.save(`${safe}_${date.replace(/\//g, "-")}.pdf`);
        }

        toast.success(`Rapport ${format} généré.`, { id: toastId });
        recordRecentReport({ title: reportTitle, format, generatedAt: timestamp.toISOString() });
    } catch (err) {
        console.error("[AnalyticsReportsTab] export failed", err);
        toast.error(`Échec de l'export ${format}.`, { id: toastId });
    } finally {
        setBusy(null);
    }
}, [busy, reportTitle, reportBlocks, reportBlockOrder, establishmentId, academicYearId, periodId, classIds, subjectIds]);
```

(`recordRecentReport` will be added in Task 3; leave the call in place — TS will surface it as an undefined symbol until then, so do Task 3 in the same checkpoint.)

- [ ] **Step 4: Bind the busy state to the buttons**

Replace the two `<Button>` elements that call `handleExport(...)` with:

```tsx
<Button
    className="w-full h-12 gap-3 font-bold uppercase tracking-tighter shadow-md action-critical"
    onClick={() => handleExport("PDF")}
    disabled={busy !== null}
>
    {busy === "PDF" ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
    {busy === "PDF" ? "Génération…" : "Générer PDF"}
</Button>
<Button
    variant="outline"
    className="w-full h-12 gap-3 font-bold uppercase tracking-tighter"
    onClick={() => handleExport("CSV")}
    disabled={busy !== null}
>
    {busy === "CSV" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
    {busy === "CSV" ? "Génération…" : "Exporter CSV"}
</Button>
```

Add `Loader2` to the existing `lucide-react` import line.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors (except the temporary `recordRecentReport` reference, which Task 3 resolves).

- [ ] **Step 6: Hold the commit until Task 3 lands** (combined commit at end of Task 3).

---

## Task 3 — Persist real recent-reports history

**Files:**
- Create: `src/lib/storage/report-history.ts`
- Modify: `src/components/analytics/AnalyticsReportsTab.tsx`

- [ ] **Step 1: Add the history helper**

```ts
// src/lib/storage/report-history.ts
export interface RecentReportEntry {
    title: string;
    format: "PDF" | "CSV";
    generatedAt: string; // ISO
}

const KEY = "edupilot.recent-reports";
const MAX_ENTRIES = 5;

function safeWindow(): Window | null {
    if (typeof window === "undefined") return null;
    return window;
}

export function loadRecentReports(): RecentReportEntry[] {
    const w = safeWindow();
    if (!w) return [];
    try {
        const raw = w.localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((e): e is RecentReportEntry =>
            typeof e === "object" && e !== null
            && typeof e.title === "string"
            && (e.format === "PDF" || e.format === "CSV")
            && typeof e.generatedAt === "string",
        );
    } catch {
        return [];
    }
}

export function recordRecentReport(entry: RecentReportEntry): RecentReportEntry[] {
    const w = safeWindow();
    if (!w) return [];
    const next = [entry, ...loadRecentReports()].slice(0, MAX_ENTRIES);
    try {
        w.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Quota exceeded or storage disabled — fail silently.
    }
    return next;
}
```

- [ ] **Step 2: Import + state-wire in AnalyticsReportsTab**

Add to the imports block:

```tsx
import { loadRecentReports, recordRecentReport, type RecentReportEntry } from "@/lib/storage/report-history";
import { useEffect } from "react";
```

Inside the component, just after the other `useState` calls:

```tsx
const [recent, setRecent] = useState<RecentReportEntry[]>([]);

useEffect(() => {
    setRecent(loadRecentReports());
}, []);
```

In the `handleExport` success branch (where the temporary `recordRecentReport({...})` call sits) replace with:

```tsx
setRecent(recordRecentReport({ title: reportTitle, format, generatedAt: timestamp.toISOString() }));
```

- [ ] **Step 3: Replace the hardcoded `[1, 2].map` block**

Find lines 151-159 (the `[1, 2].map(i => …)` loop) and replace with:

```tsx
{recent.length === 0 ? (
    <p className="p-4 text-[11px] text-muted-foreground italic">
        Aucun rapport généré pour l&apos;instant.
    </p>
) : (
    recent.map((entry) => (
        <div
            key={entry.generatedAt}
            className="p-4 flex items-center justify-between hover:bg-card transition-colors"
        >
            <div>
                <p className="text-xs font-bold">{entry.title}</p>
                <p className="text-[10px] text-muted-foreground">
                    {entry.format} · {new Date(entry.generatedAt).toLocaleString("fr-FR")}
                </p>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                {entry.format}
            </span>
        </div>
    ))
)}
```

- [ ] **Step 4: Type-check + run existing analytics tests**

Run: `npx tsc --noEmit && npx vitest run tests/unit/lib/analytics`
Expected: 0 type errors, all tests pass.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in, open `/dashboard/analytics`, switch to the **Rapports** tab. Toggle a couple of sections, click **Générer PDF** then **Exporter CSV**, confirm the file downloads with the right content and the recent list updates. (Per CLAUDE.md "Run the dev server and test the UI" — say so explicitly if the dev server can't be started.)

- [ ] **Step 6: Commit Tasks 2 + 3 together**

```bash
git add src/components/analytics/AnalyticsReportsTab.tsx src/lib/storage/report-history.ts
git commit -m "$(cat <<'EOF'
feat(analytics): real PDF/CSV report export + persistent recent list

- handleExport now drives buildReportSections() and exportToPDF/CSV
  instead of a setTimeout success toast
- Honor reportBlocks selection and reportBlockOrder drag-reorder
- Plug filters from AnalyticsContext (school, year, period, class, subject)
- Recent reports persisted in localStorage (max 5, no fake [1, 2] list)
- Buttons show a Loader2 spinner while the export runs

Closes the placeholder flagged in feedback_no_placeholders.md.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — Fix /settings/my-data alerts and consents

**Files:**
- Modify: `src/app/(dashboard)/dashboard/settings/my-data/page.tsx`

- [ ] **Step 1: Replace `alert()` with sonner toasts**

Add to imports:

```tsx
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
```

Replace the three `alert(...)` lines:

```tsx
// line ~33
toast.error("Impossible d'exporter vos données. Veuillez réessayer.");
// line ~48
toast.success("Votre demande de suppression a été enregistrée.");
// line ~50
toast.error("Impossible de traiter votre demande. Veuillez réessayer.");
```

- [ ] **Step 2: Load the user profile to read consents**

Inside the component:

```tsx
const { data: profile, mutate: refreshProfile } = useSWR<{
    preferences?: { consents?: Record<string, boolean> };
}>("/api/user/profile", fetcher);
const consents = profile?.preferences?.consents ?? {};
```

- [ ] **Step 3: Add a typed toggle helper**

Just below the existing `confirmDeleteAccount`:

```tsx
const [pendingConsent, setPendingConsent] = useState<string | null>(null);

const toggleConsent = async (key: "analytics" | "imageRights") => {
    setPendingConsent(key);
    const nextValue = !consents[key];
    try {
        const res = await fetch("/api/user/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                preferences: {
                    ...(profile?.preferences ?? {}),
                    consents: { ...consents, [key]: nextValue },
                },
            }),
        });
        if (!res.ok) throw new Error("update failed");
        await refreshProfile();
        toast.success(nextValue ? "Consentement accordé." : "Consentement retiré.");
    } catch {
        toast.error("Impossible de mettre à jour ce consentement.");
    } finally {
        setPendingConsent(null);
    }
};
```

- [ ] **Step 4: Render real consent rows**

Replace the two hardcoded `<div className="flex justify-between …">` blocks inside the "Consentements" card with:

```tsx
{[
    {
        key: "analytics" as const,
        title: "Utilisation des données pour analyse (Anonymisé)",
        desc: "Nous permet d'améliorer l'application sans vous identifier.",
    },
    {
        key: "imageRights" as const,
        title: "Droit à l'image",
        desc: "Consentement pour la parution d'images de l'élève (Parents uniquement).",
    },
].map((row, idx, arr) => {
    const accorded = !!consents[row.key];
    return (
        <div
            key={row.key}
            className={`flex justify-between items-center ${idx < arr.length - 1 ? "border-b border-border pb-4" : ""}`}
        >
            <div>
                <h4 className="font-medium text-foreground text-sm">{row.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{row.desc}</p>
            </div>
            <div className="flex items-center gap-3">
                <Badge
                    variant="outline"
                    className={
                        accorded
                            ? "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))]"
                            : "bg-muted text-muted-foreground border-border"
                    }
                >
                    {accorded ? "Accordé" : "Refusé"}
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => toggleConsent(row.key)}
                    disabled={pendingConsent === row.key}
                >
                    {pendingConsent === row.key
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : accorded ? "Retirer" : "Accorder"}
                </Button>
            </div>
        </div>
    );
})}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Manual verification**

Reload `/dashboard/settings/my-data`, click **Accorder** on the analytics row, confirm the toast appears and the badge flips to **Accordé**. Refresh the page — value persists (via `user.preferences.consents`). Toggle off — badge returns to **Refusé**.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/dashboard/settings/my-data/page.tsx"
git commit -m "$(cat <<'EOF'
fix(settings/my-data): replace alert() with toast and wire real consents

- Swap three alert() calls for sonner toast (success/error)
- Consent rows now read user.preferences.consents via /api/user/profile
- "Gérer" button toggles the consent and PATCHes the user profile
- Badge reflects real state ("Accordé"/"Refusé") instead of hardcoded

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Commit pending changes already on disk

**Files:** none new — staging only.

- [ ] **Step 1: Confirm working tree state**

Run: `git status -s`
Expected:
```
 M package-lock.json
 M package.json
 M src/lib/ai/inference.ts
 M src/lib/ai/n8n-client.ts
 M src/lib/api/api-helpers.ts
 M src/lib/db/connection-pool.ts
 M src/lib/security/audit-log.ts
 M src/lib/security/rgpd.ts
?? .claude/settings.json
?? e2e/a11y.spec.ts
?? e2e/attendance-flow.spec.ts
?? e2e/finance-flow.spec.ts
?? e2e/grades-flow.spec.ts
?? e2e/parent-flow.spec.ts
```

(Plus the changes Tasks 1-4 just produced, which are already on their own commits.)

- [ ] **Step 2: Stage and commit the type-cleanup**

```bash
git add src/lib/ai/inference.ts src/lib/ai/n8n-client.ts \
        src/lib/api/api-helpers.ts src/lib/db/connection-pool.ts \
        src/lib/security/audit-log.ts src/lib/security/rgpd.ts
git commit -m "$(cat <<'EOF'
chore(types): remove `any` from lib helpers (ai, api, db, security)

Replace `any` with concrete shapes:
- api-helpers: PrismaErrorShape + Session-typed HandlerContext
- audit-log: AuditValue (object|array|null) + Prisma.InputJsonValue
- connection-pool: PrismaFindManyDelegate + OptimizedFindManyOptions
- ai/inference, ai/n8n-client: Record<string, unknown> + narrow casts
- security/rgpd: typed map callbacks for grades/payments/achievements

No runtime change — tsc --noEmit stays clean.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Stage and commit the new E2E specs + axe dep**

```bash
git add package.json package-lock.json \
        e2e/a11y.spec.ts e2e/attendance-flow.spec.ts \
        e2e/finance-flow.spec.ts e2e/grades-flow.spec.ts \
        e2e/parent-flow.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add a11y axe-core sweep + 4 cross-module flows

- e2e/a11y.spec.ts: axe-core run across login, dashboard, students,
  grades, finance and the design-system showcase (WCAG 2.1 AA)
- e2e/{attendance,finance,grades,parent}-flow.spec.ts: end-to-end happy
  paths exercising the dashboards added during the March audit
- Add @axe-core/playwright dev dep used by the a11y spec

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Leave `.claude/settings.json` and `test-results/*` alone**

`.claude/settings.json` is local plugin state; do **not** commit. The two deleted `test-results/.../error-context.md` files are flaky Playwright debug output — leave the deletion uncommitted (they'll come back the next test run). Run `git status -s` and confirm only those entries remain.

---

## Task 6 — Refresh MEMORY.md

**Files:**
- Modify: `/home/triple-v/.claude/projects/-home-triple-v-Documents-Projets-Personnels-edupilot-master/memory/MEMORY.md`

- [ ] **Step 1: Update the Priority 3 status**

Open the memory file. Replace:

```
### Priority 3 - NOT STARTED
13-17: Comparaison inter-classes, inter-périodes, export CSV/PDF, drill-down graphiques, corrélation assiduité/notes
```

with:

```
### Priority 3 - PARTIAL
13. Comparaison inter-classes: DONE (MultiClassComparison + AnalyticsComparisonsTab)
14. Comparaison inter-périodes: DONE (PeriodComparison)
15. Export CSV/PDF analytics: DONE (AnalyticsReportsTab + report-builder, 2026-05-18)
16. Drill-down graphiques: PARTIAL (InteractiveRiskPieChart, InteractivePerformanceBarChart wired; pas encore de drill profond)
17. Corrélation assiduité/notes: PARTIAL (AttendanceGradesScatter rendu, sans interaction)
```

- [ ] **Step 2: Append a note under "Important Notes"**

Add the line:

```
- Analytics report export uses src/lib/analytics/report-builder.ts + src/lib/utils/export.ts (jspdf dynamic-import); recent history in localStorage `edupilot.recent-reports` (max 5)
```

- [ ] **Step 3: No commit needed** — memory lives outside the repo.

---

## Task 7 — Push to origin/main *(requires explicit user approval)*

- [ ] **Step 1: Stop and ask the user**

Push is destructive for collaborators if anything is wrong. Per CLAUDE.md "do not push unless explicitly asked," confirm with the user before running. Show the pending list:

```bash
git log --oneline origin/main..HEAD
```

- [ ] **Step 2: If approved, push**

```bash
git push origin main
```

Expected: fast-forward push, no force flag.

---

## Self-Review Notes

- **Spec coverage:** every audit item maps to a task — fake export → T1+T2, fake recent list → T3, alert/consent → T4, pending working tree → T5, memory drift → T6, unpushed commits → T7. ✅
- **Placeholders:** no "TODO/TBD" in steps. ✅
- **Type consistency:** `ReportBlockKey` introduced in T1, consumed unchanged in T2/T3. `buildReportSections` signature matches the unit test and the caller. ✅
- **No spec gaps:** the audit also flagged `// programId: TODO if we had programs` in `src/app/api/import/classes/route.ts:138`; that one stays as-is because the `Program` Prisma model genuinely doesn't exist yet. Calling it out here so the next pass doesn't re-discover it. (Not a placeholder in the no-placeholders sense — it's a `// TODO if we had X` future-marker, not user-visible.)
