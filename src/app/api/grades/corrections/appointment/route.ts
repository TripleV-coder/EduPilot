/**
 * Réclamation de note, côté famille : un seul bouton qui prend rendez-vous
 * avec l'enseignant de la matière (la copie est ensuite revue en personne,
 * puis l'enseignant propose la correction et le directeur des études la valide).
 * L'enseignant et le parent sont déterminés par le serveur : l'élève ou le
 * parent ne choisit que le créneau.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getOwnStudentIds } from "@/lib/auth/family-scope";

const schema = z.object({
    evaluationId: z.string().min(1),
    studentId: z.string().min(1),
    scheduledAt: z.string().datetime(),
});

export const POST = createApiHandler(
    async (request, { session }) => {
        const parsed = schema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: "Choisissez une date et une heure de rendez-vous." }, { status: 400 });
        const { evaluationId, studentId, scheduledAt } = parsed.data;

        // Uniquement pour soi-même (élève) ou ses enfants (parent)
        const own = await getOwnStudentIds(session.user.role, session.user.id);
        if (!own || !own.includes(studentId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        const when = new Date(scheduledAt);
        if (when.getTime() <= Date.now()) {
            return NextResponse.json({ error: "Le rendez-vous doit être dans le futur." }, { status: 400 });
        }

        const grade = await prisma.grade.findUnique({
            where: { evaluationId_studentId: { evaluationId, studentId } },
            select: {
                deletedAt: true,
                evaluation: {
                    select: {
                        title: true,
                        date: true,
                        type: { select: { name: true } },
                        classSubject: { select: { teacherId: true, subject: { select: { name: true } } } },
                    },
                },
            },
        });
        if (!grade || grade.deletedAt) return NextResponse.json({ error: "Note introuvable" }, { status: 404 });
        const teacherId = grade.evaluation.classSubject.teacherId;
        if (!teacherId) {
            return NextResponse.json(
                { error: "Aucun enseignant n'est affecté à cette matière : adressez la réclamation à l'administration." },
                { status: 400 },
            );
        }

        // Parent : le sien ; élève : le parent lié (le rendez-vous associe la famille)
        const parent =
            session.user.role === "PARENT"
                ? await prisma.parentProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } })
                : await prisma.parentProfile.findFirst({
                      where: { parentStudents: { some: { studentId } } },
                      select: { id: true },
                  });
        if (!parent) {
            return NextResponse.json(
                { error: "Aucun parent n'est rattaché à ce compte : la réclamation se fait auprès de l'administration." },
                { status: 400 },
            );
        }

        const busy = await prisma.appointment.findFirst({
            where: {
                teacherId,
                scheduledAt: { gt: new Date(when.getTime() - 30 * 60000), lt: new Date(when.getTime() + 30 * 60000) },
                status: { in: ["PENDING", "CONFIRMED"] },
            },
            select: { id: true },
        });
        if (busy) return NextResponse.json({ error: "L'enseignant a déjà un rendez-vous à ce créneau." }, { status: 409 });

        const label = grade.evaluation.title || grade.evaluation.type.name;
        const appointment = await prisma.appointment.create({
            data: {
                teacherId,
                parentId: parent.id,
                studentId,
                scheduledAt: when,
                duration: 30,
                type: "IN_PERSON",
                notes: `Réclamation de note : ${grade.evaluation.classSubject.subject.name} — ${label} du ${grade.evaluation.date.toLocaleDateString("fr-FR")}. Apporter la copie.`,
                createdById: session.user.id,
            },
            select: { id: true, scheduledAt: true, status: true },
        });
        return NextResponse.json(appointment, { status: 201 });
    },
    { allowedRoles: ["STUDENT", "PARENT"] },
);
