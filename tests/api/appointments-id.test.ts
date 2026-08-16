import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/appointments/[id]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({
  assertModelAccess: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    appointment: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "ap1",
    scheduledAt: new Date("2026-10-05T10:00:00Z"),
    teacher: { userId: "u5", user: { id: "u5", firstName: "T", lastName: "E" } },
    parent: { userId: "u1", user: { id: "u1", firstName: "P", lastName: "A" } },
    student: { userId: "u9", user: { id: "u9", firstName: "S", lastName: "T" } },
    ...overrides,
  } as never;
}

describe("GET /api/appointments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when appointment not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/appointments/ap1"), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid access to an unrelated teacher", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u99" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    const res = await GET(makeRequest("http://localhost/api/appointments/ap1"), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(403);
  });

  it("should allow the linked parent", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u1" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    const res = await GET(makeRequest("http://localhost/api/appointments/ap1"), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
  });

  it("should allow admins", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    const res = await GET(makeRequest("http://localhost/api/appointments/ap1"), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/appointments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid an unrelated user", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u99" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    const res = await PATCH(makeRequest("http://localhost/api/appointments/ap1", { method: "PATCH", body: { status: "CONFIRMED" } }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(403);
  });

  it("should confirm the appointment and notify both parties", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u5" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    vi.mocked(prisma.appointment.update).mockResolvedValue(makeAppointment());

    const res = await PATCH(makeRequest("http://localhost/api/appointments/ap1", { method: "PATCH", body: { status: "CONFIRMED" } }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
    const updateCall = vi.mocked(prisma.appointment.update).mock.calls[0][0] as { data: { status: string; confirmedAt?: Date } };
    expect(updateCall.data.status).toBe("CONFIRMED");
    expect(updateCall.data.confirmedAt).toBeInstanceOf(Date);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it("should cancel with a reason", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: "u1" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    vi.mocked(prisma.appointment.update).mockResolvedValue(makeAppointment());

    const res = await PATCH(makeRequest("http://localhost/api/appointments/ap1", { method: "PATCH", body: { status: "CANCELED", cancelReason: "Imprévu familial" } }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
    const updateCall = vi.mocked(prisma.appointment.update).mock.calls[0][0] as { data: { status: string; canceledAt?: Date; cancelReason?: string } };
    expect(updateCall.data.canceledAt).toBeInstanceOf(Date);
    expect(updateCall.data.cancelReason).toBe("Imprévu familial");
  });

  it("should complete the appointment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u5" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    vi.mocked(prisma.appointment.update).mockResolvedValue(makeAppointment());

    const res = await PATCH(makeRequest("http://localhost/api/appointments/ap1", { method: "PATCH", body: { status: "COMPLETED" } }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it("should update notes without notifications", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u5" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    vi.mocked(prisma.appointment.update).mockResolvedValue(makeAppointment());

    const res = await PATCH(makeRequest("http://localhost/api/appointments/ap1", { method: "PATCH", body: { notes: "Merci de confirmer" } }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u5" }));
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(makeAppointment());
    const res = await PATCH(makeRequest("http://localhost/api/appointments/ap1", { method: "PATCH", body: { status: "INVALID" } }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/appointments/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: "u5" }));
    const res = await DELETE(makeRequest("http://localhost/api/appointments/ap1", { method: "DELETE" }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(403);
  });

  it("should delete the appointment", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.appointment.delete).mockResolvedValue({ id: "ap1" } as never);

    const res = await DELETE(makeRequest("http://localhost/api/appointments/ap1", { method: "DELETE" }), { params: Promise.resolve({ id: "ap1" }) });
    expect(res.status).toBe(200);
    expect(prisma.appointment.delete).toHaveBeenCalledWith({ where: { id: "ap1" } });
  });
});