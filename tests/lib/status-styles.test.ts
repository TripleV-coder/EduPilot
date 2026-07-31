import { describe, it, expect } from "vitest";
import {
  getAppointmentStatusClass,
  getIncidentSeverityClass,
  getAnnouncementPriorityClass,
  getComplianceRequestStatusClass,
  getEventTypeClass,
  getEventTypeAccentClass,
  getAuditLogActionClass,
  getClassCycleClass,
  getUserActivityClass,
  getUserAccountStatusClass,
  getRootUserRoleClass,
} from "@/lib/ui/status-styles";

describe("status-styles — mapping statut → classes sémantiques", () => {
  it("rendez-vous : chaque statut a un style distinct + fallback", () => {
    expect(getAppointmentStatusClass("CONFIRMED")).toContain("success");
    expect(getAppointmentStatusClass("PENDING")).toContain("warning");
    expect(getAppointmentStatusClass("CANCELLED")).toContain("destructive");
    expect(getAppointmentStatusClass("COMPLETED")).toContain("muted");
    expect(getAppointmentStatusClass("INCONNU")).toContain("primary");
  });

  it("incidents : la sévérité escalade vers destructive", () => {
    expect(getIncidentSeverityClass("CRITICAL")).toContain("destructive");
    expect(getIncidentSeverityClass("HIGH")).toContain("warning");
    expect(getIncidentSeverityClass("MEDIUM")).toContain("warning");
    expect(getIncidentSeverityClass("LOW")).toContain("primary");
    expect(getIncidentSeverityClass("?")).toContain("muted");
  });

  it("annonces : URGENT en destructive, LOW discret", () => {
    expect(getAnnouncementPriorityClass("URGENT")).toContain("destructive");
    expect(getAnnouncementPriorityClass("HIGH")).toContain("warning");
    expect(getAnnouncementPriorityClass("LOW")).toContain("muted");
    expect(getAnnouncementPriorityClass("NORMAL")).toContain("primary");
  });

  it("demandes RGPD : cycle PENDING → IN_PROGRESS → COMPLETED/REJECTED", () => {
    expect(getComplianceRequestStatusClass("PENDING")).toContain("warning");
    expect(getComplianceRequestStatusClass("IN_PROGRESS")).toContain("primary");
    expect(getComplianceRequestStatusClass("COMPLETED")).toContain("success");
    expect(getComplianceRequestStatusClass("REJECTED")).toContain("destructive");
    expect(getComplianceRequestStatusClass("?")).toContain("muted");
  });

  it("événements : type et accent retournent des classes non vides", () => {
    for (const type of ["FIELD_TRIP", "MEETING", "CELEBRATION", "EXAM", "AUTRE"]) {
      expect(getEventTypeClass(type)).toBeTruthy();
      expect(getEventTypeAccentClass(type)).toBeTruthy();
    }
  });

  it("audit log : create/delete/update différenciés", () => {
    expect(getAuditLogActionClass("CREATE")).toBeTruthy();
    expect(getAuditLogActionClass("DELETE")).toBeTruthy();
    expect(getAuditLogActionClass("UPDATE")).toBeTruthy();
    expect(getAuditLogActionClass("LOGIN")).toBeTruthy();
  });

  it("cycles de classes et statuts utilisateur", () => {
    expect(getClassCycleClass("6EME")).toBeTruthy();
    expect(getClassCycleClass(undefined)).toBeTruthy();
    expect(getUserActivityClass(true)).not.toBe(getUserActivityClass(false));
    expect(getUserAccountStatusClass(true)).not.toBe(getUserAccountStatusClass(false));
    expect(getRootUserRoleClass("SUPER_ADMIN")).toBeTruthy();
    expect(getRootUserRoleClass("AUTRE")).toBeTruthy();
  });
});
