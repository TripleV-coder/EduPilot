import { beforeAll, describe, expect, it } from "vitest";
import ownerDb from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { PATCH as patchStudent } from "@/app/api/students/[id]/route";
import { POST as bulkImportStudents } from "@/app/api/students/bulk-import/route";

/**
 * INT-01 (2026-11-24) — matricule national EducMaster de l'élève : identifiant
 * de correspondance avec le SIGE (imprimé sur le bulletin et la carte
 * officiels, demandé par EducMaster pour le paiement de la contribution).
 * Normalisé en majuscules, unique par école parmi les élèves non supprimés.
 */
let schoolA: string;
let schoolB: string;
let adminA: string;
let adminB: string;

const email = (who: string) => `${uniqueCode(who)}@integration.test`.toLowerCase();

async function student(schoolId: string) {
    const user = await ownerDb.user.create({ data: { email: email("eleve"), password: "x", firstName: "Sena", lastName: "Houngbo", role: "STUDENT", schoolId } });
    return (await ownerDb.studentProfile.create({ data: { userId: user.id, schoolId, matricule: uniqueCode("MAT") } })).id;
}
function setMatricule(adminId: string, schoolId: string, id: string, value: string | null) {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    return callRoute(patchStudent, { method: "PATCH", path: `/api/students/${id}`, params: { id }, body: { educmasterMatricule: value } });
}
const stored = async (id: string) => (await ownerDb.studentProfile.findUniqueOrThrow({ where: { id } })).educmasterMatricule;

beforeAll(async () => {
    schoolA = (await createSchool("IT-EDM-A")).id;
    schoolB = (await createSchool("IT-EDM-B")).id;
    const admin = (schoolId: string) =>
        ownerDb.user.create({ data: { email: email("admin"), password: "x", firstName: "Admin", lastName: "EDM", role: "SCHOOL_ADMIN", schoolId } });
    adminA = (await admin(schoolA)).id;
    adminB = (await admin(schoolB)).id;
    await ownerDb.academicYear.create({
        data: { schoolId: schoolA, name: uniqueCode("AN"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
    });
});

describe("INT-01 — saisie sur la fiche élève", () => {
    it("normalisé en majuscules ; vide = effacé", async () => {
        const id = await student(schoolA);
        expect((await setMatricule(adminA, schoolA, id, " em-2026/0042 ")).status).toBe(200);
        expect(await stored(id)).toBe("EM-2026/0042");
        expect((await setMatricule(adminA, schoolA, id, "")).status).toBe(200);
        expect(await stored(id)).toBeNull();
    });

    it("caractères interdits : 400, rien n'est écrit", async () => {
        const id = await student(schoolA);
        expect((await setMatricule(adminA, schoolA, id, "12 34<script>")).status).toBe(400);
        expect(await stored(id)).toBeNull();
    });

    it("déjà attribué dans l'école : 409 ; le même matricule reste possible dans une autre école", async () => {
        const code = uniqueCode("EDM").toUpperCase();
        const first = await student(schoolA);
        const second = await student(schoolA);
        const elsewhere = await student(schoolB);
        expect((await setMatricule(adminA, schoolA, first, code)).status).toBe(200);
        expect((await setMatricule(adminA, schoolA, second, code)).status).toBe(409);
        expect(await stored(second)).toBeNull();
        expect((await setMatricule(adminB, schoolB, elsewhere, code)).status).toBe(200);
    });

    it("garde-fou en base : unique parmi les élèves actifs ; une suppression logique libère le matricule", async () => {
        const code = uniqueCode("EDM").toUpperCase();
        const gone = await student(schoolA);
        const other = await student(schoolA);
        await ownerDb.studentProfile.update({ where: { id: gone }, data: { educmasterMatricule: code } });
        await expect(ownerDb.studentProfile.update({ where: { id: other }, data: { educmasterMatricule: code } })).rejects.toThrow();
        await ownerDb.studentProfile.update({ where: { id: gone }, data: { deletedAt: new Date() } });
        await ownerDb.studentProfile.update({ where: { id: other }, data: { educmasterMatricule: code } });
        expect(await stored(other)).toBe(code);
    });
});

describe("INT-01 — import", () => {
    const post = (students: unknown[]) => {
        actAs(sessionFor("SCHOOL_ADMIN", schoolA, adminA));
        return callRoute(bulkImportStudents, { method: "POST", path: "/api/students/bulk-import", body: { students } });
    };

    it("colonne Matricule EducMaster enregistrée, normalisée", async () => {
        const code = uniqueCode("edm");
        const mail = email("import");
        const res = await post([{ firstName: "Afi", lastName: "Kpodo", email: mail, educmasterMatricule: code }]);
        expect(res.status).toBe(200);
        const profile = await ownerDb.studentProfile.findFirstOrThrow({ where: { user: { email: mail } } });
        expect(profile.educmasterMatricule).toBe(code.toUpperCase());
    });

    it("doublon dans le fichier ou déjà attribué : tout est refusé, ligne et champ situés", async () => {
        const code = uniqueCode("EDM").toUpperCase();
        const res = await post([
            { firstName: "Afi", lastName: "Un", email: email("a"), educmasterMatricule: code },
            { firstName: "Afi", lastName: "Deux", email: email("b"), educmasterMatricule: code },
        ]);
        expect(res.status).toBe(422);
        const errors = (res.body as { errors: Array<{ row: number; field?: string }> }).errors;
        expect(errors.filter((e) => e.field === "educmasterMatricule").map((e) => e.row)).toEqual([1, 2]);

        const taken = await student(schoolA);
        await ownerDb.studentProfile.update({ where: { id: taken }, data: { educmasterMatricule: code } });
        const again = await post([{ firstName: "Afi", lastName: "Trois", email: email("c"), educmasterMatricule: code }]);
        expect([409, 422]).toContain(again.status);
        expect(await ownerDb.studentProfile.count({ where: { schoolId: schoolA, educmasterMatricule: code } })).toBe(1);
    });
});
