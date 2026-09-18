import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { normalizeNotificationLink } from "@/lib/utils/notification-links";

const DASHBOARD_DIR = join(process.cwd(), "src/app/(dashboard)");

/** Vrai si la route `/dashboard/...` correspond à une page existante. */
function pageExists(route: string): boolean {
    const segments = route.split("/").filter(Boolean);
    const walk = (dir: string, rest: string[]): boolean => {
        if (rest.length === 0) return existsSync(join(dir, "page.tsx"));
        const [head, ...tail] = rest;
        if (existsSync(join(dir, head)) && walk(join(dir, head), tail)) return true;
        return existsSync(join(dir, "[id]")) && walk(join(dir, "[id]"), tail);
    };
    return walk(DASHBOARD_DIR, segments);
}

describe("normalizeNotificationLink", () => {
    it("laisse vides les liens absents", () => {
        expect(normalizeNotificationLink(null)).toBeUndefined();
        expect(normalizeNotificationLink(undefined)).toBeUndefined();
        expect(normalizeNotificationLink("")).toBeUndefined();
    });

    it("ne touche ni aux liens déjà corrects ni aux liens externes", () => {
        expect(normalizeNotificationLink("/dashboard/grades")).toBe("/dashboard/grades");
        expect(normalizeNotificationLink("https://example.org/x")).toBe("https://example.org/x");
    });

    // Formes réellement écrites en base par les routes avant correction
    it.each([
        ["/courses/c1", "/dashboard/courses/c1"],
        ["/homework/h1", "/dashboard/homework/h1"],
        ["/incidents/i1", "/dashboard/incidents/i1"],
        ["/appointments/a1", "/dashboard/appointments"],
        ["/scholarships/s1", "/dashboard/scholarships"],
        ["/payments/plans/p1", "/dashboard/finance"],
        ["/parent/payments", "/dashboard/finance"],
        ["/events/e1", "/dashboard/events"],
        ["/announcements/n1", "/dashboard/announcements"],
        ["/compliance/data-requests/d1", "/dashboard/compliance"],
        ["/exams/sessions/x1", "/dashboard/exams"],
        ["/messages/m1", "/dashboard/messages"],
        ["/student/grades", "/dashboard/grades"],
        ["/student/bulletins", "/dashboard/grades/bulletins"],
        ["/dashboard/report-cards", "/dashboard/grades/bulletins"],
    ])("%s → %s, une page qui existe", (legacy, expected) => {
        const target = normalizeNotificationLink(legacy);
        expect(target).toBe(expected);
        expect(pageExists(target!)).toBe(true);
    });

    it("rebase sous /dashboard un lien interne inconnu", () => {
        expect(normalizeNotificationLink("/")).toBe("/dashboard");
        expect(normalizeNotificationLink("/grades")).toBe("/dashboard/grades");
        expect(normalizeNotificationLink("grades")).toBe("/dashboard/grades");
    });
});
