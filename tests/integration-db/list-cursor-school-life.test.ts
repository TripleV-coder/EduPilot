import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { GET as announcements } from "@/app/api/announcements/route";
import { GET as appointments } from "@/app/api/appointments/route";
import { GET as financePayments } from "@/app/api/finance/payments/route";
import { GET as courses } from "@/app/api/courses/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 3 — migration vers le curseur (format unique du projet) : annonces
 * (tri composé priorité puis publication → curseur positionnel), rendez-vous,
 * paiements de la comptabilité, cours.
 * Attendu : parcours complet sans doublon ni trou, dans l'ordre de la route,
 * total sur la première page seulement ; `?page=` renvoie encore l'ancien format.
 */
type Handler = Parameters<typeof callRoute>[0];
type CursorBody = {
  data: Array<{ id: string }>;
  pagination: { limit: number; nextCursor: string | null; hasNextPage: boolean; total?: number };
};

async function collect(handler: Handler, path: string) {
  const pages: CursorBody[] = [];
  let cursor: string | null = null;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const res = await callRoute(handler, { path: cursor ? `${path}${separator}cursor=${cursor}` : path });
    expect(res.status).toBe(200);
    pages.push(res.body as CursorBody);
    cursor = (res.body as CursorBody).pagination.nextCursor;
  } while (cursor && pages.length < 10);
  return pages;
}

const ids = (pages: CursorBody[]) => pages.flatMap((page) => page.data.map((row) => row.id));
const at = (iso: string) => new Date(`${iso}T08:00:00.000Z`);

let schoolId: string;
let adminId: string;
const announcementIds: Record<"urgent" | "recent" | "older", string> = { urgent: "", recent: "", older: "" };
const appointmentIds: string[] = [];
const paymentIds: string[] = [];
const courseIds: string[] = [];

beforeAll(async () => {
  schoolId = (await createSchool("IT-SCHOOL-LIFE")).id;
  const user = (first: string, role: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT") =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId } });
  adminId = (await user("admin", "SCHOOL_ADMIN")).id;
  const teacher = await prisma.teacherProfile.create({ data: { userId: (await user("prof", "TEACHER")).id, schoolId } });
  const parent = await prisma.parentProfile.create({ data: { userId: (await user("parent", "PARENT")).id } });
  const student = await prisma.studentProfile.create({ data: { userId: (await user("eleve", "STUDENT")).id, matricule: uniqueCode("MAT"), schoolId } });

  const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "6e A" } });
  const subject = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("M") } });
  const classSubject = await prisma.classSubject.create({ data: { classId: klass.id, subjectId: subject.id, teacherId: teacher.id } });

  // Annonces : l'urgente d'abord, puis les autres de la plus récente à la plus ancienne.
  announcementIds.urgent = (await prisma.announcement.create({
    data: { schoolId, title: "Fermeture exceptionnelle", content: "École fermée demain.", priority: "URGENT", isPublished: true, publishedAt: at("2026-03-01") },
  })).id;
  announcementIds.older = (await prisma.announcement.create({
    data: { schoolId, title: "Réunion des parents", content: "Réunion samedi matin.", priority: "NORMAL", isPublished: true, publishedAt: at("2026-03-03") },
  })).id;
  announcementIds.recent = (await prisma.announcement.create({
    data: { schoolId, title: "Sortie scolaire", content: "Sortie au musée jeudi.", priority: "NORMAL", isPublished: true, publishedAt: at("2026-03-05") },
  })).id;

  for (const scheduledAt of ["2026-05-03", "2026-05-01", "2026-05-02"]) {
    appointmentIds.push(
      (await prisma.appointment.create({ data: { teacherId: teacher.id, parentId: parent.id, studentId: student.id, scheduledAt: at(scheduledAt) } })).id,
    );
  }

  const fee = await prisma.fee.create({ data: { schoolId, name: "Scolarité", amount: 100000 } });
  for (const createdAt of ["2026-01-10", "2026-01-12", "2026-01-11"]) {
    paymentIds.push(
      (await prisma.payment.create({ data: { studentId: student.id, feeId: fee.id, amount: 10000, method: "CASH", status: "PENDING", createdAt: at(createdAt) } })).id,
    );
  }

  for (const [i, createdAt] of ["2026-02-01", "2026-02-03", "2026-02-02"].entries()) {
    courseIds.push((await prisma.course.create({ data: { classSubjectId: classSubject.id, title: `Cours ${i}`, createdAt: at(createdAt) } })).id);
  }
});

describe("Lot 3 — annonces : curseur positionnel (priorité puis date de publication)", () => {
  it("parcourt toutes les annonces dans l'ordre de la route, sans doublon", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(announcements, "/api/announcements?limit=2");

    expect(pages).toHaveLength(2);
    expect(pages[0].pagination.total).toBe(3);
    expect(pages[1].pagination.total).toBeUndefined();
    expect(ids(pages)).toEqual([announcementIds.urgent, announcementIds.recent, announcementIds.older]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(announcements, { path: "/api/announcements?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { announcements: unknown[] }).announcements).toHaveLength(2);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — rendez-vous : curseur sur la date du rendez-vous", () => {
  it("parcourt les rendez-vous de l'établissement dans l'ordre chronologique", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(appointments, "/api/appointments?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([appointmentIds[1], appointmentIds[2], appointmentIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(appointments, { path: "/api/appointments?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { appointments: unknown[] }).appointments).toHaveLength(2);
  });
});

describe("Lot 3 — paiements de la comptabilité : curseur sur la date de création", () => {
  it("parcourt les paiements de l'établissement, plus récents d'abord", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(financePayments, "/api/finance/payments?status=PENDING&limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([paymentIds[1], paymentIds[2], paymentIds[0]]);
  });

  it("tolère encore ?page=&pageSize= avec l'ancien format { data, meta }", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(financePayments, { path: "/api/finance/payments?page=1&pageSize=2" });

    expect(res.status).toBe(200);
    expect((res.body as { data: unknown[] }).data).toHaveLength(2);
    expect((res.body as { meta: Record<string, unknown> }).meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — cours : curseur sur la date de création", () => {
  it("parcourt les cours de l'établissement, plus récents d'abord", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(courses, "/api/courses?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([courseIds[1], courseIds[2], courseIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(courses, { path: "/api/courses?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});
