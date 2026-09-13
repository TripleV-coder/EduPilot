import { afterEach, describe, expect, it, vi } from "vitest";
import { submitInscription, type InscriptionSubmitInput } from "@/lib/students/inscription-submit";

/**
 * N31 — l'écran « Nouvelle inscription » envoyait le mot de passe "00000000"
 * (refusé par la validation forte : inscription impossible depuis cet écran,
 * et valeur connue de tous si elle avait été acceptée). Plus aucun mot de passe
 * n'est envoyé : le serveur en génère un provisoire unique, que l'écran affiche.
 */
const FORM: InscriptionSubmitInput = {
  email: " awa@ecole.bj ",
  firstName: " Awa ",
  lastName: "Dossou",
  phone: "+22997000000",
  matricule: "MAT-2026-001",
  dateOfBirth: "2014-03-02",
  gender: "FEMALE",
  birthPlace: "",
  nationality: "",
  address: "",
  classId: "cclass000000000000000000001",
  academicYearId: "cyear0000000000000000000001",
};

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("submitInscription", () => {
  it("n'envoie aucun mot de passe et nettoie les champs saisis", async () => {
    const fetchMock = mockFetch(201, { id: "s1", provisionalPassword: "HKMP-4728" });
    await submitInscription(FORM);

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("/api/students");
    expect(body).not.toHaveProperty("password");
    expect(body).toMatchObject({ email: "awa@ecole.bj", firstName: "Awa", nationality: "Beninoise" });
    expect(body.birthPlace).toBeUndefined();
  });

  it("renvoie l'identifiant de l'élève et le mot de passe provisoire à afficher", async () => {
    mockFetch(201, { id: "s1", provisionalPassword: "HKMP-4728" });
    await expect(submitInscription(FORM)).resolves.toEqual({ ok: true, studentId: "s1", provisionalPassword: "HKMP-4728" });
  });

  it("renvoie le message d'erreur du serveur", async () => {
    mockFetch(400, { error: "Un utilisateur avec cet email existe déjà" });
    await expect(submitInscription(FORM)).resolves.toEqual({ ok: false, error: "Un utilisateur avec cet email existe déjà" });
  });
});
