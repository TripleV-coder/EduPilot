/**
 * Couverture de /api/medical-records et de ses sous-ressources
 * (contacts d'urgence, vaccinations, allergies). Le module d'accès santé
 * (@/lib/health/access) est RÉEL : seules les lectures Prisma sont simulées,
 * ce qui éprouve le cloisonnement école/parent/élève de bout en bout.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    medicalRecord: { findUnique: vi.fn(), upsert: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    emergencyContact: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    vaccination: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    allergy: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import * as records from "@/app/api/medical-records/route";
import * as contacts from "@/app/api/medical-records/[id]/emergency-contacts/route";
import * as vaccinations from "@/app/api/medical-records/[id]/vaccinations/route";
import * as allergies from "@/app/api/medical-records/[id]/allergies/route";

const STUDENT_ID = cuid("studentmed");
const RECORD_ID = "rec-1";
const base = "http://localhost/api/medical-records";
const asRole = (role: string, schoolId: string | null = FIXTURES.schoolA) =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId }));
const ctx = (id = RECORD_ID) => ({ params: Promise.resolve({ id }) });

/** Dossier médical rattaché à un élève de l'école donnée (lu par ensureMedicalRecordHealthAccess). */
const recordOf = (schoolId: string) =>
  ({ id: RECORD_ID, studentId: STUDENT_ID, student: { id: STUDENT_ID, schoolId, userId: "u-stu" } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  asRole("DIRECTOR");
});

