/**
 * Comptes et données DÉDIÉS aux tests E2E (Lot 5, N4 / N17).
 *
 * Avant : e2e/global-setup.ts réinitialisait le mot de passe, le verrouillage
 * et la 2FA de 8 comptes de démonstration existants, et les tests codaient en
 * dur les identifiants d'école et de classe d'un seed précis (sur une base
 * reseedée, security-tenant pouvait passer sans rien prouver).
 *
 * Désormais : des comptes propres aux E2E (domaine réservé .test), rattachés
 * aux écoles du seed retrouvées par leur CODE, et les identifiants réels lus
 * à l'exécution dans E2E_FIXTURES_FILE, écrit par global-setup. Aucun import
 * de Prisma ici : les specs l'utilisent sans charger la base.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export const E2E_PASSWORD = "E2eTestPass!2026";

export const E2E_USERS = {
    SUPER_ADMIN: "e2e.root@edupilot-e2e.test",
    SCHOOL_ADMIN_1: "e2e.admin1@edupilot-e2e.test",
    SCHOOL_ADMIN_2: "e2e.admin2@edupilot-e2e.test",
    DIRECTOR_1: "e2e.directeur1@edupilot-e2e.test",
    ACCOUNTANT_1: "e2e.comptable1@edupilot-e2e.test",
    TEACHER_1: "e2e.enseignant1@edupilot-e2e.test",
    STUDENT_1: "e2e.eleve1@edupilot-e2e.test",
    PARENT_1: "e2e.parent1@edupilot-e2e.test",
} as const;

/** Écoles du seed de démonstration, retrouvées par leur code (prisma/seeds/seed-foundation.ts). */
export const E2E_SCHOOL_CODES = { SCHOOL_1: "CESM", SCHOOL_2: "LNB" } as const;

/** Données dédiées créées dans l'école 1. */
export const E2E_CLASS_NAME = "E2E – classe dédiée";
export const E2E_STUDENT_MATRICULE = "E2E-ELEVE-0001";

export type E2EFixtures = {
    SCHOOL_1_ID: string;
    SCHOOL_2_ID: string;
    /** Classe dédiée de l'école 1 (enseignant, élève et parent E2E). */
    SCHOOL_1_CLASS_ID: string;
};

export const E2E_FIXTURES_FILE = path.join(__dirname, ".auth", "fixtures.json");

/** Identifiants réels de la base testée, écrits par global-setup. */
export function readE2EFixtures(): E2EFixtures {
    return JSON.parse(readFileSync(E2E_FIXTURES_FILE, "utf8")) as E2EFixtures;
}
