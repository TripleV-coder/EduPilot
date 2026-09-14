import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Plusieurs centaines d'appels depuis une même adresse : on mesure l'isolation, pas le rate-limit.
vi.hoisted(() => {
  process.env.RATE_LIMIT_RELAXED = "true";
});

import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";

/**
 * Lot 4 — balayage d'isolation des routes `[id]` (audit §7 P1, 70 routes).
 *
 * Chaque route et chaque méthode exportée est appelée par l'administrateur
 * d'une AUTRE école sur une ressource de l'école A : seules 403 et 404 sont
 * acceptées, et la ressource visée par une écriture doit rester intacte.
 *
 * Contrôle positif : l'administrateur de l'école A lit ses propres ressources
 * (GET) ; un 404 de l'étranger n'a de valeur que si le propriétaire, lui,
 * atteint la ressource avec le même identifiant.
 *
 * Hors balayage (motif dans docs/REMEDIATION_PROGRESS.md) :
 * - auth/[...nextauth] (pas une ressource) ;
 * - public/schools/[code] (vitrine publique, par conception) ;
 * - uploads/[type]/[filename] (fichiers, contrôle par manifeste : testé à part).
 */
type Ids = TenantGraph["ids"];
type Handler = Parameters<typeof callRoute>[0];
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler>>;

interface SweptRoute {
  route: string;
  load: () => Promise<unknown>;
  params: (ids: Ids) => Record<string, string>;
  /** Ligne dont l'état doit rester identique après une écriture refusée. */
  target?: { model: string; id: (ids: Ids) => string };
  body?: (ids: Ids) => unknown;
  query?: (ids: Ids) => string;
}

const id = (key: keyof Ids) => (ids: Ids) => ({ id: ids[key] });
const t = (model: string, key: keyof Ids) => ({ model, id: (ids: Ids) => ids[key] });

