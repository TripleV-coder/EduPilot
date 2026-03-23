/**
 * Seed Utilities — Shared helpers and data constants
 * Used by all seed modules.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
export { prisma };

// ============================================
// DONNÉES RÉALISTES POUR LE BÉNIN
// ============================================
export const cities = ["Cotonou", "Porto-Novo", "Abomey-Calavi", "Bohicon", "Parakou", "Djougou", "Natitingou", "Lokossa", "Ouidah", "Kandi"];
export const nationalities = ["Beninoise", "Togolaise", "Nigériane", "Ghanéenne", "Française", "Ivoirienne"];
export const firstNamesMale = ["Koffi", "Jean", "Pierre", "David", "Fabrice", "Ange", "Christian", "Didier", "Michaël", "Alain", "Beni", "Cédric", "Eric", "Fidèle", "Gilles", "Hubert", "Ismaël", "Josué", "Kevin", "Loïc", "Marcel", "Nicolas", "Olivier", "Patrick", "Rodrigue", "Serge", "Théodore", "Ulrich", "Victor", "Wilfried"];
export const firstNamesFemale = ["Amina", "Esther", "Marie", "Fatou", "Aicha", "Nadia", "Claire", "Émilie", "Florence", "Grace", "Hortense", "Irène", "Julie", "Kate", "Laura", "Mireille", "Nathalie", "Olivia", "Patricia", "Rosine", "Sandrine", "Thérèse", "Ursule", "Véronique", "Wivine", "Xavière", "Yvonne", "Zoé"];
export const lastNames = ["Agbossou", "Dossou", "Chabi", "Hounkpatin", "Ahounou", "Bello", "Togan", "Zinsou", "Kêkê", "Sèhouéto", "Coulibaly", "Diarra", "Bamba", "Diallo", "Ouattara", "Taloti", "Gandonou", "Houétchénou", "Yacoubou", "Adjavon", "Sossou", "Gbèdji", "Akpovo", "Djidonou", "Fanougbo", "Gnanhoui", "Hounmenou", "Idohou", "Jidohou", "Kounou"];

export const professions = [
    "Commerçant", "Fonctionnaire", "Artisan", "Agriculteur", "Infirmier",
    "Enseignant", "Médecin", "Avocat", "Ingénieur", "Chauffeur",
    "Comptable", "Pharmacien", "Architecte", "Journaliste", "Banquier",
    "Entrepreneur", "Mécanicien", "Coiffeur", "Couturier", "Menuisier"
];

// ============================================
// FONCTIONS UTILITAIRES
// ============================================
export function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomGrade(min: number = 4, max: number = 20): number {
    return Math.round((Math.random() * (max - min) + min) * 2) / 2;
}

export function randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export async function generatePhone(): Promise<string> {
    return `+229 ${randomInt(60, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)} ${randomInt(10, 99)}`;
}

export function generateMatricule(prefix: string, index: number, year: number = 2024): string {
    return `${prefix}${year}${String(index + 1).padStart(4, "0")}`;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function createUser(
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    schoolId: string | null,
    password: string = "Password123!"
) {
    const hashedPassword = await hashPassword(password);
    return prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: role as any,
            schoolId: schoolId || undefined,
            phone: await generatePhone(),
        },
    });
}

// ============================================
// STUDENT SCENARIO TYPE
// ============================================
export interface StudentScenario {
    type: string;
    count: number;
    gradeRange: [number, number];
    attendanceRate: number;
    behaviorScore: number;
    description: string;
}

export const studentScenarios: StudentScenario[] = [
    { type: "excellent", count: 15, gradeRange: [16, 20], attendanceRate: 98, behaviorScore: 95, description: "Élève excellent" },
    { type: "tres_bon", count: 20, gradeRange: [14, 17], attendanceRate: 95, behaviorScore: 90, description: "Très bon élève" },
    { type: "bon", count: 25, gradeRange: [12, 15], attendanceRate: 90, behaviorScore: 85, description: "Bon élève" },
    { type: "moyen", count: 20, gradeRange: [10, 13], attendanceRate: 85, behaviorScore: 80, description: "Élève moyen" },
    { type: "en_difficulte", count: 12, gradeRange: [7, 11], attendanceRate: 75, behaviorScore: 70, description: "Élève en difficulté" },
    { type: "irregulier", count: 8, gradeRange: [5, 14], attendanceRate: 65, behaviorScore: 60, description: "Élève irrégulier" },
];

// ============================================
// SEED CONTEXT — Shared mutable state for modules
// ============================================
export interface SeedContext {
    // Schools
    school1: any;
    school2: any;
    school3: any;
    // Users
    superAdmin: any;
    schoolAdmin1: any;
    director1: any;
    // Academic
    academicYear1: any;
    periods: any[];
    evalTypes: any[];
    subjects: any[];
    subjectsData: any[];
    collegeLevels: any[];
    collegeClasses: any[];
    classLevelRecords: any[];
    // Teachers
    teachers: any[];
    classSubjects: any[];
    // Families
    students: any[];
    parents: any[];
    // Counters
    totalGrades: number;
    gradesByStudent: Map<string, number[]>;
    paymentCount: number;
    courseCount: number;
    examCount: number;
    medicalCount: number;
    certCount: number;
    notifCount: number;
    // Events
    events: any[];
    announcements: any[];
}

export function createEmptyContext(): SeedContext {
    return {
        school1: null,
        school2: null,
        school3: null,
        superAdmin: null,
        schoolAdmin1: null,
        director1: null,
        academicYear1: null,
        periods: [],
        evalTypes: [],
        subjects: [],
        subjectsData: [],
        collegeLevels: [],
        collegeClasses: [],
        classLevelRecords: [],
        teachers: [],
        classSubjects: [],
        students: [],
        parents: [],
        totalGrades: 0,
        gradesByStudent: new Map(),
        paymentCount: 0,
        courseCount: 0,
        examCount: 0,
        medicalCount: 0,
        certCount: 0,
        notifCount: 0,
        events: [],
        announcements: [],
    };
}
