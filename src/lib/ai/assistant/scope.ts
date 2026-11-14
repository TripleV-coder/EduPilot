/**
 * Périmètre de l'assistant : ce que la personne connectée a le droit de voir,
 * calculé à partir de sa session et jamais élargi par ce qui est écrit.
 *
 * - direction (SUPER_ADMIN, SCHOOL_ADMIN — NETWORK_ADMIN par héritage —, DIRECTOR) : toute l'école active ;
 * - enseignant : ses classes de l'école active (`taughtClassIds`) ;
 * - parent : ses enfants ; élève : lui-même (`getOwnStudentIds`).
 *
 * Une école = un périmètre : aucune donnée d'une autre école, y compris pour le
 * super-administrateur, qui reste sur l'école active de sa session.
 *
 * Les listes (classes, élèves, matières) servent à reconnaître les noms écrits
 * dans la question ; elles sont gardées 60 s en mémoire par personne, pour que
 * les questions suivantes répondent sans relire la base.
 */
import prisma from "@/lib/prisma";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { taughtClassIds } from "@/lib/teachers/taught-classes";
import { DIRECTION } from "./intents";
import type { AssistantUser, NamedRef, StudentRef } from "./types";

export interface AssistantScope {
    user: AssistantUser;
    schoolId: string;
    kind: "direction" | "teacher" | "family";
    classes: NamedRef[];
    students: StudentRef[];
    subjects: Array<NamedRef & { code: string }>;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; scope: AssistantScope }>();

export function clearScopeCache(): void {
    cache.clear();
}

function scopeKind(role: string): AssistantScope["kind"] | null {
    if (roleSatisfies(role, DIRECTION)) return "direction";
    if (role === "TEACHER") return "teacher";
    if (role === "PARENT" || role === "STUDENT") return "family";
    return null;
}

export async function loadScope(user: AssistantUser): Promise<AssistantScope | null> {
    const kind = scopeKind(user.role);
    if (!kind || !user.schoolId) return null;
    const schoolId = user.schoolId;

    const key = `${user.id}:${user.role}:${schoolId}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.scope;

    let classIds: string[] | null = null;
    let studentIds: string[] | null = null;
    if (kind === "teacher") classIds = await taughtClassIds(user.id);
    if (kind === "family") studentIds = (await getOwnStudentIds(user.role, user.id)) ?? [];

    const [classes, enrollments, subjects] = await Promise.all([
        kind === "family"
            ? Promise.resolve([] as NamedRef[])
            : prisma.class.findMany({
                  where: { schoolId, deletedAt: null, ...(classIds ? { id: { in: classIds } } : {}) },
                  select: { id: true, name: true },
                  orderBy: { name: "asc" },
              }),
        prisma.enrollment.findMany({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                class: { schoolId, deletedAt: null, ...(classIds ? { id: { in: classIds } } : {}) },
                ...(studentIds ? { studentId: { in: studentIds } } : {}),
                student: { deletedAt: null },
            },
            select: {
                studentId: true,
                class: { select: { id: true, name: true } },
                student: { select: { user: { select: { firstName: true, lastName: true } } } },
            },
        }),
        prisma.subject.findMany({
            where: { schoolId, deletedAt: null, isActive: true },
            select: { id: true, name: true, code: true },
        }),
    ]);

    const students = new Map<string, StudentRef>();
    const familyClasses = new Map<string, NamedRef>();
    for (const row of enrollments) {
        const name = `${row.student.user.firstName ?? ""} ${row.student.user.lastName ?? ""}`.trim();
        if (!students.has(row.studentId)) {
            students.set(row.studentId, { id: row.studentId, name, className: row.class.name });
        }
        familyClasses.set(row.class.id, { id: row.class.id, name: row.class.name });
    }

    const scope: AssistantScope = {
        user,
        schoolId,
        kind,
        classes: kind === "family" ? Array.from(familyClasses.values()) : classes,
        students: Array.from(students.values()),
        subjects,
    };

    if (cache.size >= MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), scope });
    return scope;
}

/** Vrai si l'élève est dans le périmètre (contrôle refait sur tout identifiant reçu du navigateur). */
export function scopeHasStudent(scope: AssistantScope, studentId: string | undefined): studentId is string {
    return Boolean(studentId && scope.students.some((student) => student.id === studentId));
}

export function scopeHasClass(scope: AssistantScope, classId: string | undefined): classId is string {
    return Boolean(classId && scope.classes.some((item) => item.id === classId));
}
