import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/utils/error-message";
import { trackUxEvent } from "@/lib/ux/telemetry";
import {
  buildClimateReportSections,
  type ClimateReportInput,
} from "@/lib/wellbeing/climate-report";

describe("getErrorMessage", () => {
  it("returns the message of an Error instance", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns a string as-is", () => {
    expect(getErrorMessage("plain")).toBe("plain");
  });

  it("returns the fallback for an empty string", () => {
    expect(getErrorMessage("", "fb")).toBe("fb");
  });

  it("reads message from plain objects", () => {
    expect(getErrorMessage({ message: "obj" })).toBe("obj");
  });

  it("ignores non-string object messages", () => {
    expect(getErrorMessage({ message: 42 })).toBe("Une erreur est survenue.");
  });

  it("falls back for null and undefined", () => {
    expect(getErrorMessage(null)).toBe("Une erreur est survenue.");
    expect(getErrorMessage(undefined, "custom")).toBe("custom");
  });
});

describe("trackUxEvent", () => {
  it("does nothing when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => trackUxEvent("test")).not.toThrow();
  });

  it("buffers events in localStorage and forwards via beacon", () => {
    const storage = new Map<string, string>();
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
    });

    trackUxEvent("click", { button: "save" });

    const saved = JSON.parse(storage.get("edupilot_ux_events") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].event).toBe("click");
    expect(saved[0].pathname).toBe("/dashboard");
    expect(saved[0].payload.button).toBe("save");
    expect(sendBeacon).toHaveBeenCalled();
  });
});

describe("buildClimateReportSections", () => {
  const base: ClimateReportInput = {
    schoolName: "École Test",
    kpis: {
      activeReports: 2,
      reportsAnonymous: 1,
      reportsNominative: 1,
      psyAppointmentsThisWeek: 3,
      climateScore: 7,
      pulseResponses: 42,
    },
    reports: [],
    pulseWeeks: [],
    pulseStats: [],
    appointments: [],
  };

  it("always builds the key indicators section", () => {
    const sections = buildClimateReportSections(base);
    expect(sections[0].title).toBe("Indicateurs clés");
    expect(sections[0].rows).toContainEqual(["Score climat (pulse hebdo)", "7/10"]);
    expect(sections[0].rows).toContainEqual(["Réponses au baromètre", 42]);
  });

  it("shows a placeholder when climate score is missing", () => {
    const sections = buildClimateReportSections({
      ...base,
      kpis: { ...base.kpis, climateScore: null },
    });
    expect(sections[0].rows[0]).toEqual(["Score climat (pulse hebdo)", "Pas encore de réponses"]);
  });

  it("adds reports with French status labels", () => {
    const sections = buildClimateReportSections({
      ...base,
      reports: [
        {
          tag: "Élève",
          category: "Harcèlement",
          excerpt: "Situation préoccupante",
          severity: "HIGH",
          severityLabel: "Élevée",
          status: "IN_REVIEW",
          createdAt: "2026-08-10T08:00:00Z",
        },
      ],
    });
    const reportSection = sections.find((s) => s.title === "Signalements en cours");
    expect(reportSection).toBeDefined();
    expect(reportSection!.rows[0][4]).toBe("En analyse");
    expect(reportSection!.rows[0][3]).toBe("Élevée");
  });

  it("adds pulse weeks and answered stats", () => {
    const sections = buildClimateReportSections({
      ...base,
      pulseWeeks: [{ weekLabel: "S33", value: 7, responses: 12 }],
      pulseStats: [
        { label: "Se sent en sécurité", value: 88 },
        { label: "Non répondu", value: null },
      ],
    });
    const pulse = sections.find((s) => s.title === "Baromètre climat — évolution hebdomadaire");
    expect(pulse!.rows).toContainEqual(["S33", 7, 12]);
    const detail = sections.find((s) => s.title === "Baromètre climat — détail des questions");
    expect(detail!.rows).toEqual([["Se sent en sécurité", "88%"]]);
  });

  it("adds appointments with urgency flag", () => {
    const sections = buildClimateReportSections({
      ...base,
      appointments: [
        {
          startAt: "2026-08-12T14:00:00Z",
          durationMinutes: 45,
          kind: "Cellule d'écoute",
          anonymousLabel: null,
          isUrgent: true,
        },
      ],
    });
    const appt = sections.find((s) => s.title === "Rendez-vous de la cellule d'écoute");
    expect(appt!.rows[0]).toContain("45 min");
    expect(appt!.rows[0]).toContain("OUI");
    expect(appt!.rows[0]).toContain("—");
  });

  it("skips empty sections", () => {
    const sections = buildClimateReportSections(base);
    expect(sections).toHaveLength(1);
  });
});