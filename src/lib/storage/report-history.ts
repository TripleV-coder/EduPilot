export interface RecentReportEntry {
    title: string;
    format: "PDF" | "CSV";
    generatedAt: string;
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
        return parsed.filter(
            (e): e is RecentReportEntry =>
                typeof e === "object" &&
                e !== null &&
                typeof e.title === "string" &&
                (e.format === "PDF" || e.format === "CSV") &&
                typeof e.generatedAt === "string",
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
