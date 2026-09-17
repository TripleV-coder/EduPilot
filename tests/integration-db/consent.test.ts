import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import { GET, POST } from "@/app/api/compliance/consents/route";
import { LEGAL_TERMS_VERSION, isStudentDataAllowed } from "@/lib/security/consent";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 6 — consentement.
 *
 * Décisions du propriétaire (2026-09-14) : acceptation des conditions et de la
 * politique de confidentialité à la première connexion, horodatée et versionnée ;
 * pour un élève mineur, le consentement est donné par enfant, par un parent
 * rattaché. Un refus ou un retrait d'un seul parent suffit, et l'élève ne
 * consent pas seul. Le choix du parent est repris pour chacun de ses enfants.
 */
let school: string;
const ids: Record<string, string> = {};

async function makeUser(key: string, role: UserRole) {
  const user = await ownerDb.user.create({
    data: { email: `${uniqueCode(key)}@integration.test`.toLowerCase(), password: "x", firstName: key, lastName: "Consent", role, schoolId: school },
  });
  ids[key] = user.id;
  return user;
}

async function makeStudent(key: string) {
  const user = await makeUser(key, "STUDENT");
  const profile = await ownerDb.studentProfile.create({
    data: { userId: user.id, schoolId: school, matricule: uniqueCode(key).slice(0, 20), dateOfBirth: new Date("2015-04-01") },
  });
  ids[`${key}:profile`] = profile.id;
  return profile;
}

async function linkParent(parentKey: string, studentKey: string) {
  const parent = await ownerDb.parentProfile.upsert({
    where: { userId: ids[parentKey] },
    create: { userId: ids[parentKey] },
    update: {},
  });
  await ownerDb.parentStudent.create({
    data: { parentId: parent.id, studentId: ids[`${studentKey}:profile`], relationship: "PARENT" },
  });
}

beforeAll(async () => {
  school = (await createSchool("IT-CONS")).id;
  await makeUser("TEACHER", "TEACHER");
  await makeUser("PERE", "PARENT");
  await makeUser("MERE", "PARENT");
  await makeStudent("ENFANT");
  await linkParent("PERE", "ENFANT");
  await linkParent("MERE", "ENFANT");
});

const as = (key: string, role: UserRole) => actAs(sessionFor(role, school, ids[key]));
const get = () => callRoute(GET, { method: "GET", path: "/api/compliance/consents" });
const post = (body: unknown) => callRoute(POST, { method: "POST", path: "/api/compliance/consents", body });

type Pending = { needsTerms: boolean; termsVersion: string; children: { studentId: string; firstName: string; granted: boolean | null }[] };

describe("Lot 6 — consentement", () => {
  it("à la première connexion, les conditions ne sont pas encore acceptées", async () => {
    as("TEACHER", "TEACHER");
    const res = await get();
    expect(res.status).toBe(200);
    const body = res.body as Pending;
    expect(body.needsTerms).toBe(true);
    expect(body.termsVersion).toBe(LEGAL_TERMS_VERSION);
  });

  it("l'acceptation est enregistrée avec sa date et sa version", async () => {
    as("TEACHER", "TEACHER");
    expect((await post({ acceptTerms: true })).status).toBe(200);

    const consent = await ownerDb.dataConsent.findFirstOrThrow({
      where: { userId: ids.TEACHER, consentType: "TERMS" },
    });
    expect(consent.isGranted).toBe(true);
    expect(consent.version).toBe(LEGAL_TERMS_VERSION);
    expect(consent.grantedAt).toBeInstanceOf(Date);

    expect(((await get()).body as Pending).needsTerms).toBe(false);
  });

  it("une nouvelle version des conditions est redemandée", async () => {
    as("TEACHER", "TEACHER");
    await ownerDb.dataConsent.updateMany({
      where: { userId: ids.TEACHER, consentType: "TERMS" },
      data: { version: "2000-01-01" },
    });
    expect(((await get()).body as Pending).needsTerms).toBe(true);
  });

  it("le parent consent pour chacun de ses enfants ; l'élève n'est pas couvert tant qu'aucun parent n'a répondu", async () => {
    expect(await isStudentDataAllowed(ids.ENFANT)).toBe(false);

    as("PERE", "PARENT");
    const pending = (await get()).body as Pending;
    expect(pending.children.map((c) => c.studentId)).toEqual([ids["ENFANT:profile"]]);
    expect(pending.children[0].granted).toBeNull();

    expect((await post({ acceptTerms: true, children: { [ids["ENFANT:profile"]]: true } })).status).toBe(200);
    expect(await isStudentDataAllowed(ids.ENFANT)).toBe(true);
  });

  it("le refus d'un seul parent suffit", async () => {
    as("MERE", "PARENT");
    expect((await post({ acceptTerms: true, children: { [ids["ENFANT:profile"]]: false } })).status).toBe(200);
    expect(await isStudentDataAllowed(ids.ENFANT)).toBe(false);
  });

  it("un parent retire son consentement, l'enfant n'est plus couvert", async () => {
    as("MERE", "PARENT");
    await post({ acceptTerms: true, children: { [ids["ENFANT:profile"]]: true } });
    expect(await isStudentDataAllowed(ids.ENFANT)).toBe(true);

    as("PERE", "PARENT");
    expect((await post({ children: { [ids["ENFANT:profile"]]: false } })).status).toBe(200);
    const revoked = await ownerDb.dataConsent.findFirstOrThrow({
      where: { userId: ids.PERE, consentType: "CHILD_DATA", subjectUserId: ids.ENFANT },
    });
    expect(revoked.isGranted).toBe(false);
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(await isStudentDataAllowed(ids.ENFANT)).toBe(false);
  });

  it("l'élève mineur ne consent pas seul à la place de ses parents", async () => {
    as("ENFANT", "STUDENT");
    // Refusé, et rien n'est écrit : pas même l'acceptation des conditions
    // envoyée dans la même requête.
    expect((await post({ acceptTerms: true, children: { [ids["ENFANT:profile"]]: true } })).status).toBe(403);
    expect(await ownerDb.dataConsent.count({ where: { userId: ids.ENFANT } })).toBe(0);

    // Il accepte en revanche les conditions pour lui-même.
    expect((await post({ acceptTerms: true })).status).toBe(200);
    const own = await ownerDb.dataConsent.findFirstOrThrow({ where: { userId: ids.ENFANT, consentType: "TERMS" } });
    expect(own.isGranted).toBe(true);
    expect(await ownerDb.dataConsent.count({ where: { userId: ids.ENFANT, consentType: "CHILD_DATA" } })).toBe(0);
    expect(await isStudentDataAllowed(ids.ENFANT)).toBe(false);
  });

  it("un parent ne consent pas pour l'enfant d'un autre", async () => {
    await makeStudent("AUTRE");
    as("PERE", "PARENT");
    const res = await post({ children: { [ids["AUTRE:profile"]]: true } });
    expect(res.status).toBe(403);
    expect(await ownerDb.dataConsent.count({ where: { userId: ids.PERE, subjectUserId: ids.AUTRE } })).toBe(0);
  });
});
