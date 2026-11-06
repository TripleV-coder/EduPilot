import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { Permission, hasPermission } from "@/lib/rbac/permissions";

import * as fiscalYear from "@/app/api/accounting/fiscal-year/route";
import * as reforms from "@/app/api/admin/config/reforms/route";
import * as appointmentOptions from "@/app/api/appointments/options/route";
import * as attendanceAlerts from "@/app/api/attendance/alerts/route";
import * as calendarEvents from "@/app/api/calendar/events/route";
import * as publicHolidays from "@/app/api/calendar/public-holidays/route";
import * as canteenMenu from "@/app/api/canteen/menu/route";
import * as classLevels from "@/app/api/class-levels/route";
import * as configAcademic from "@/app/api/config/academic/route";
import * as configBenin from "@/app/api/config/benin/route";
import * as councilRules from "@/app/api/config/council-rules/route";
import * as setupStatus from "@/app/api/config/setup-status/route";
import * as debugSession from "@/app/api/debug/session/route";
import * as incidentNotifications from "@/app/api/incidents/notifications/route";
import * as fedapay from "@/app/api/integrations/fedapay/route";
import * as momo from "@/app/api/integrations/momo/route";
import * as whatsapp from "@/app/api/integrations/whatsapp/route";
import * as meSubjects from "@/app/api/me/subjects/route";
import * as publicSchool from "@/app/api/public/schools/[code]/route";
import * as rootSummary from "@/app/api/root/analytics/summary/route";
import * as rootSystemMap from "@/app/api/root/system-map/route";
import * as settingsConfigs from "@/app/api/settings/configs/route";
import * as setupAlias from "@/app/api/setup/route";
import * as balances from "@/app/api/students/[id]/balances/route";
import * as roleCounts from "@/app/api/users/role-counts/route";
import * as uxAnalytics from "@/app/api/ux/analytics/route";
import * as voiceRecent from "@/app/api/voice-notifs/recent/route";
import * as walletOverview from "@/app/api/wallet/overview/route";
import * as wellbeingOverview from "@/app/api/wellbeing/overview/route";

/**
 * Matrice d'accès des 33 routes qui n'avaient AUCUN test (vrais handlers,
 * vrai PostgreSQL) : sans session → 401 ; rôle non admis → 403 ; rôle admis
 * → ni 401, ni 403, ni 500. Les rôles refusés des routes à permission sont
 * calculés depuis la matrice RBAC elle-même.
 */
type Handler = Parameters<typeof callRoute>[0];
type Case = {
    name: string;
    handler: Handler;
    method?: string;
    path: string;
    params?: Record<string, string>;
    body?: unknown;
    allowed?: UserRole;
    denied: UserRole[];
    /** Route publique : pas de 401 attendu sans session. */
    isPublic?: boolean;
};

const ALL: UserRole[] = ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF", "PARENT", "STUDENT"];
const lacking = (p: Permission) => ALL.filter((r) => !hasPermission(r, p));

let schoolId: string;
let otherSchoolId: string;
let studentId: string;
let cases: Case[] = [];

