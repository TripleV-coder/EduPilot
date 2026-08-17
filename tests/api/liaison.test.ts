import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/liaison/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    parentStudent: { findUnique: vi.fn() },
    behaviorIncident: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    announcement: { findMany: vi.fn() },
    appointment: { findMany: vi.fn() },
    classSubject: { findMany: vi.fn() },
  },
}));

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function makeStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.studentA,
    schoolId: FIXTURES.schoolA,
    userId: cuid("userstudent"),
    user: { firstName: "Awa", lastName: "Diallo" },
    enrollments: [
      { id: "enr1", classId: "cl1", class: { id: "cl1", name: "CM2" } },
    ],
    ...overrides,
  } as never;
}

function makeIncident(overrides: Record<string, unknown> = {}) {
  return {
    id: "inc1",
    studentId: FIXTURES.studentA,
    severity: "HIGH",
    incidentType: "VIOLENCE",
    description: "Incident grave",
    isResolved: false,
    date: daysAgo(1),
    reportedBy: { firstName: "Paul", lastName: "Biya", role: "DIRECTOR" },
    ...overrides,
  };
}

function makeAbsence(overrides: Record<string, unknown> = {}) {
  return {
    id: "abs1",
    studentId: FIXTURES.studentA,
    date: daysAgo(2),
    recordedBy: { firstName: "Paul", lastName: "Biya", role: "TEACHER" },
    ...overrides,
  };
}

function makeAnnouncement(overrides: Record<string, unknown> = {}) {
  return {
    id: "ann1",
    schoolId: FIXTURES.schoolA,
    title: "Sortie pédagogique",
    content: "x".repeat(300),
    createdAt: daysAgo(3),
    author: { firstName: "Paul", lastName: "Biya", role: "DIRECTOR" },
    ...overrides,
  };
}

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "apt1",
    studentId: FIXTURES.studentA,
    type: "PHONE_CALL",
    location: null,
    notes: "Faire le point",
    status: "PENDING",
    scheduledAt: daysAgo(4),
    teacher: { user: { firstName: "Paul", lastName: "Biya" } },
    ...overrides,
  };
}

describe("GET /api/liaison", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/liaison"), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when no student is selected", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await GET(makeRequest("http://localhost/api/liaison"), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Aucun élève sélectionné");
  });

  it("should return 404 when student not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Élève introuvable");
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ schoolId: FIXTURES.schoolB }));
    const res = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(403);
  });

  it("should forbid PARENT when profile or link is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);

    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({ id: "pp1" } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValue(null);
    const res2 = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("PARENT") });
    expect(res2.status).toBe(403);
  });

  it("should forbid STUDENT from viewing another student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ userId: "someone-else" }));
    const res = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("STUDENT") });
    expect(res.status).toBe(403);
  });

  it("should resolve the student automatically for a STUDENT session", async () => {
    const student = makeSession("STUDENT");
    vi.mocked(auth).mockResolvedValue(student);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({ id: FIXTURES.studentA } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent({ userId: student.user.id }));
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([]);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
    vi.mocked(prisma.announcement.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([]);
    const res = await GET(makeRequest("http://localhost/api/liaison"), { session: student });
    expect(res.status).toBe(200);
    expect(prisma.studentProfile.findFirst).toHaveBeenCalledWith({ where: { userId: student.user.id } });
    const body = await res.json();
    expect(body.student.id).toBe(FIXTURES.studentA);
  });

  it("should build the liaison entries, recap and recipients", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(makeStudent());
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([
      makeIncident({ id: "inc1", severity: "HIGH", incidentType: "VIOLENCE", date: daysAgo(1) }),
      makeIncident({ id: "inc2", severity: "LOW", incidentType: "DILIGENCE", description: "Bon comportement", date: daysAgo(5) }),
    ]);
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([makeAbsence()]);
    vi.mocked(prisma.announcement.findMany).mockResolvedValue([makeAnnouncement()]);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      makeAppointment({ id: "apt1", status: "PENDING", type: "PHONE_CALL", date: undefined, scheduledAt: daysAgo(4) }),
      makeAppointment({ id: "apt2", status: "CONFIRMED", type: "VIDEO_CALL", location: "Salle 2", scheduledAt: daysAgo(6) }),
    ]);
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([
      { id: "cs1", teacher: { id: "t1", user: { firstName: "Paul", lastName: "Biya" } }, subject: { name: "Maths" } },
      { id: "cs2", teacher: { id: "t1", user: { firstName: "Paul", lastName: "Biya" } }, subject: { name: "Français" } },
      { id: "cs3", teacher: null, subject: { name: "EPS" } },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.student).toEqual({ id: FIXTURES.studentA, firstName: "Awa", lastName: "Diallo" });
    expect(body.class).toEqual({ id: "cl1", name: "CM2" });
    expect(body.signatureWindowDays).toBe(14);

    const entries = body.entries;
    expect(entries).toHaveLength(6);
    const sorted = entries.every((e: { date: string }, i: number, arr: { date: string }[]) => i === 0 || arr[i - 1].date >= e.date);
    expect(sorted).toBe(true);

    const incident = entries.find((e: { id: string }) => e.id === "inc-inc1");
    expect(incident.source).toBe("incident");
    expect(incident.title).toBe("Sanction : violence");
    expect(incident.tagLabel).toBe("Sanction");
    expect(incident.tagVariant).toBe("danger");
    expect(incident.signed).toBe(false);
    expect(incident.requiresSignature).toBe(true);
    expect(incident.actionLabel).toBe("Accuser réception");

    const felicitation = entries.find((e: { id: string }) => e.id === "inc-inc2");
    expect(felicitation.title).toBe("Note · diligence");
    expect(felicitation.tagLabel).toBe("Félicitations");
    expect(felicitation.tagVariant).toBe("success");
    expect(felicitation.requiresSignature).toBe(false);

    const absence = entries.find((e: { id: string }) => e.id === "abs-abs1");
    expect(absence.tagLabel).toBe("À signer");
    expect(absence.tagVariant).toBe("warning");
    expect(absence.requiresSignature).toBe(true);
    expect(absence.actionLabel).toBe("Justifier");

    const announcement = entries.find((e: { id: string }) => e.id === "ann-ann1");
    expect(announcement.tagLabel).toBe("Information");
    expect(announcement.body.length).toBe(281);

    const pending = entries.find((e: { id: string }) => e.id === "apt-apt1");
    expect(pending.title).toBe("RDV téléphone");
    expect(pending.tagLabel).toBe("À confirmer");
    expect(pending.requiresSignature).toBe(true);
    expect(pending.actionLabel).toBe("Confirmer");

    const confirmed = entries.find((e: { id: string }) => e.id === "apt-apt2");
    expect(confirmed.title).toBe("RDV visio · Salle 2");
    expect(confirmed.tagLabel).toBe("Confirmé");
    expect(confirmed.tagVariant).toBe("success");
    expect(confirmed.signed).toBe(true);

    expect(body.toSignCount).toBe(3);
    expect(body.recap).toEqual({ felicitations: 2, vigilances: 2, documents: 1, sanctions: 1 });
    expect(body.recipients).toEqual([
      { id: "t1", label: "M./Mme Paul Biya (Français)" },
    ]);
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentProfile.findUnique).mockRejectedValue(new Error("db down"));
    const res = await GET(makeRequest("http://localhost/api/liaison?studentId=" + FIXTURES.studentA), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors du chargement du cahier de liaison");
  });
});