import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    performanceMetric: { create: vi.fn(), findMany: vi.fn() },
    telemetryEvent: { create: vi.fn() },
    transportLine: { findMany: vi.fn(), count: vi.fn() },
    bus: { count: vi.fn() },
    studentTransport: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST as POST_VITALS } from "@/app/api/analytics/web-vitals/route";
import { POST as POST_UX } from "@/app/api/ux/events/route";
import { GET as GET_TRANSPORT } from "@/app/api/transport/lines/route";
import { GET as GET_PERF } from "@/app/api/performance/dashboard/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/analytics/web-vitals", () => {
  it("persiste une métrique valide avec le pathname du referer (201)", async () => {
    vi.mocked(prisma.performanceMetric.create).mockResolvedValue({} as any);

    const response = await POST_VITALS(
      makeRequest("http://localhost:3000/api/analytics/web-vitals", {
        method: "POST",
        body: { name: "LCP", value: 2100.5, rating: "good", id: "v1-123" },
        headers: { referer: "http://localhost:3000/dashboard/grades?x=1" },
      })
    );

    expect(response.status).toBe(201);
    expect(vi.mocked(prisma.performanceMetric.create).mock.calls[0][0].data).toEqual({
      metric: "LCP",
      value: 2100.5,
      rating: "good",
      pathname: "/dashboard/grades",
    });
  });

  it("rejette une métrique inconnue ou une valeur invalide (400)", async () => {
    const bad = await POST_VITALS(
      makeRequest("http://localhost:3000/api/analytics/web-vitals", {
        method: "POST",
        body: { name: "HACK", value: 12 },
      })
    );
    expect(bad.status).toBe(400);

    const negative = await POST_VITALS(
      makeRequest("http://localhost:3000/api/analytics/web-vitals", {
        method: "POST",
        body: { name: "CLS", value: -1 },
      })
    );
    expect(negative.status).toBe(400);
    expect(prisma.performanceMetric.create).not.toHaveBeenCalled();
  });

  it("ne fait jamais échouer le client si la persistance échoue (202)", async () => {
    vi.mocked(prisma.performanceMetric.create).mockRejectedValue(new Error("db down"));

    const response = await POST_VITALS(
      makeRequest("http://localhost:3000/api/analytics/web-vitals", {
        method: "POST",
        body: { name: "INP", value: 180 },
      })
    );
    expect(response.status).toBe(202);
  });
});