beforeAll(async () => {
    schoolId = (await createSchool("IT-MTX")).id;
    otherSchoolId = (await createSchool("IT-MTX-B")).id;
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Matrice", role: "STUDENT", schoolId },
    });
    studentId = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;

    cases = [
        { name: "accounting/fiscal-year POST", handler: fiscalYear.POST, method: "POST", path: "/api/accounting/fiscal-year", body: {}, allowed: "ACCOUNTANT", denied: ["TEACHER", "PARENT", "STUDENT", "STAFF"] },
        { name: "admin/config/reforms GET", handler: reforms.GET, path: "/api/admin/config/reforms", denied: lacking(Permission.SYSTEM_READ) },
        { name: "appointments/options GET", handler: appointmentOptions.GET, path: "/api/appointments/options", allowed: "PARENT", denied: ["TEACHER", "DIRECTOR", "STUDENT"] },
        { name: "attendance/alerts GET", handler: attendanceAlerts.GET, path: "/api/attendance/alerts", allowed: "DIRECTOR", denied: lacking(Permission.ATTENDANCE_READ) },
        // Calendrier et menu : lecture pour toute l'école, écriture pour la direction
        { name: "calendar/events GET", handler: calendarEvents.GET, path: "/api/calendar/events", allowed: "PARENT", denied: [] },
        { name: "calendar/events POST", handler: calendarEvents.POST, method: "POST", path: "/api/calendar/events", body: {}, denied: ["TEACHER", "PARENT", "ACCOUNTANT"] },
        { name: "calendar/public-holidays GET", handler: publicHolidays.GET, path: "/api/calendar/public-holidays", allowed: "STUDENT", denied: [] },
        { name: "calendar/public-holidays POST", handler: publicHolidays.POST, method: "POST", path: "/api/calendar/public-holidays", body: {}, denied: ["TEACHER", "PARENT"] },
        { name: "canteen/menu GET", handler: canteenMenu.GET, path: "/api/canteen/menu", allowed: "PARENT", denied: [] },
        { name: "canteen/menu POST", handler: canteenMenu.POST, method: "POST", path: "/api/canteen/menu", body: {}, denied: ["TEACHER", "PARENT", "STUDENT"] },
        { name: "class-levels GET", handler: classLevels.GET, path: "/api/class-levels", allowed: "DIRECTOR", denied: lacking(Permission.SCHOOL_READ) },
        { name: "config/academic GET", handler: configAcademic.GET, path: "/api/config/academic", allowed: "TEACHER", denied: [] },
        { name: "config/academic PATCH", handler: configAcademic.PATCH, method: "PATCH", path: "/api/config/academic", body: {}, denied: ["TEACHER", "PARENT", "ACCOUNTANT"] },
        { name: "config/benin GET", handler: configBenin.GET, path: "/api/config/benin?type=mentions", allowed: "PARENT", denied: [] },
        { name: "config/council-rules GET", handler: councilRules.GET, path: "/api/config/council-rules", allowed: "TEACHER", denied: ["PARENT", "STUDENT"] },
        { name: "config/council-rules PUT", handler: councilRules.PUT, method: "PUT", path: "/api/config/council-rules", body: {}, denied: ["TEACHER", "PARENT"] },
        { name: "config/setup-status GET", handler: setupStatus.GET, path: "/api/config/setup-status", allowed: "DIRECTOR", denied: ["TEACHER", "PARENT", "STUDENT"] },
        // Lecture : ses propres notifications (tout rôle) ; envoi : direction et enseignants
        { name: "incidents/notifications GET", handler: incidentNotifications.GET, path: "/api/incidents/notifications?limit=999999", allowed: "PARENT", denied: [] },
        { name: "incidents/notifications POST", handler: incidentNotifications.POST, method: "POST", path: "/api/incidents/notifications", body: {}, denied: ["PARENT", "STUDENT", "ACCOUNTANT"] },
        { name: "integrations/fedapay GET", handler: fedapay.GET, path: "/api/integrations/fedapay", allowed: "ACCOUNTANT", denied: ["PARENT", "STUDENT", "TEACHER", "STAFF"] },
        { name: "integrations/momo GET", handler: momo.GET, path: "/api/integrations/momo", allowed: "ACCOUNTANT", denied: ["PARENT", "STUDENT", "TEACHER", "STAFF"] },
        { name: "integrations/whatsapp GET", handler: whatsapp.GET, path: "/api/integrations/whatsapp", allowed: "DIRECTOR", denied: ["PARENT", "STUDENT", "TEACHER", "ACCOUNTANT"] },
        // Direction admise (pages corrections et nouveau cours) : liste vide pour elle
        { name: "me/subjects GET", handler: meSubjects.GET, path: "/api/me/subjects", allowed: "TEACHER", denied: ["PARENT", "STUDENT", "ACCOUNTANT", "STAFF"] },
        { name: "root/analytics/summary GET", handler: rootSummary.GET, path: "/api/root/analytics/summary", denied: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
        { name: "root/system-map GET", handler: rootSystemMap.GET, path: "/api/root/system-map", denied: ["SCHOOL_ADMIN", "DIRECTOR"] },
        { name: "settings/configs GET", handler: settingsConfigs.GET, path: "/api/settings/configs", allowed: "SCHOOL_ADMIN", denied: ["DIRECTOR", "TEACHER", "PARENT"] },
        { name: "students/[id]/balances GET", handler: balances.GET, path: `/api/students/${studentId}/balances`, params: { id: studentId }, allowed: "ACCOUNTANT", denied: ["TEACHER", "PARENT", "STUDENT", "STAFF"] },
        { name: "users/role-counts GET", handler: roleCounts.GET, path: "/api/users/role-counts", allowed: "DIRECTOR", denied: ["TEACHER", "PARENT", "ACCOUNTANT"] },
        { name: "ux/analytics GET", handler: uxAnalytics.GET, path: "/api/ux/analytics", denied: ["SCHOOL_ADMIN", "DIRECTOR"] },
        { name: "voice-notifs/recent GET", handler: voiceRecent.GET, path: "/api/voice-notifs/recent", allowed: "DIRECTOR", denied: ["TEACHER", "PARENT"] },
        { name: "wallet/overview GET", handler: walletOverview.GET, path: "/api/wallet/overview", allowed: "ACCOUNTANT", denied: ["TEACHER", "PARENT", "STAFF"] },
        { name: "wellbeing/overview GET", handler: wellbeingOverview.GET, path: "/api/wellbeing/overview", allowed: "DIRECTOR", denied: ["TEACHER", "PARENT", "STUDENT"] },
    ];
});