const ROUTES: SweptRoute[] = [
  { route: "admin/subjects/[id]", load: () => import("@/app/api/admin/subjects/[id]/route"), params: id("subject"), target: t("subject", "subject") },
  { route: "alumni/[id]", load: () => import("@/app/api/alumni/[id]/route"), params: id("alumni"), target: t("alumni", "alumni") },
  { route: "analytics/class/[classId]", load: () => import("@/app/api/analytics/class/[classId]/route"), params: (i) => ({ classId: i.class }) },
  { route: "analytics/class/[classId]/subject/[subjectId]", load: () => import("@/app/api/analytics/class/[classId]/subject/[subjectId]/route"), params: (i) => ({ classId: i.class, subjectId: i.subject }) },
  { route: "announcements/[id]", load: () => import("@/app/api/announcements/[id]/route"), params: id("announcement"), target: t("announcement", "announcement") },
  { route: "appointments/[id]", load: () => import("@/app/api/appointments/[id]/route"), params: id("appointment"), target: t("appointment", "appointment") },
  { route: "cagnottes/[cagnotteId]/contributions", load: () => import("@/app/api/cagnottes/[cagnotteId]/contributions/route"), params: (i) => ({ cagnotteId: i.cagnotte }), target: t("cagnotte", "cagnotte"), body: () => ({ amountFcfa: 1000 }) },
  { route: "cagnottes/[cagnotteId]", load: () => import("@/app/api/cagnottes/[cagnotteId]/route"), params: (i) => ({ cagnotteId: i.cagnotte }) },
  { route: "calendar/holidays/[id]", load: () => import("@/app/api/calendar/holidays/[id]/route"), params: id("holiday"), target: t("schoolHoliday", "holiday") },
  { route: "certificates/[id]", load: () => import("@/app/api/certificates/[id]/route"), params: id("certificate"), target: t("certificate", "certificate") },
  { route: "classes/[id]/cards", load: () => import("@/app/api/classes/[id]/cards/route"), params: id("class") },
  { route: "classes/[id]/promote", load: () => import("@/app/api/classes/[id]/promote/route"), params: id("class"), target: t("class", "class"), body: (i) => ({ targetAcademicYearId: i.class, decisions: [{ studentId: i.student, decision: "PROMOTE" }] }) },
  { route: "classes/[id]", load: () => import("@/app/api/classes/[id]/route"), params: id("class") },
  { route: "communication/templates/[id]", load: () => import("@/app/api/communication/templates/[id]/route"), params: id("communicationTemplate"), target: t("communicationTemplate", "communicationTemplate"), body: () => ({ name: "Piraté" }) },
  { route: "compliance/data-requests/[id]/fulfill", load: () => import("@/app/api/compliance/data-requests/[id]/fulfill/route"), params: id("dataRequest"), target: t("dataAccessRequest", "dataRequest") },
  { route: "compliance/data-requests/[id]", load: () => import("@/app/api/compliance/data-requests/[id]/route"), params: id("dataRequest"), target: t("dataAccessRequest", "dataRequest"), body: () => ({ status: "REJECTED" }) },
  { route: "config-options/[id]", load: () => import("@/app/api/config-options/[id]/route"), params: id("configOption"), target: t("configOption", "configOption"), body: () => ({ label: "Piraté" }) },
  { route: "courses/[id]/enroll", load: () => import("@/app/api/courses/[id]/enroll/route"), params: id("course"), target: t("course", "course") },
  { route: "courses/[id]", load: () => import("@/app/api/courses/[id]/route"), params: id("course"), target: t("course", "course"), body: () => ({ title: "Piraté" }) },
  { route: "evaluation-types/[id]", load: () => import("@/app/api/evaluation-types/[id]/route"), params: id("evaluationType"), target: t("evaluationType", "evaluationType"), body: () => ({ name: "Piraté" }) },
  { route: "events/[id]/participate", load: () => import("@/app/api/events/[id]/participate/route"), params: id("event"), target: t("schoolEvent", "event"), body: (i) => ({ studentId: i.student }) },
  { route: "events/[id]", load: () => import("@/app/api/events/[id]/route"), params: id("event"), target: t("schoolEvent", "event"), body: () => ({ title: "Piraté" }) },
  { route: "exams/[id]", load: () => import("@/app/api/exams/[id]/route"), params: id("examTemplate"), target: t("examTemplate", "examTemplate") },
  { route: "exams/[id]/start", load: () => import("@/app/api/exams/[id]/start/route"), params: id("examTemplate"), target: t("examTemplate", "examTemplate") },
  { route: "exams/[id]/submit", load: () => import("@/app/api/exams/[id]/submit/route"), params: id("examTemplate"), target: t("examTemplate", "examTemplate"), body: () => ({ answers: [] }) },
  { route: "exams/sessions/[id]/submit", load: () => import("@/app/api/exams/sessions/[id]/submit/route"), params: id("examSession"), target: t("examSession", "examSession"), body: () => ({ answers: [] }) },
  { route: "finance/payments/[id]", load: () => import("@/app/api/finance/payments/[id]/route"), params: id("payment"), target: t("payment", "payment"), body: () => ({ status: "CANCELLED" }) },
  { route: "grades/[id]", load: () => import("@/app/api/grades/[id]/route"), params: id("grade"), target: t("grade", "grade"), body: () => ({ value: 20 }) },
  { route: "homework/[id]", load: () => import("@/app/api/homework/[id]/route"), params: id("homework"), target: t("homework", "homework"), body: () => ({ title: "Piraté" }) },
  { route: "homework/submissions/[id]/grade", load: () => import("@/app/api/homework/submissions/[id]/grade/route"), params: id("submission"), target: t("homeworkSubmission", "submission"), body: () => ({ grade: 20 }) },
  { route: "import/templates/[id]", load: () => import("@/app/api/import/templates/[id]/route"), params: id("importTemplate"), target: t("importTemplate", "importTemplate"), body: () => ({ name: "Piraté" }) },
  { route: "incidents/[id]", load: () => import("@/app/api/incidents/[id]/route"), params: id("incident"), target: t("behaviorIncident", "incident"), body: () => ({ description: "Piraté" }) },
  { route: "incidents/[id]/sanctions", load: () => import("@/app/api/incidents/[id]/sanctions/route"), params: id("incident"), target: t("behaviorIncident", "incident"), body: () => ({ type: "WARNING", description: "x" }) },
  { route: "lessons/[id]/complete", load: () => import("@/app/api/lessons/[id]/complete/route"), params: id("lesson"), target: t("lesson", "lesson"), query: (i) => `studentId=${i.student}` },
  { route: "lessons/[id]", load: () => import("@/app/api/lessons/[id]/route"), params: id("lesson") },
  { route: "medical-records/[id]/allergies", load: () => import("@/app/api/medical-records/[id]/allergies/route"), params: id("medicalRecord"), target: t("allergy", "allergy"), body: () => ({ allergen: "Piraté", severity: "LOW" }), query: (i) => `allergyId=${i.allergy}` },
  { route: "medical-records/[id]/emergency-contacts", load: () => import("@/app/api/medical-records/[id]/emergency-contacts/route"), params: id("medicalRecord"), target: t("emergencyContact", "emergencyContact"), body: (i) => ({ id: i.emergencyContact, name: "Piraté", relationship: "x", phone: "+22997000001" }), query: (i) => `contactId=${i.emergencyContact}` },
  { route: "medical-records/[id]/vaccinations", load: () => import("@/app/api/medical-records/[id]/vaccinations/route"), params: id("medicalRecord"), target: t("vaccination", "vaccination"), body: () => ({ vaccineName: "Piraté", dateGiven: "2020-01-01" }), query: (i) => `vaccinationId=${i.vaccination}` },
  { route: "messages/[id]", load: () => import("@/app/api/messages/[id]/route"), params: id("message"), target: t("message", "message"), body: () => ({ isRead: true }) },
  { route: "modules/[id]/lessons", load: () => import("@/app/api/modules/[id]/lessons/route"), params: id("courseModule"), target: t("courseModule", "courseModule"), body: () => ({ title: "Piraté", content: "x" }) },
  { route: "modules/[id]", load: () => import("@/app/api/modules/[id]/route"), params: id("courseModule"), target: t("courseModule", "courseModule"), body: () => ({ title: "Piraté" }) },
  { route: "notifications/[id]", load: () => import("@/app/api/notifications/[id]/route"), params: id("notification"), target: t("notification", "notification"), body: () => ({ isRead: true }) },
  { route: "orientation/[id]/recommendations", load: () => import("@/app/api/orientation/[id]/recommendations/route"), params: id("orientation"), target: t("studentOrientation", "orientation"), body: () => ({ recommendedSeries: "SERIE_A1", score: 12, justification: "Piraté" }) },
  { route: "orientation/[id]/validate", load: () => import("@/app/api/orientation/[id]/validate/route"), params: id("orientation"), target: t("studentOrientation", "orientation"), body: (i) => ({ recommendationId: i.recommendation, isValidated: true }) },
  { route: "payment-plans/[id]/installments/[installmentId]/pay", load: () => import("@/app/api/payment-plans/[id]/installments/[installmentId]/pay/route"), params: (i) => ({ id: i.paymentPlan, installmentId: i.installment }), target: t("installmentPayment", "installment"), body: () => ({ amount: 25000, method: "CASH" }) },
  { route: "payment-plans/[id]", load: () => import("@/app/api/payment-plans/[id]/route"), params: id("paymentPlan"), target: t("paymentPlan", "paymentPlan") },
  { route: "payments/[id]/invoice", load: () => import("@/app/api/payments/[id]/invoice/route"), params: id("payment") },
  { route: "payments/[id]", load: () => import("@/app/api/payments/[id]/route"), params: id("payment"), target: t("payment", "payment"), body: () => ({ status: "VERIFIED" }) },
  { route: "periods/[id]", load: () => import("@/app/api/periods/[id]/route"), params: id("period"), target: t("period", "period"), body: () => ({ name: "Piraté" }) },
  { route: "resources/[id]/download", load: () => import("@/app/api/resources/[id]/download/route"), params: id("resource"), target: t("resource", "resource") },
  { route: "resources/[id]", load: () => import("@/app/api/resources/[id]/route"), params: id("resource"), target: t("resource", "resource"), body: () => ({ title: "Piraté" }) },
  { route: "scholarships/[id]", load: () => import("@/app/api/scholarships/[id]/route"), params: id("scholarship"), target: t("scholarship", "scholarship"), body: () => ({ name: "Piraté" }) },
  { route: "schools/[id]/levels", load: () => import("@/app/api/schools/[id]/levels/route"), params: id("school"), target: t("school", "school"), body: () => ({ offeredLevels: ["PRIMARY"] }) },
  { route: "schools/[id]", load: () => import("@/app/api/schools/[id]/route"), params: id("school"), target: t("school", "school"), body: () => ({ name: "Piraté" }) },
  { route: "signatures/[id]/verify", load: () => import("@/app/api/signatures/[id]/verify/route"), params: id("signature"), body: () => ({ payload: {} }) },
  { route: "staff/leaves/[id]", load: () => import("@/app/api/staff/leaves/[id]/route"), params: id("leave"), target: t("leaveRequest", "leave"), body: () => ({ action: "approve" }) },
  { route: "staff/payroll/[id]", load: () => import("@/app/api/staff/payroll/[id]/route"), params: id("payroll"), target: t("payrollEntry", "payroll"), body: () => ({ action: "validate" }) },
  { route: "students/[id]/card", load: () => import("@/app/api/students/[id]/card/route"), params: id("student") },
  { route: "students/[id]/link-code", load: () => import("@/app/api/students/[id]/link-code/route"), params: id("student"), target: t("studentProfile", "student") },
  { route: "students/[id]/profile-360", load: () => import("@/app/api/students/[id]/profile-360/route"), params: id("student") },
  { route: "students/[id]", load: () => import("@/app/api/students/[id]/route"), params: id("student"), target: t("studentProfile", "student"), body: () => ({ address: "Piraté" }) },
  { route: "subject-categories/[id]", load: () => import("@/app/api/subject-categories/[id]/route"), params: id("subjectCategory"), target: t("subjectCategory", "subjectCategory"), body: () => ({ name: "Piraté" }) },
  { route: "subjects/categories/[id]", load: () => import("@/app/api/subjects/categories/[id]/route"), params: id("subjectCategory"), target: t("subjectCategory", "subjectCategory"), body: () => ({ name: "Piraté" }) },
  { route: "teachers/[id]/availability", load: () => import("@/app/api/teachers/[id]/availability/route"), params: id("teacher"), target: t("teacherAvailability", "availability"), body: () => ({ dayOfWeek: 2, startTime: "08:00", endTime: "09:00" }), query: (i) => `availabilityId=${i.availability}` },
  { route: "teachers/[id]", load: () => import("@/app/api/teachers/[id]/route"), params: id("teacher"), target: t("teacherProfile", "teacher"), body: () => ({ specialization: "Piraté" }) },
  { route: "users/[id]/delete", load: () => import("@/app/api/users/[id]/delete/route"), params: id("teacherUser"), target: t("user", "teacherUser"), body: () => ({ confirmEmail: schoolA.teacherEmail, deleteType: "SOFT" }) },
  { route: "wellbeing/reports/[id]", load: () => import("@/app/api/wellbeing/reports/[id]/route"), params: id("wellbeingReport"), target: t("wellbeingReport", "wellbeingReport"), body: () => ({ status: "RESOLVED" }) },
];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let schoolA: TenantGraph;
let foreignSession: ReturnType<typeof sessionFor>;
let ownerSession: ReturnType<typeof sessionFor>;
const report: Array<{ route: string; method: string; étranger: number | string; propriétaire?: number }> = [];