describe("GET /api/medical-records", () => {
  const get = (qs = "") => records.GET(makeRequest(`${base}${qs}`));

  it("refuse les rôles sans permission médicale (enseignant, 403)", async () => {
    asRole("TEACHER");
    expect((await get(`?studentId=${STUDENT_ID}`)).status).toBe(403);
    expect(prisma.medicalRecord.findUnique).not.toHaveBeenCalled();
  });

  it("refuse le personnel non soignant malgré MEDICAL_READ (STAFF, 403)", async () => {
    asRole("STAFF");
    expect((await get(`?studentId=${STUDENT_ID}`)).status).toBe(403);
  });

  it("exige studentId (400)", async () => {
    expect((await get()).status).toBe(400);
  });

  it("renvoie 404 si l'élève n'existe pas", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await get(`?studentId=${STUDENT_ID}`)).status).toBe(404);
  });

  it("refuse le dossier d'un élève d'une autre école (403)", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: STUDENT_ID, schoolId: FIXTURES.schoolB, userId: "u" } as never);
    expect((await get(`?studentId=${STUDENT_ID}`)).status).toBe(403);
    expect(prisma.medicalRecord.findUnique).not.toHaveBeenCalled();
  });

  it("renvoie 404 si l'élève n'a pas de dossier", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: STUDENT_ID, schoolId: FIXTURES.schoolA, userId: "u" } as never);
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValueOnce(null as never);
    expect((await get(`?studentId=${STUDENT_ID}`)).status).toBe(404);
  });

  it("renvoie le dossier complet d'un élève de l'école", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: STUDENT_ID, schoolId: FIXTURES.schoolA, userId: "u" } as never);
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValueOnce({ id: RECORD_ID, bloodType: "O+" } as never);
    const res = await get(`?studentId=${STUDENT_ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: RECORD_ID, bloodType: "O+" });
    expect(vi.mocked(prisma.medicalRecord.findUnique).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { studentId: STUDENT_ID } })
    );
  });

  it.skip("BUG: un élève doit pouvoir lire son propre dossier médical", async () => {
    // HEALTH_READ_ROLES inclut STUDENT/PARENT mais la route exige MEDICAL_READ,
    // que ces rôles n'ont pas : la branche « élève » (l. 33-39) est inatteignable.
    asRole("STUDENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: STUDENT_ID, schoolId: FIXTURES.schoolA, userId: "u" } as never);
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValueOnce({ id: RECORD_ID } as never);
    expect((await get()).status).toBe(200);
  });
});

describe("POST /api/medical-records", () => {
  const post = (body: unknown) => records.POST(makeRequest(base, { method: "POST", body }));

  it("refuse le personnel non soignant (STAFF, 403)", async () => {
    asRole("STAFF");
    expect((await post({ studentId: STUDENT_ID })).status).toBe(403);
    expect(prisma.medicalRecord.upsert).not.toHaveBeenCalled();
  });

  it("refuse un directeur sans établissement (403)", async () => {
    asRole("DIRECTOR", null);
    expect((await post({ studentId: STUDENT_ID })).status).toBe(403);
  });

  it("valide le corps (400)", async () => {
    const res = await post({ studentId: "pas-un-cuid" });
    expect(res.status).toBe(400);
  });

  it("refuse un élève d'une autre école (403)", async () => {
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: STUDENT_ID, schoolId: FIXTURES.schoolB, userId: "u" } as never);
    expect((await post({ studentId: STUDENT_ID })).status).toBe(403);
    expect(prisma.medicalRecord.upsert).not.toHaveBeenCalled();
  });

  it("crée ou met à jour le dossier et trace l'opération", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA, id: "u-dir" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: STUDENT_ID, schoolId: FIXTURES.schoolA, userId: "u" } as never);
    vi.mocked(prisma.medicalRecord.upsert).mockResolvedValueOnce({ id: RECORD_ID } as never);
    const res = await post({ studentId: STUDENT_ID, bloodType: "A+" });
    expect(res.status).toBe(201);
    const args = vi.mocked(prisma.medicalRecord.upsert).mock.calls[0][0];
    expect(args.where).toEqual({ studentId: STUDENT_ID });
    expect(args.create).toEqual(expect.objectContaining({ studentId: STUDENT_ID, bloodType: "A+", medications: [], conditions: [] }));
    expect(args.update).toEqual(expect.objectContaining({ bloodType: "A+", medications: [], conditions: [] }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "u-dir", action: "UPDATE_MEDICAL_RECORD", entityId: RECORD_ID }),
    });
  });

  it("conserve traitements et pathologies fournis", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce({ id: STUDENT_ID, schoolId: FIXTURES.schoolB, userId: "u" } as never);
    vi.mocked(prisma.medicalRecord.upsert).mockResolvedValueOnce({ id: RECORD_ID } as never);
    await post({ studentId: STUDENT_ID, medications: ["Ventoline"], conditions: ["Asthme"] });
    const args = vi.mocked(prisma.medicalRecord.upsert).mock.calls[0][0];
    expect(args.create.medications).toEqual(["Ventoline"]);
    expect(args.update.conditions).toEqual(["Asthme"]);
  });
});

describe("/api/medical-records/[id]/emergency-contacts", () => {
  const url = `${base}/${RECORD_ID}/emergency-contacts`;
  const valid = { name: "Awa", relationship: "Mère", phone: "+22990000000" };
  const call = (fn: typeof contacts.POST, method: string, qs = "", body?: unknown) =>
    fn(makeRequest(`${url}${qs}`, { method, body }), ctx());

  it("refuse les rôles non soignants (403) sur chaque méthode", async () => {
    asRole("TEACHER");
    expect((await call(contacts.POST, "POST", "", valid)).status).toBe(403);
    expect((await call(contacts.PUT, "PUT", "?contactId=c1", valid)).status).toBe(403);
    expect((await call(contacts.DELETE, "DELETE", "?contactId=c1")).status).toBe(403);
    expect(prisma.medicalRecord.findUnique).not.toHaveBeenCalled();
  });

  it("renvoie 404 si le dossier n'existe pas", async () => {
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(null as never);
    expect((await call(contacts.POST, "POST", "", valid)).status).toBe(404);
    expect((await call(contacts.PUT, "PUT", "?contactId=c1", valid)).status).toBe(404);
    expect((await call(contacts.DELETE, "DELETE", "?contactId=c1")).status).toBe(404);
  });

  it("refuse un dossier d'une autre école (403) sans rien écrire", async () => {
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(recordOf(FIXTURES.schoolB));
    expect((await call(contacts.POST, "POST", "", valid)).status).toBe(403);
    expect((await call(contacts.PUT, "PUT", "?contactId=c1", valid)).status).toBe(403);
    expect((await call(contacts.DELETE, "DELETE", "?contactId=c1")).status).toBe(403);
    expect(prisma.emergencyContact.create).not.toHaveBeenCalled();
    expect(prisma.emergencyContact.update).not.toHaveBeenCalled();
    expect(prisma.emergencyContact.delete).not.toHaveBeenCalled();
  });

  describe("avec un dossier de l'école", () => {
    beforeEach(() => {
      vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(recordOf(FIXTURES.schoolA));
    });

    it("POST valide le corps (400)", async () => {
      const res = await call(contacts.POST, "POST", "", { name: "" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Données invalides");
    });

    it("POST crée un contact non principal sans toucher aux autres", async () => {
      vi.mocked(prisma.emergencyContact.create).mockResolvedValueOnce({ id: "c1" } as never);
      const res = await call(contacts.POST, "POST", "", valid);
      expect(res.status).toBe(201);
      expect(prisma.emergencyContact.updateMany).not.toHaveBeenCalled();
      expect(prisma.emergencyContact.create).toHaveBeenCalledWith({ data: { medicalRecordId: RECORD_ID, ...valid, isPrimary: false } });
    });

    it("POST d'un contact principal rétrograde l'ancien principal du même dossier", async () => {
      vi.mocked(prisma.emergencyContact.create).mockResolvedValueOnce({ id: "c2" } as never);
      await call(contacts.POST, "POST", "", { ...valid, isPrimary: true });
      expect(prisma.emergencyContact.updateMany).toHaveBeenCalledWith({
        where: { medicalRecordId: RECORD_ID, isPrimary: true },
        data: { isPrimary: false },
      });
    });

    it("POST : 500 générique si la création échoue", async () => {
      vi.mocked(prisma.emergencyContact.create).mockRejectedValueOnce(new Error("db"));
      const res = await call(contacts.POST, "POST", "", valid);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Erreur lors de la création" });
    });

    it("PUT exige contactId (400)", async () => {
      expect((await call(contacts.PUT, "PUT", "", valid)).status).toBe(400);
    });

    it("PUT refuse un contact d'un autre dossier (404, anti-IDOR)", async () => {
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce({ id: "c9", medicalRecordId: "rec-autre" } as never);
      expect((await call(contacts.PUT, "PUT", "?contactId=c9", valid)).status).toBe(404);
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce(null as never);
      expect((await call(contacts.PUT, "PUT", "?contactId=c9", valid)).status).toBe(404);
      expect(prisma.emergencyContact.update).not.toHaveBeenCalled();
    });

    it("PUT valide le corps (400)", async () => {
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce({ id: "c1", medicalRecordId: RECORD_ID } as never);
      expect((await call(contacts.PUT, "PUT", "?contactId=c1", { phone: "" })).status).toBe(400);
    });

    it("PUT met à jour ; en principal, rétrograde les autres contacts", async () => {
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValue({ id: "c1", medicalRecordId: RECORD_ID } as never);
      vi.mocked(prisma.emergencyContact.update).mockResolvedValue({ id: "c1" } as never);
      expect((await call(contacts.PUT, "PUT", "?contactId=c1", valid)).status).toBe(200);
      expect(prisma.emergencyContact.updateMany).not.toHaveBeenCalled();
      await call(contacts.PUT, "PUT", "?contactId=c1", { ...valid, isPrimary: true });
      expect(prisma.emergencyContact.updateMany).toHaveBeenCalledWith({
        where: { medicalRecordId: RECORD_ID, id: { not: "c1" }, isPrimary: true },
        data: { isPrimary: false },
      });
      expect(prisma.emergencyContact.update).toHaveBeenLastCalledWith({ where: { id: "c1" }, data: { ...valid, isPrimary: true } });
    });

    it("PUT : 500 générique si la mise à jour échoue", async () => {
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce({ id: "c1", medicalRecordId: RECORD_ID } as never);
      vi.mocked(prisma.emergencyContact.update).mockRejectedValueOnce(new Error("db"));
      expect((await call(contacts.PUT, "PUT", "?contactId=c1", valid)).status).toBe(500);
    });

    it("DELETE exige contactId (400) et refuse un contact étranger (404)", async () => {
      expect((await call(contacts.DELETE, "DELETE")).status).toBe(400);
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce({ id: "c9", medicalRecordId: "rec-autre" } as never);
      expect((await call(contacts.DELETE, "DELETE", "?contactId=c9")).status).toBe(404);
      expect(prisma.emergencyContact.delete).not.toHaveBeenCalled();
    });

    it("DELETE supprime le contact du dossier", async () => {
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce({ id: "c1", medicalRecordId: RECORD_ID } as never);
      const res = await call(contacts.DELETE, "DELETE", "?contactId=c1");
      expect(await res.json()).toEqual({ message: "Contact supprimé" });
      expect(prisma.emergencyContact.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    });

    it("DELETE : 500 générique si la suppression échoue", async () => {
      vi.mocked(prisma.emergencyContact.findUnique).mockResolvedValueOnce({ id: "c1", medicalRecordId: RECORD_ID } as never);
      vi.mocked(prisma.emergencyContact.delete).mockRejectedValueOnce(new Error("db"));
      expect((await call(contacts.DELETE, "DELETE", "?contactId=c1")).status).toBe(500);
    });
  });
});

describe("/api/medical-records/[id]/vaccinations", () => {
  const url = `${base}/${RECORD_ID}/vaccinations`;
  const valid = { vaccineName: "BCG", dateGiven: "2026-01-01T00:00:00.000Z" };
  const call = (fn: typeof vaccinations.POST, method: string, qs = "", body?: unknown) =>
    fn(makeRequest(`${url}${qs}`, { method, body }), ctx());

  it("refuse les rôles non soignants (403)", async () => {
    asRole("PARENT");
    expect((await call(vaccinations.POST, "POST", "", valid)).status).toBe(403);
    expect((await call(vaccinations.DELETE, "DELETE", "?vaccinationId=v1")).status).toBe(403);
  });

  it("refuse un dossier d'une autre école (403)", async () => {
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(recordOf(FIXTURES.schoolB));
    expect((await call(vaccinations.POST, "POST", "", valid)).status).toBe(403);
    expect((await call(vaccinations.DELETE, "DELETE", "?vaccinationId=v1")).status).toBe(403);
    expect(prisma.vaccination.create).not.toHaveBeenCalled();
  });

  describe("avec un dossier de l'école", () => {
    beforeEach(() => {
      vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(recordOf(FIXTURES.schoolA));
    });

    it("POST valide les dates (400)", async () => {
      expect((await call(vaccinations.POST, "POST", "", { vaccineName: "BCG", dateGiven: "hier" })).status).toBe(400);
    });

    it("POST crée la vaccination (prochain rappel optionnel)", async () => {
      vi.mocked(prisma.vaccination.create).mockResolvedValue({ id: "v1" } as never);
      expect((await call(vaccinations.POST, "POST", "", valid)).status).toBe(201);
      expect(vi.mocked(prisma.vaccination.create).mock.calls[0][0].data).toEqual(
        expect.objectContaining({ medicalRecordId: RECORD_ID, vaccineName: "BCG", dateGiven: new Date(valid.dateGiven), nextDueDate: null })
      );
      await call(vaccinations.POST, "POST", "", { ...valid, nextDueDate: "2027-01-01T00:00:00.000Z", batchNumber: "L1" });
      expect(vi.mocked(prisma.vaccination.create).mock.calls[1][0].data).toEqual(
        expect.objectContaining({ nextDueDate: new Date("2027-01-01T00:00:00.000Z"), batchNumber: "L1" })
      );
    });

    it("POST : 500 générique en cas d'erreur", async () => {
      vi.mocked(prisma.vaccination.create).mockRejectedValueOnce(new Error("db"));
      expect((await call(vaccinations.POST, "POST", "", valid)).status).toBe(500);
    });

    it("DELETE exige vaccinationId (400) et refuse une vaccination étrangère (404)", async () => {
      expect((await call(vaccinations.DELETE, "DELETE")).status).toBe(400);
      vi.mocked(prisma.vaccination.findUnique).mockResolvedValueOnce({ id: "v9", medicalRecordId: "rec-autre" } as never);
      expect((await call(vaccinations.DELETE, "DELETE", "?vaccinationId=v9")).status).toBe(404);
      vi.mocked(prisma.vaccination.findUnique).mockResolvedValueOnce(null as never);
      expect((await call(vaccinations.DELETE, "DELETE", "?vaccinationId=v9")).status).toBe(404);
      expect(prisma.vaccination.delete).not.toHaveBeenCalled();
    });

    it("DELETE supprime la vaccination du dossier ; 500 si échec", async () => {
      vi.mocked(prisma.vaccination.findUnique).mockResolvedValue({ id: "v1", medicalRecordId: RECORD_ID } as never);
      expect(await (await call(vaccinations.DELETE, "DELETE", "?vaccinationId=v1")).json()).toEqual({ message: "Vaccination supprimée" });
      expect(prisma.vaccination.delete).toHaveBeenCalledWith({ where: { id: "v1" } });
      vi.mocked(prisma.vaccination.delete).mockRejectedValueOnce(new Error("db"));
      expect((await call(vaccinations.DELETE, "DELETE", "?vaccinationId=v1")).status).toBe(500);
    });
  });
});

describe("/api/medical-records/[id]/allergies", () => {
  const url = `${base}/${RECORD_ID}/allergies`;
  const valid = { allergen: "Arachide", severity: "SEVERE" };
  const call = (fn: typeof allergies.POST, method: string, qs = "", body?: unknown) =>
    fn(makeRequest(`${url}${qs}`, { method, body }), ctx());

  it("refuse les rôles non soignants (403)", async () => {
    asRole("STUDENT");
    expect((await call(allergies.POST, "POST", "", valid)).status).toBe(403);
    expect((await call(allergies.DELETE, "DELETE", "?allergyId=a1")).status).toBe(403);
  });

  it("refuse un dossier d'une autre école (403)", async () => {
    vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(recordOf(FIXTURES.schoolB));
    expect((await call(allergies.POST, "POST", "", valid)).status).toBe(403);
    expect((await call(allergies.DELETE, "DELETE", "?allergyId=a1")).status).toBe(403);
    expect(prisma.allergy.create).not.toHaveBeenCalled();
  });

  describe("avec un dossier de l'école", () => {
    beforeEach(() => {
      vi.mocked(prisma.medicalRecord.findUnique).mockResolvedValue(recordOf(FIXTURES.schoolA));
    });

    it("POST valide le corps (400)", async () => {
      expect((await call(allergies.POST, "POST", "", { allergen: "X" })).status).toBe(400);
    });

    it("POST crée l'allergie rattachée au dossier", async () => {
      vi.mocked(prisma.allergy.create).mockResolvedValueOnce({ id: "a1" } as never);
      expect((await call(allergies.POST, "POST", "", valid)).status).toBe(201);
      expect(prisma.allergy.create).toHaveBeenCalledWith({ data: { medicalRecordId: RECORD_ID, ...valid } });
    });

    it("POST : 500 générique en cas d'erreur", async () => {
      vi.mocked(prisma.allergy.create).mockRejectedValueOnce(new Error("db"));
      expect(await (await call(allergies.POST, "POST", "", valid)).json()).toEqual({ error: "Erreur" });
    });

    it("DELETE exige allergyId (400) et refuse une allergie étrangère (404)", async () => {
      expect((await call(allergies.DELETE, "DELETE")).status).toBe(400);
      vi.mocked(prisma.allergy.findUnique).mockResolvedValueOnce({ id: "a9", medicalRecordId: "rec-autre" } as never);
      expect((await call(allergies.DELETE, "DELETE", "?allergyId=a9")).status).toBe(404);
      expect(prisma.allergy.delete).not.toHaveBeenCalled();
    });

    it("DELETE supprime l'allergie ; 500 si échec", async () => {
      vi.mocked(prisma.allergy.findUnique).mockResolvedValue({ id: "a1", medicalRecordId: RECORD_ID } as never);
      expect(await (await call(allergies.DELETE, "DELETE", "?allergyId=a1")).json()).toEqual({ message: "Allergie supprimée" });
      vi.mocked(prisma.allergy.delete).mockRejectedValueOnce(new Error("db"));
      expect((await call(allergies.DELETE, "DELETE", "?allergyId=a1")).status).toBe(500);
    });
  });
});