const call = (c: Case) =>
    callRoute(c.handler, { method: c.method ?? "GET", path: c.path, params: c.params, body: c.body });

// Chaque test parcourt toute la matrice et rapporte TOUS les écarts d'un coup
// (un échec ne masque pas les suivants).
describe("matrice d'accès des routes jusqu'ici sans test", () => {
    it("sans session : 401 partout", async () => {
        const failures: string[] = [];
        for (const c of cases.filter((x) => !x.isPublic)) {
            actAs(null);
            const res = await call(c);
            if (res.status !== 401) failures.push(`${c.name} → ${res.status}`);
        }
        expect(failures).toEqual([]);
    });

    it("rôle non admis : 403", async () => {
        const failures: string[] = [];
        for (const c of cases) {
            for (const role of c.denied) {
                actAs(sessionFor(role, schoolId));
                const res = await call(c);
                if (res.status !== 403) failures.push(`${c.name} en ${role} → ${res.status}`);
            }
        }
        expect(failures).toEqual([]);
    });

    it("rôle admis : traité (ni 401, ni 403, ni 500)", async () => {
        const failures: string[] = [];
        for (const c of cases.filter((x) => x.allowed)) {
            actAs(sessionFor(c.allowed!, schoolId));
            const res = await call(c);
            if ([401, 403].includes(res.status) || res.status >= 500) {
                failures.push(`${c.name} en ${c.allowed} → ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`);
            }
        }
        expect(failures).toEqual([]);
    });

    it("solde d'un élève : refusé au comptable d'une autre école", async () => {
        actAs(sessionFor("ACCOUNTANT", otherSchoolId));
        const res = await callRoute(balances.GET, { path: `/api/students/${studentId}/balances`, params: { id: studentId } });
        expect([403, 404]).toContain(res.status);
    });

    it("route de débogage fermée hors développement", async () => {
        actAs(sessionFor("SUPER_ADMIN", null));
        const res = await callRoute(debugSession.GET, { path: "/api/debug/session" });
        expect(res.status).toBe(404);
    });

    it("annuaire public : un code inconnu ou une école non publique ne révèle rien (404)", async () => {
        actAs(null);
        const unknown = await callRoute(publicSchool.GET, { path: "/api/public/schools/INCONNU", params: { code: "INCONNU" } });
        expect(unknown.status).toBe(404);
        const hidden = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { code: true, isPublic: true } });
        if (!hidden.isPublic) {
            const res = await callRoute(publicSchool.GET, { path: `/api/public/schools/${hidden.code}`, params: { code: hidden.code } });
            expect(res.status).toBe(404);
        }
    });

    it("/api/setup (alias de l'installation) : déjà installée, rien à créer", async () => {
        actAs(null);
        const res = await callRoute(setupAlias.GET, { path: "/api/setup" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ setupNeeded: false });
    });
});