describe("POST /api/ux/events", () => {
  it("persiste l'événement avec le userId de session", async () => {
    const session = makeSession("TEACHER");
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(prisma.telemetryEvent.create).mockResolvedValue({} as any);

    const response = await POST_UX(
      makeRequest("http://localhost:3000/api/ux/events", {
        method: "POST",
        body: {
          event: "report_export_clicked",
          pathname: "/dashboard/analytics",
          payload: { format: "pdf", rows: 12 },
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(vi.mocked(prisma.telemetryEvent.create).mock.calls[0][0].data).toMatchObject({
      event: "report_export_clicked",
      pathname: "/dashboard/analytics",
      userId: session.user!.id,
      payload: { format: "pdf", rows: 12 },
    });
  });

  it("accepte un événement anonyme (sendBeacon sans cookies)", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    vi.mocked(prisma.telemetryEvent.create).mockResolvedValue({} as any);

    const response = await POST_UX(
      makeRequest("http://localhost:3000/api/ux/events", {
        method: "POST",
        body: { event: "page_view" },
      })
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.telemetryEvent.create).mock.calls[0][0].data.userId).toBeNull();
  });

  it("rejette un payload invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await POST_UX(
      makeRequest("http://localhost:3000/api/ux/events", {
        method: "POST",
        body: { event: "", payload: { nested: { not: "allowed" } } },
      })
    );
    expect(response.status).toBe(400);
    expect(prisma.telemetryEvent.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/transport/lines", () => {
  function transportLine(overrides: Record<string, unknown> = {}) {
    return {
      id: cuid("ligne1"),
      number: "L1",
      label: "Ganhi → Campus",
      status: "ON_TIME",
      note: null,
      buses: [{ driverName: "Pierre Agossou" }],
      _count: { students: 28 },
      ...overrides,
    };
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const response = await GET_TRANSPORT(makeRequest("http://localhost:3000/api/transport/lines"));
    expect(response.status).toBe(401);
  });

  it("configured=false quand l'école n'a ni ligne ni bus", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    vi.mocked(prisma.transportLine.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.transportLine.count).mockResolvedValue(0);
    vi.mocked(prisma.bus.count).mockResolvedValue(0);
    vi.mocked(prisma.studentTransport.count).mockResolvedValue(0);

    const response = await GET_TRANSPORT(makeRequest("http://localhost:3000/api/transport/lines"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(body.metrics.totalBuses).toBeNull();
    expect(body.lines).toEqual([]);
  });

  it("mappe lignes, statuts FR, chauffeur, effectifs et notifications", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR") as any);
    vi.mocked(prisma.transportLine.findMany).mockResolvedValue([
      transportLine(),
      transportLine({
        id: cuid("ligne2"),
        number: "L2",
        status: "DELAYED",
        note: "Embouteillage pont de Calavi",
        _count: { students: 30 },
      }),
    ] as any);
    vi.mocked(prisma.bus.count).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    vi.mocked(prisma.studentTransport.count).mockResolvedValue(58);
    vi.mocked(prisma.transportLine.count).mockResolvedValue(0);

    const response = await GET_TRANSPORT(makeRequest("http://localhost:3000/api/transport/lines"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.metrics).toMatchObject({
      totalBuses: 3,
      activeBuses: 2,
      transportedStudents: 58,
      weekIncidents: 0,
    });
    expect(body.lines[0]).toMatchObject({
      number: "L1",
      status: "À l'heure",
      statusVariant: "success",
      driverName: "Pierre Agossou",
      studentCount: 28,
    });
    expect(body.lines[1].statusVariant).toBe("warning");
    expect(body.notifications).toEqual([
      { id: body.lines[1].id, message: "Ligne L2 — Embouteillage pont de Calavi" },
    ]);

    // Isolation tenant
    expect(vi.mocked(prisma.transportLine.findMany).mock.calls[0][0].where).toMatchObject({
      schoolId: FIXTURES.schoolA,
      isActive: true,
    });
  });

  it("bloque la consultation cross-tenant via ?schoolId (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);

    const response = await GET_TRANSPORT(
      makeRequest(`http://localhost:3000/api/transport/lines?schoolId=${FIXTURES.schoolB}`)
    );
    expect(response.status).toBe(403);
    expect(prisma.transportLine.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/performance/dashboard", () => {
  it("refuse les rôles non admin (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const response = await GET_PERF(makeRequest("http://localhost:3000/api/performance/dashboard"));
    expect(response.status).toBe(403);
  });

  it("agrège le p75 des web vitals réels avec les seuils officiels", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { schoolId: null }) as any);
    vi.mocked(prisma.performanceMetric.findMany).mockResolvedValue([
      // LCP : p75 = 3000 → needs-improvement
      ...[1000, 2000, 3000, 3500].map((value) => ({ metric: "LCP", value })),
      // CLS : p75 = 0.05 → good
      ...[0.01, 0.03, 0.05, 0.05].map((value) => ({ metric: "CLS", value })),
      // INP : p75 = 600 → poor
      ...[100, 300, 600, 700].map((value) => ({ metric: "INP", value })),
    ] as any);

    const response = await GET_PERF(makeRequest("http://localhost:3000/api/performance/dashboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.webVitals.lcp).toEqual({ value: 3000, rating: "needs-improvement" });
    expect(body.webVitals.cls).toEqual({ value: 0.05, rating: "good" });
    expect(body.webVitals.inp).toEqual({ value: 600, rating: "poor" });
    // Sans mesure : valeur 0, rating good (pas de fausse alerte)
    expect(body.webVitals.ttfb).toEqual({ value: 0, rating: "good" });
  });
});
