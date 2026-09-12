import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET as appointments } from "@/app/api/appointments/route";
import { GET as auditLogs } from "@/app/api/audit-logs/route";
import { GET as dataRequests } from "@/app/api/compliance/data-requests/route";
import { GET as events } from "@/app/api/events/route";
import { GET as homework } from "@/app/api/homework/route";
import { GET as incidents } from "@/app/api/incidents/route";
import { GET as financePayments } from "@/app/api/finance/payments/route";
import { GET as resources } from "@/app/api/resources/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N16 — pagination par offset lue sans plafond : `?limit=100000` faisait
 * construire toute la liste en mémoire (même famille que N1), et un `limit`
 * ou un `page` non numérique donnait `take: NaN` (erreur Prisma, 500).
 * Attendu : limite plafonnée (100, ou la taille demandée par l'écran consommateur
 * quand elle est supérieure — voir `maxSize`), valeurs par défaut si la saisie
 * est invalide.
 */
type Handler = Parameters<typeof callRoute>[0];

// metaKey : objet de pagination de la réponse (finance/payments renvoie `meta`).
// maxSize : plafond de la route quand un écran demande plus de 100 lignes
// (journal d'audit : 500, rendez-vous : 200, incidents : 200 — tableau des risques).
const ROUTES: Array<{ name: string; handler: Handler; path: string; sizeKey: "limit" | "pageSize"; defaultSize: number; maxSize?: number; metaKey?: "meta" }> = [
  { name: "appointments", handler: appointments, path: "/api/appointments", sizeKey: "limit", defaultSize: 20, maxSize: 200 },
  { name: "audit-logs", handler: auditLogs, path: "/api/audit-logs", sizeKey: "limit", defaultSize: 50, maxSize: 500 },
  { name: "compliance/data-requests", handler: dataRequests, path: "/api/compliance/data-requests", sizeKey: "limit", defaultSize: 20 },
  { name: "events", handler: events, path: "/api/events", sizeKey: "limit", defaultSize: 20 },
  { name: "homework", handler: homework, path: "/api/homework", sizeKey: "limit", defaultSize: 20 },
  { name: "incidents", handler: incidents, path: "/api/incidents", sizeKey: "limit", defaultSize: 20, maxSize: 200 },
  { name: "finance/payments", handler: financePayments, path: "/api/finance/payments", sizeKey: "pageSize", defaultSize: 20, metaKey: "meta" },
  { name: "resources (?page=)", handler: resources, path: "/api/resources", sizeKey: "limit", defaultSize: 20 },
];

let schoolId: string;
let adminId: string;

beforeAll(async () => {
  schoolId = (await createSchool("IT-LIMIT")).id;
  adminId = (
    await prisma.user.create({
      data: { email: `${uniqueCode("admin")}@integration.test`, password: "x", firstName: "Admin", lastName: "Test", role: "SCHOOL_ADMIN", schoolId },
    })
  ).id;
});

describe("N16 — limite de page plafonnée et saisie invalide tolérée", () => {
  for (const route of ROUTES) {
    it(`${route.name} : ?${route.sizeKey}=100000 est plafonné à ${route.maxSize ?? 100}`, async () => {
      actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
      const res = await callRoute(route.handler, { path: `${route.path}?page=1&${route.sizeKey}=100000` });

      expect(res.status).toBe(200);
      expect((res.body as Record<string, Record<string, number>>)[route.metaKey ?? "pagination"][route.sizeKey]).toBe(route.maxSize ?? 100);
    });

    if (route.maxSize) {
      it(`${route.name} : l'écran qui demande ${route.maxSize} lignes les obtient (pas de troncature à 100)`, async () => {
        actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
        const res = await callRoute(route.handler, { path: `${route.path}?${route.sizeKey}=${route.maxSize}` });

        expect(res.status).toBe(200);
        expect((res.body as Record<string, Record<string, number>>)[route.metaKey ?? "pagination"][route.sizeKey]).toBe(route.maxSize);
      });
    }

    it(`${route.name} : page et taille non numériques → valeurs par défaut`, async () => {
      actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
      const res = await callRoute(route.handler, { path: `${route.path}?page=abc&${route.sizeKey}=abc` });

      expect(res.status).toBe(200);
      expect((res.body as Record<string, Record<string, number>>)[route.metaKey ?? "pagination"]).toMatchObject({ page: 1, [route.sizeKey]: route.defaultSize });
    });
  }
});
