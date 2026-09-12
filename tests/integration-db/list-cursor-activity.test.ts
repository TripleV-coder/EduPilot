import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET as messages } from "@/app/api/messages/route";
import { GET as homework } from "@/app/api/homework/route";
import { GET as incidents } from "@/app/api/incidents/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 3 — migration vers le curseur (format unique du projet) des listes
 * d'activité : messagerie (avec compteur de non-lus), devoirs, incidents.
 * Attendu : parcours complet sans doublon ni trou, dans l'ordre de la route,
 * total sur la première page seulement ; `?page=` renvoie encore l'ancien format.
 */
type Handler = Parameters<typeof callRoute>[0];
type CursorBody = {
  data: Array<{ id: string }>;
  pagination: { limit: number; nextCursor: string | null; hasNextPage: boolean; total?: number };
  unreadCount?: number;
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
const messageIds: string[] = [];
const homeworkIds: string[] = [];
const incidentIds: string[] = [];

beforeAll(async () => {
  schoolId = (await createSchool("IT-ACTIVITY")).id;
  const user = (first: string, role: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT") =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId } });
  adminId = (await user("admin", "SCHOOL_ADMIN")).id;
  const teacherUser = await user("prof", "TEACHER");
  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });
  const studentUser = await user("eleve", "STUDENT");
  const student = await prisma.studentProfile.create({ data: { userId: studentUser.id, matricule: uniqueCode("MAT"), schoolId } });

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "6e A" } });
  await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, academicYearId: year.id } });
  const subject = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("M") } });
  const classSubject = await prisma.classSubject.create({ data: { classId: klass.id, subjectId: subject.id, teacherId: teacher.id } });

  // Messagerie : 3 messages reçus par l'administrateur, dont 1 lu.
  for (const [i, createdAt] of ["2026-03-01", "2026-03-03", "2026-03-02"].entries()) {
    messageIds.push(
      (await prisma.message.create({
        data: { senderId: teacherUser.id, recipientId: adminId, subject: `Objet ${i}`, content: "Bonjour", isRead: i === 0, createdAt: at(createdAt) },
      })).id,
    );
  }
  // Devoirs : 3 publiés, 1 brouillon (exclu).
  for (const [i, dueDate] of ["2026-04-03", "2026-04-01", "2026-04-02", "2026-04-04"].entries()) {
    const created = await prisma.homework.create({
      data: { classSubjectId: classSubject.id, title: `Devoir ${i}`, description: "Exercices 1 à 5", dueDate: at(dueDate), isPublished: i < 3 },
    });
    if (i < 3) homeworkIds.push(created.id);
  }
  // Incidents : 3 pour un élève inscrit dans l'établissement.
  for (const [i, date] of ["2026-02-01", "2026-02-03", "2026-02-02"].entries()) {
    incidentIds.push(
      (await prisma.behaviorIncident.create({
        data: { studentId: student.id, reportedById: teacherUser.id, incidentType: "LATE", date: at(date), description: `Retard ${i}` },
      })).id,
    );
  }
});

describe("Lot 3 — messagerie : curseur sur la date", () => {
  it("parcourt la boîte de réception, plus récents d'abord, compteur de non-lus sur chaque page", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(messages, "/api/messages?type=inbox&limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(pages[1].pagination.total).toBeUndefined();
    expect(ids(pages)).toEqual([messageIds[1], messageIds[2], messageIds[0]]);
    expect(pages.map((page) => page.unreadCount)).toEqual([2, 2]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(messages, { path: "/api/messages?type=inbox&page=1&limit=2" });
    const body = res.body as { messages: unknown[]; unreadCount: number; pagination: Record<string, unknown> };

    expect(res.status).toBe(200);
    expect(body.messages).toHaveLength(2);
    expect(body.unreadCount).toBe(2);
    expect(body.pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — devoirs : curseur sur l'échéance", () => {
  it("parcourt les devoirs publiés de l'établissement par échéance", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(homework, "/api/homework?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([homeworkIds[1], homeworkIds[2], homeworkIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(homework, { path: "/api/homework?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { homeworks: unknown[] }).homeworks).toHaveLength(2);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});

describe("Lot 3 — incidents : curseur sur la date", () => {
  it("parcourt les incidents de l'établissement, plus récents d'abord", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const pages = await collect(incidents, "/api/incidents?limit=2");

    expect(pages[0].pagination.total).toBe(3);
    expect(ids(pages)).toEqual([incidentIds[1], incidentIds[2], incidentIds[0]]);
  });

  it("tolère encore ?page= avec l'ancien format", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(incidents, { path: "/api/incidents?page=1&limit=2" });

    expect(res.status).toBe(200);
    expect((res.body as { incidents: unknown[] }).incidents).toHaveLength(2);
    expect((res.body as { pagination: Record<string, unknown> }).pagination).toMatchObject({ page: 1, total: 3, totalPages: 2 });
  });
});