const pathOf = (route: string, params: Record<string, string>) =>
  "/api/" + route.replace(/\[([^\]]+)\]/g, (_, name: string) => params[name]);

const toJson = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

async function snapshot(target: SweptRoute["target"]) {
  if (!target) return null;
  const delegate = (prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[target.model];
  return toJson(await delegate.findUnique({ where: { id: target.id(schoolA.ids) } }));
}

beforeAll(async () => {
  schoolA = await seedTenantGraph("ISO-A");
  const schoolB = await createSchool("ISO-B");
  const adminB = await prisma.user.create({
    data: { email: `${uniqueCode("iso-b")}@integration.test`, password: "x", firstName: "Admin", lastName: "B", role: "SCHOOL_ADMIN", schoolId: schoolB.id },
  });
  foreignSession = sessionFor("SCHOOL_ADMIN", schoolB.id, adminB.id);
  ownerSession = sessionFor("SCHOOL_ADMIN", schoolA.schoolId, schoolA.adminId);
}, 180_000);

afterAll(() => {
  console.table(report);
});

describe("Lot 4 — isolation des routes [id] : admin d'une autre école", () => {
  it.each(ROUTES.map((r) => [r.route, r] as const))("%s", async (_name, entry) => {
    const mod = (await entry.load()) as RouteModule;
    const params = entry.params(schoolA.ids);
    const base = pathOf(entry.route, params);
    const path = entry.query ? `${base}?${entry.query(schoolA.ids)}` : base;
    const failures: string[] = [];

    for (const method of METHODS) {
      const handler = mod[method];
      if (!handler) continue;

      const before = WRITE.has(method) ? await snapshot(entry.target) : null;
      actAs(foreignSession);
      const res = await callRoute(handler, {
        method,
        path,
        params,
        body: WRITE.has(method) && method !== "DELETE" ? (entry.body?.(schoolA.ids) ?? {}) : undefined,
      });
      const line: (typeof report)[number] = { route: entry.route, method, étranger: res.status };

      if (![403, 404].includes(res.status)) {
        failures.push(`${method} → ${res.status} ${toJson(res.body).slice(0, 160)}`);
      }
      if (WRITE.has(method) && entry.target && (await snapshot(entry.target)) !== before) {
        failures.push(`${method} → ressource de l'école A MODIFIÉE`);
      }

      if (method === "GET") {
        actAs(ownerSession);
        line.propriétaire = (await callRoute(handler, { method, path, params })).status;
      }
      report.push(line);
    }

    expect(failures, `${entry.route} :\n${failures.join("\n")}`).toEqual([]);
  });
});
