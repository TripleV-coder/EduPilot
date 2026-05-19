import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

type Variant = "success" | "warning" | "danger" | "info" | "neutral";

type LiaisonEntry = {
    id: string;
    source: "incident" | "absence" | "announcement" | "appointment";
    from: string;
    role: string;
    date: string;
    title: string;
    body: string;
    tagLabel: string;
    tagVariant: Variant;
    signed: boolean;
    requiresSignature: boolean;
    actionLabel?: string;
};

const SIGNATURE_DEADLINE_DAYS = 14;

function fromIncidentSeverity(severity: string): {
    label: string;
    variant: Variant;
} {
    if (severity === "LOW")
        return { label: "Félicitations", variant: "success" };
    if (severity === "HIGH" || severity === "CRITICAL")
        return { label: "Sanction", variant: "danger" };
    return { label: "Vigilance", variant: "warning" };
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentIdParam = searchParams.get("studentId");

        // Resolve the student we view
        let studentId: string | null = studentIdParam;
        if (!studentId) {
            if (session.user.role === "STUDENT") {
                const p = await prisma.studentProfile.findFirst({
                    where: { userId: session.user.id },
                });
                studentId = p?.id ?? null;
            } else if (session.user.role === "PARENT") {
                const parent = await prisma.parentProfile.findUnique({
                    where: { userId: session.user.id },
                    include: {
                        parentStudents: {
                            include: { student: true },
                            take: 1,
                        },
                    },
                });
                studentId = parent?.parentStudents[0]?.student.id ?? null;
            }
        }
        if (!studentId) {
            return NextResponse.json(
                { error: "Aucun élève sélectionné" },
                { status: 400 }
            );
        }

        // Access check
        const student = await prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: {
                user: { select: { firstName: true, lastName: true } },
                enrollments: {
                    where: { status: "ACTIVE" },
                    include: { class: true },
                    take: 1,
                },
            },
        });
        if (!student) {
            return NextResponse.json(
                { error: "Élève introuvable" },
                { status: 404 }
            );
        }
        if (
            session.user.role !== "SUPER_ADMIN" &&
            student.schoolId !== getActiveSchoolId(session)
        ) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        if (session.user.role === "PARENT") {
            const parentProfile = await prisma.parentProfile.findUnique({
                where: { userId: session.user.id },
            });
            if (!parentProfile) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
            const ok = await prisma.parentStudent.findUnique({
                where: {
                    parentId_studentId: {
                        parentId: parentProfile.id,
                        studentId: student.id,
                    },
                },
            });
            if (!ok)
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        if (session.user.role === "STUDENT" && student.userId !== session.user.id) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        // Window: last 90 days
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 90);

        const enrollment = student.enrollments[0];

        // Pull data in parallel
        const [incidents, unjustifiedAbsences, announcements, appointments] =
            await Promise.all([
                prisma.behaviorIncident.findMany({
                    where: {
                        studentId: student.id,
                        date: { gte: sinceDate },
                    },
                    include: {
                        reportedBy: {
                            select: { firstName: true, lastName: true, role: true },
                        },
                    },
                    orderBy: { date: "desc" },
                    take: 30,
                }),
                prisma.attendance.findMany({
                    where: {
                        studentId: student.id,
                        date: { gte: sinceDate },
                        status: "ABSENT",
                        OR: [{ reason: null }, { reason: "" }],
                    },
                    include: {
                        recordedBy: {
                            select: { firstName: true, lastName: true, role: true },
                        },
                    },
                    orderBy: { date: "desc" },
                    take: 10,
                }),
                enrollment
                    ? prisma.announcement.findMany({
                          where: {
                              schoolId: student.schoolId,
                              createdAt: { gte: sinceDate },
                          },
                          include: {
                              author: {
                                  select: { firstName: true, lastName: true, role: true },
                              },
                          },
                          orderBy: { createdAt: "desc" },
                          take: 8,
                      })
                    : Promise.resolve([]),
                prisma.appointment.findMany({
                    where: {
                        studentId: student.id,
                        scheduledAt: { gte: sinceDate },
                    },
                    include: {
                        teacher: {
                            include: {
                                user: {
                                    select: { firstName: true, lastName: true },
                                },
                            },
                        },
                    },
                    orderBy: { scheduledAt: "desc" },
                    take: 10,
                }),
            ]);

        const entries: LiaisonEntry[] = [];

        for (const inc of incidents) {
            const tag = fromIncidentSeverity(inc.severity);
            entries.push({
                id: `inc-${inc.id}`,
                source: "incident",
                from: inc.reportedBy
                    ? `${inc.reportedBy.firstName} ${inc.reportedBy.lastName}`
                    : "Vie scolaire",
                role: inc.reportedBy?.role
                    ? roleLabel(inc.reportedBy.role)
                    : "Vie scolaire",
                date: inc.date.toISOString(),
                title:
                    tag.variant === "danger"
                        ? `Sanction : ${inc.incidentType.toLowerCase().replace(/_/g, " ")}`
                        : `Note · ${inc.incidentType.toLowerCase().replace(/_/g, " ")}`,
                body:
                    inc.description ||
                    inc.actionTaken ||
                    "Détails consignés au registre de discipline.",
                tagLabel: tag.label,
                tagVariant: tag.variant,
                signed: inc.isResolved,
                requiresSignature: !inc.isResolved && tag.variant !== "success",
                actionLabel:
                    !inc.isResolved && tag.variant !== "success" ? "Accuser réception" : undefined,
            });
        }

        for (const att of unjustifiedAbsences) {
            entries.push({
                id: `abs-${att.id}`,
                source: "absence",
                from: att.recordedBy
                    ? `${att.recordedBy.firstName} ${att.recordedBy.lastName}`
                    : "Vie scolaire",
                role: att.recordedBy?.role
                    ? roleLabel(att.recordedBy.role)
                    : "Vie scolaire",
                date: att.date.toISOString(),
                title: `Justification d'absence — ${formatShortDate(att.date)}`,
                body:
                    "L'élève n'était pas en classe. Pouvez-vous indiquer le motif ? (Médecin, événement familial, autre…)",
                tagLabel: "À signer",
                tagVariant: "warning",
                signed: false,
                requiresSignature: true,
                actionLabel: "Justifier",
            });
        }

        for (const ann of announcements) {
            entries.push({
                id: `ann-${ann.id}`,
                source: "announcement",
                from: ann.author
                    ? `${ann.author.firstName} ${ann.author.lastName}`
                    : "Direction",
                role: ann.author?.role ? roleLabel(ann.author.role) : "Direction",
                date: ann.createdAt.toISOString(),
                title: ann.title,
                body: ann.content.length > 280 ? ann.content.slice(0, 280) + "…" : ann.content,
                tagLabel: "Information",
                tagVariant: "info",
                signed: true,
                requiresSignature: false,
            });
        }

        for (const apt of appointments) {
            entries.push({
                id: `apt-${apt.id}`,
                source: "appointment",
                from: apt.teacher
                    ? `${apt.teacher.user.firstName} ${apt.teacher.user.lastName}`
                    : "Enseignant",
                role: "Rendez-vous",
                date: apt.scheduledAt.toISOString(),
                title: `RDV ${
                    apt.type === "VIDEO_CALL"
                        ? "visio"
                        : apt.type === "PHONE_CALL"
                        ? "téléphone"
                        : "présentiel"
                }${apt.location ? " · " + apt.location : ""}`,
                body: apt.notes || "Rendez-vous programmé · merci de confirmer la présence.",
                tagLabel: apt.status === "CONFIRMED" ? "Confirmé" : "À confirmer",
                tagVariant: apt.status === "CONFIRMED" ? "success" : "warning",
                signed: apt.status === "CONFIRMED",
                requiresSignature: apt.status === "PENDING",
                actionLabel: apt.status === "PENDING" ? "Confirmer" : undefined,
            });
        }

        // Sort by date desc
        entries.sort((a, b) => (b.date < a.date ? -1 : 1));

        // Recap of the last 30 days
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const recent = entries.filter((e) => new Date(e.date) >= since30);
        const recap = {
            felicitations: recent.filter((e) => e.tagVariant === "success").length,
            vigilances: recent.filter((e) => e.tagVariant === "warning").length,
            documents: recent.filter((e) => e.source === "announcement").length,
            sanctions: recent.filter((e) => e.tagVariant === "danger").length,
        };

        const toSignCount = entries.filter((e) => e.requiresSignature).length;

        // Recipients for compose box (teachers of the active enrollment)
        const recipients = enrollment
            ? await prisma.classSubject.findMany({
                  where: { classId: enrollment.classId },
                  include: {
                      teacher: {
                          include: {
                              user: { select: { firstName: true, lastName: true } },
                          },
                      },
                      subject: { select: { name: true } },
                  },
              })
            : [];

        const recipientList = Array.from(
            new Map(
                recipients
                    .filter((cs) => cs.teacher)
                    .map((cs) => [
                        cs.teacher!.id,
                        {
                            id: cs.teacher!.id,
                            label: `M./Mme ${cs.teacher!.user.firstName} ${cs.teacher!.user.lastName} (${cs.subject.name})`,
                        },
                    ])
            ).values()
        );

        return NextResponse.json({
            student: {
                id: student.id,
                firstName: student.user.firstName,
                lastName: student.user.lastName,
            },
            class: enrollment
                ? { id: enrollment.class.id, name: enrollment.class.name }
                : null,
            entries,
            toSignCount,
            signatureWindowDays: SIGNATURE_DEADLINE_DAYS,
            recap,
            recipients: recipientList,
        });
    } catch (error) {
        logger.error("liaison:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors du chargement du cahier de liaison" },
            { status: 500 }
        );
    }
}

function roleLabel(role: string): string {
    switch (role) {
        case "TEACHER":
            return "Enseignant";
        case "DIRECTOR":
            return "Direction";
        case "SCHOOL_ADMIN":
            return "Direction";
        case "PARENT":
            return "Parent";
        case "STUDENT":
            return "Élève";
        case "STAFF":
            return "Vie scolaire";
        default:
            return role;
    }
}

function formatShortDate(d: Date): string {
    try {
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" });
    } catch {
        return d.toISOString().slice(0, 10);
    }
}
