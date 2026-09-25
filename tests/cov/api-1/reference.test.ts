/**
 * Couverture des référentiels : villes, professions, nationalités, options configurables.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    city: { findMany: vi.fn(), create: vi.fn() },
    profession: { findMany: vi.fn(), create: vi.fn() },
    nationality: { findMany: vi.fn(), create: vi.fn() },
    configOption: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import * as cities from "@/app/api/reference/cities/route";
import * as professions from "@/app/api/reference/professions/route";
import * as nationalities from "@/app/api/reference/nationalities/route";
import * as configOptions from "@/app/api/reference/config-options/route";

const base = "http://localhost/api/reference";
const asRole = (role: string, schoolId: string | null = FIXTURES.schoolA) =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId }));
const duplicate = () => new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" } as never);
const post = (handler: typeof cities.POST, path: string, body: unknown) =>
  handler(makeRequest(`${base}/${path}`, { method: "POST", body }));

beforeEach(() => {
  vi.clearAllMocks();
  asRole("TEACHER");
});

describe("/api/reference/cities", () => {
  it("GET : villes actives du Bénin par défaut", async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValueOnce([{ id: "c1", name: "Cotonou" }] as never);
    const res = await cities.GET(makeRequest(`${base}/cities`));
    expect(await res.json()).toEqual([{ id: "c1", name: "Cotonou" }]);
    expect(vi.mocked(prisma.city.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { isActive: true, countryCode: "BJ" } })
    );
  });

  it("GET : filtre par pays, région et recherche insensible à la casse", async () => {
    vi.mocked(prisma.city.findMany).mockResolvedValueOnce([] as never);
    await cities.GET(makeRequest(`${base}/cities?countryCode=TG&region=Maritime&search=lom`));
    expect(vi.mocked(prisma.city.findMany).mock.calls[0][0]?.where).toEqual({
      isActive: true, countryCode: "TG", region: "Maritime", name: { contains: "lom", mode: "insensitive" },
    });
  });

  it("GET : 500 générique en cas d'erreur", async () => {
    vi.mocked(prisma.city.findMany).mockRejectedValueOnce(new Error("db down"));
    const res = await cities.GET(makeRequest(`${base}/cities`));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });

  it("POST : réservé au super-admin (403)", async () => {
    asRole("SCHOOL_ADMIN");
    expect((await post(cities.POST, "cities", { name: "X", countryCode: "bj" })).status).toBe(403);
    expect(prisma.city.create).not.toHaveBeenCalled();
  });

  it("POST : exige nom et code pays (400)", async () => {
    asRole("SUPER_ADMIN", null);
    expect((await post(cities.POST, "cities", { name: "X" })).status).toBe(400);
  });

  it("POST : crée la ville avec code pays en majuscules et population entière", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.city.create).mockResolvedValueOnce({ id: "c1" } as never);
    const res = await post(cities.POST, "cities", { name: "Parakou", countryCode: "bj", region: "Borgou", population: "255478" });
    expect(res.status).toBe(201);
    expect(prisma.city.create).toHaveBeenCalledWith({
      data: { name: "Parakou", countryCode: "BJ", region: "Borgou", population: 255478 },
    });
  });

  it("POST : population absente enregistrée à null", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.city.create).mockResolvedValueOnce({ id: "c1" } as never);
    await post(cities.POST, "cities", { name: "Ouidah", countryCode: "BJ" });
    expect(vi.mocked(prisma.city.create).mock.calls[0][0].data.population).toBeNull();
  });

  it("POST : doublon → 409, autre erreur → 500", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.city.create).mockRejectedValueOnce(duplicate());
    expect((await post(cities.POST, "cities", { name: "X", countryCode: "BJ" })).status).toBe(409);
    vi.mocked(prisma.city.create).mockRejectedValueOnce(new Error("secret"));
    const res = await post(cities.POST, "cities", { name: "X", countryCode: "BJ" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
  });
});

describe("/api/reference/professions", () => {
  it("GET : professions actives, filtrées par catégorie et recherche", async () => {
    vi.mocked(prisma.profession.findMany).mockResolvedValue([] as never);
    await professions.GET(makeRequest(`${base}/professions`));
    expect(vi.mocked(prisma.profession.findMany).mock.calls[0][0]?.where).toEqual({ isActive: true });
    await professions.GET(makeRequest(`${base}/professions?category=HEALTH&search=méd`));
    expect(vi.mocked(prisma.profession.findMany).mock.calls[1][0]?.where).toEqual({
      isActive: true, category: "HEALTH", name: { contains: "méd", mode: "insensitive" },
    });
  });

  it("GET : 500 générique en cas d'erreur", async () => {
    vi.mocked(prisma.profession.findMany).mockRejectedValueOnce(new Error("x"));
    expect((await professions.GET(makeRequest(`${base}/professions`))).status).toBe(500);
  });

  it("POST : réservé au super-admin, exige nom et catégorie", async () => {
    asRole("DIRECTOR");
    expect((await post(professions.POST, "professions", { name: "A", category: "B" })).status).toBe(403);
    asRole("SUPER_ADMIN", null);
    expect((await post(professions.POST, "professions", { name: "A" })).status).toBe(400);
  });

  it("POST : crée la profession", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.profession.create).mockResolvedValueOnce({ id: "p1" } as never);
    const res = await post(professions.POST, "professions", { name: "Médecin", category: "HEALTH", description: "d" });
    expect(res.status).toBe(201);
    expect(prisma.profession.create).toHaveBeenCalledWith({ data: { name: "Médecin", category: "HEALTH", description: "d" } });
  });

  it("POST : doublon → 409 ; autre erreur Prisma ou inconnue → 500", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.profession.create).mockRejectedValueOnce(duplicate());
    expect((await post(professions.POST, "professions", { name: "A", category: "B" })).status).toBe(409);
    vi.mocked(prisma.profession.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "x" } as never)
    );
    expect((await post(professions.POST, "professions", { name: "A", category: "B" })).status).toBe(500);
    vi.mocked(prisma.profession.create).mockRejectedValueOnce(new Error("x"));
    expect((await post(professions.POST, "professions", { name: "A", category: "B" })).status).toBe(500);
  });
});

describe("/api/reference/nationalities", () => {
  it("GET : nationalités actives, recherche optionnelle", async () => {
    vi.mocked(prisma.nationality.findMany).mockResolvedValue([{ id: "n1" }] as never);
    await nationalities.GET(makeRequest(`${base}/nationalities`));
    expect(vi.mocked(prisma.nationality.findMany).mock.calls[0][0]?.where).toEqual({ isActive: true });
    await nationalities.GET(makeRequest(`${base}/nationalities?search=bén`));
    expect(vi.mocked(prisma.nationality.findMany).mock.calls[1][0]?.where).toEqual({
      isActive: true, name: { contains: "bén", mode: "insensitive" },
    });
  });

  it("GET : 500 générique en cas d'erreur", async () => {
    vi.mocked(prisma.nationality.findMany).mockRejectedValueOnce(new Error("x"));
    expect((await nationalities.GET(makeRequest(`${base}/nationalities`))).status).toBe(500);
  });

  it("POST : réservé au super-admin, exige nom et code", async () => {
    asRole("SCHOOL_ADMIN");
    expect((await post(nationalities.POST, "nationalities", { name: "A", code: "b" })).status).toBe(403);
    asRole("SUPER_ADMIN", null);
    expect((await post(nationalities.POST, "nationalities", { name: "A" })).status).toBe(400);
  });

  it("POST : crée la nationalité avec code ISO en majuscules", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.nationality.create).mockResolvedValueOnce({ id: "n1" } as never);
    expect((await post(nationalities.POST, "nationalities", { name: "Béninoise", code: "bj" })).status).toBe(201);
    expect(prisma.nationality.create).toHaveBeenCalledWith({ data: { name: "Béninoise", code: "BJ" } });
  });

  it("POST : doublon → 409 ; autre erreur → 500", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.nationality.create).mockRejectedValueOnce(duplicate());
    expect((await post(nationalities.POST, "nationalities", { name: "A", code: "B" })).status).toBe(409);
    vi.mocked(prisma.nationality.create).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("x", { code: "P2000", clientVersion: "x" } as never)
    );
    expect((await post(nationalities.POST, "nationalities", { name: "A", code: "B" })).status).toBe(500);
  });
});

describe("/api/reference/config-options", () => {
  const get = (qs: string) => configOptions.GET(makeRequest(`${base}/config-options${qs}`));

  it("GET : exige la catégorie (400)", async () => {
    expect((await get("")).status).toBe(400);
  });

  it("GET : options globales + options de l'école active", async () => {
    vi.mocked(prisma.configOption.findMany).mockResolvedValueOnce([] as never);
    await get("?category=BLOOD_TYPE");
    expect(vi.mocked(prisma.configOption.findMany).mock.calls[0][0]?.where).toEqual({
      category: "BLOOD_TYPE", isActive: true, OR: [{ schoolId: null }, { schoolId: FIXTURES.schoolA }],
    });
  });

  it("GET : refuse l'accès aux options d'une autre école (403)", async () => {
    const res = await get(`?category=X&schoolId=${FIXTURES.schoolB}`);
    expect(res.status).toBe(403);
    expect(prisma.configOption.findMany).not.toHaveBeenCalled();
  });

  it("GET : super-admin sans école → options globales uniquement", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.configOption.findMany).mockResolvedValueOnce([] as never);
    await get("?category=X");
    expect(vi.mocked(prisma.configOption.findMany).mock.calls[0][0]?.where).toEqual({
      category: "X", isActive: true, OR: [{ schoolId: null }],
    });
  });

  it("GET : super-admin peut cibler une école précise", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.configOption.findMany).mockResolvedValueOnce([] as never);
    await get(`?category=X&schoolId=${FIXTURES.schoolB}`);
    expect(vi.mocked(prisma.configOption.findMany).mock.calls[0][0]?.where?.OR).toEqual([{ schoolId: null }, { schoolId: FIXTURES.schoolB }]);
  });

  it("GET : 500 générique en cas d'erreur", async () => {
    vi.mocked(prisma.configOption.findMany).mockRejectedValueOnce(new Error("x"));
    expect((await get("?category=X")).status).toBe(500);
  });

  const postOpt = (body: unknown) => post(configOptions.POST, "config-options", body);

  it("POST : refuse les rôles non administrateurs (403)", async () => {
    asRole("TEACHER");
    expect((await postOpt({ category: "A", code: "B", label: "C", schoolId: FIXTURES.schoolA })).status).toBe(403);
  });

  it("POST : valide le corps (400)", async () => {
    asRole("SCHOOL_ADMIN");
    const res = await postOpt({ category: "A" });
    expect(res.status).toBe(400);
    expect((await res.json()).details).toBeDefined();
  });

  it("POST : un admin d'école ne crée pas d'option pour une autre école (403)", async () => {
    asRole("SCHOOL_ADMIN");
    expect((await postOpt({ category: "A", code: "B", label: "C", schoolId: FIXTURES.schoolB })).status).toBe(403);
    expect(prisma.configOption.create).not.toHaveBeenCalled();
  });

  it("POST : un admin d'école ne crée pas d'option globale (403)", async () => {
    asRole("SCHOOL_ADMIN");
    expect((await postOpt({ category: "A", code: "B", label: "C" })).status).toBe(403);
  });

  it("POST : un admin d'école crée une option pour son école (ordre 0 par défaut)", async () => {
    asRole("SCHOOL_ADMIN");
    vi.mocked(prisma.configOption.create).mockResolvedValueOnce({ id: "o1" } as never);
    const res = await postOpt({ category: "A", code: "B", label: "C", schoolId: FIXTURES.schoolA, metadata: { k: 1 } });
    expect(res.status).toBe(201);
    expect(prisma.configOption.create).toHaveBeenCalledWith({
      data: { category: "A", code: "B", label: "C", description: undefined, order: 0, metadata: { k: 1 }, schoolId: FIXTURES.schoolA },
    });
  });

  it("POST : le super-admin crée une option globale", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.configOption.create).mockResolvedValueOnce({ id: "o1" } as never);
    await postOpt({ category: "A", code: "B", label: "C", order: 3 });
    expect(vi.mocked(prisma.configOption.create).mock.calls[0][0].data).toEqual(
      expect.objectContaining({ order: 3, schoolId: null, metadata: undefined })
    );
  });

  it("POST : doublon → 409, autre erreur → 500", async () => {
    asRole("SUPER_ADMIN", null);
    vi.mocked(prisma.configOption.create).mockRejectedValueOnce(duplicate());
    expect((await postOpt({ category: "A", code: "B", label: "C" })).status).toBe(409);
    vi.mocked(prisma.configOption.create).mockRejectedValueOnce(new Error("x"));
    expect((await postOpt({ category: "A", code: "B", label: "C" })).status).toBe(500);
  });
});
