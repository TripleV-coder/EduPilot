import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStudentList, studentListFrom } from "@/lib/api/student-list";

/**
 * N18 — `/api/students` renvoie `{ data, pagination }` (curseur ou ?page=).
 * Plusieurs écrans lisaient `students` (clé inexistante) : liste toujours vide.
 */
const student = { id: "s1", user: { firstName: "Kate", lastName: "Agbossou" } };
const cursorResponse = { data: [student], pagination: { limit: 100, nextCursor: null, hasNextPage: false, total: 1 } };
const offsetResponse = { data: [student], pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };

describe("studentListFrom", () => {
  it("lit la clé data des deux formats paginés de la route", () => {
    expect(studentListFrom(cursorResponse)).toEqual([student]);
    expect(studentListFrom(offsetResponse)).toEqual([student]);
  });

  it("accepte un tableau brut et renvoie une liste vide pour une réponse absente ou inattendue", () => {
    expect(studentListFrom([student])).toEqual([student]);
    expect(studentListFrom(undefined)).toEqual([]);
    expect(studentListFrom(null)).toEqual([]);
    expect(studentListFrom({ error: "x" })).toEqual([]);
  });
});

describe("fetchStudentList", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("interroge /api/students avec les paramètres et renvoie les élèves", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => cursorResponse });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchStudentList("classId=c1&limit=1000")).resolves.toEqual([student]);
    expect(fetchMock).toHaveBeenCalledWith("/api/students?classId=c1&limit=1000");
  });

  it("lève une erreur HTTP au lieu de renvoyer une liste vide", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "Accès refusé" }) }));
    await expect(fetchStudentList()).rejects.toThrow("HTTP 403");
  });
});
