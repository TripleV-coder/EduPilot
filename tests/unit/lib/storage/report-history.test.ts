import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    loadRecentReports,
    recordRecentReport,
    type RecentReportEntry,
} from "@/lib/storage/report-history";

const KEY = "edupilot.recent-reports";

function makeStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear: () => store.clear(),
        getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        removeItem: (k: string) => {
            store.delete(k);
        },
        setItem: (k: string, v: string) => {
            store.set(k, v);
        },
    } as Storage;
}

describe("report-history (localStorage)", () => {
    let originalWindow: typeof globalThis.window | undefined;

    beforeEach(() => {
        originalWindow = (globalThis as { window?: typeof globalThis.window }).window;
        (globalThis as { window?: unknown }).window = {
            localStorage: makeStorage(),
        };
    });

    afterEach(() => {
        if (originalWindow === undefined) {
            delete (globalThis as { window?: unknown }).window;
        } else {
            (globalThis as { window?: unknown }).window = originalWindow;
        }
    });

    describe("loadRecentReports", () => {
        it("returns [] when storage is empty", () => {
            expect(loadRecentReports()).toEqual([]);
        });

        it("returns [] when window is undefined (SSR)", () => {
            delete (globalThis as { window?: unknown }).window;
            expect(loadRecentReports()).toEqual([]);
        });

        it("returns [] when stored value is not valid JSON", () => {
            window.localStorage.setItem(KEY, "{not json");
            expect(loadRecentReports()).toEqual([]);
        });

        it("returns [] when stored value is not an array", () => {
            window.localStorage.setItem(KEY, JSON.stringify({ foo: "bar" }));
            expect(loadRecentReports()).toEqual([]);
        });

        it("filters out malformed entries", () => {
            const mixed = [
                { title: "Good", format: "PDF", generatedAt: "2026-01-01T00:00:00Z" },
                { title: "Bad - bad format", format: "XLS", generatedAt: "2026-01-01T00:00:00Z" },
                { title: "Bad - missing generatedAt", format: "PDF" },
                null,
            ];
            window.localStorage.setItem(KEY, JSON.stringify(mixed));
            const entries = loadRecentReports();
            expect(entries).toHaveLength(1);
            expect(entries[0].title).toBe("Good");
        });

        it("returns parsed entries as RecentReportEntry[]", () => {
            const entry: RecentReportEntry = {
                title: "Rapport Trimestre 1",
                format: "PDF",
                generatedAt: "2026-03-01T10:00:00Z",
            };
            window.localStorage.setItem(KEY, JSON.stringify([entry]));
            expect(loadRecentReports()).toEqual([entry]);
        });
    });

    describe("recordRecentReport", () => {
        it("prepends the new entry to the list", () => {
            const a: RecentReportEntry = { title: "A", format: "PDF", generatedAt: "2026-01-01T00:00:00Z" };
            const b: RecentReportEntry = { title: "B", format: "CSV", generatedAt: "2026-01-02T00:00:00Z" };
            window.localStorage.setItem(KEY, JSON.stringify([a]));
            const result = recordRecentReport(b);
            expect(result.map((e) => e.title)).toEqual(["B", "A"]);
        });

        it("caps history at 5 entries", () => {
            const existing: RecentReportEntry[] = Array.from({ length: 5 }, (_, i) => ({
                title: `Old ${i}`,
                format: "PDF" as const,
                generatedAt: `2026-01-0${i + 1}T00:00:00Z`,
            }));
            window.localStorage.setItem(KEY, JSON.stringify(existing));
            const result = recordRecentReport({
                title: "New",
                format: "CSV",
                generatedAt: "2026-02-01T00:00:00Z",
            });
            expect(result).toHaveLength(5);
            expect(result[0].title).toBe("New");
            expect(result[4].title).toBe("Old 3");
        });

        it("persists the new list to localStorage", () => {
            const entry: RecentReportEntry = {
                title: "Persisted",
                format: "PDF",
                generatedAt: "2026-04-01T00:00:00Z",
            };
            recordRecentReport(entry);
            const stored = window.localStorage.getItem(KEY);
            expect(stored).not.toBeNull();
            expect(JSON.parse(stored as string)).toEqual([entry]);
        });

        it("returns [] when window is undefined (SSR)", () => {
            delete (globalThis as { window?: unknown }).window;
            const result = recordRecentReport({
                title: "Ignored",
                format: "PDF",
                generatedAt: "2026-01-01T00:00:00Z",
            });
            expect(result).toEqual([]);
        });

        it("returns the next list even when setItem throws (quota exceeded)", () => {
            const failing = makeStorage();
            failing.setItem = vi.fn(() => {
                throw new Error("QuotaExceededError");
            });
            (globalThis as { window?: unknown }).window = { localStorage: failing };
            const result = recordRecentReport({
                title: "Quota",
                format: "PDF",
                generatedAt: "2026-01-01T00:00:00Z",
            });
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe("Quota");
        });
    });
});
