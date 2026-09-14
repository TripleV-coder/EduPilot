import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auditLog } from "./audit-log";

/**
 * RGPD/GDPR Utilities
 * Implements:
 * - Right to access (data export complet — Article 15 & 20 RGPD)
 * - Right to erasure (anonymisation + suppression des données personnelles — Article 17 RGPD)
 * - Data retention enforcement (Article 5(1)(e) RGPD)
 */

// ---------------------------------------------------------------------------
// EXPORT DE DONNÉES (Article 15 & 20 RGPD)
// Retourne les vraies données, pas des counts — conformité portabilité
// ---------------------------------------------------------------------------

type UserExport = Prisma.UserGetPayload<{
    include: {
        studentProfile: {
            include: {
                grades: {
                    include: {
                        evaluation: { select: { title: true, date: true, maxGrade: true } };
                    };
                };
                payments: {
                    select: { id: true; amount: true; method: true; status: true; createdAt: true };
                };
                enrollments: {
                    include: {
                        class: { select: { name: true } };
                        academicYear: { select: { name: true } };
                    };
                };
                attendances: {
                    select: { date: true; status: true; reason: true };
                };
            };
        };
        teacherProfile: {
            select: { matricule: true; specialization: true; hireDate: true };
        };
        parentProfile: {
            select: { profession: true };
        };
        notifications: {
            select: { type: true; title: true; message: true; isRead: true; createdAt: true };
        };
        auditLogs: {
            select: { action: true; entity: true; createdAt: true };
        };
        userAchievements: {
            include: { achievement: { select: { name: true; description: true } } };
        };
        mealTickets: {
            select: { purchasedAt: true; usedAt: true; isUsed: true; balance: true; expiresAt: true };
        };
        messagesSent: {
            select: { subject: true; content: true; createdAt: true };
        };
        messagesReceived: {
            select: { subject: true; content: true; createdAt: true; isRead: true };
        };
        attendancesRecorded: {
            select: { date: true; status: true };
        };
    };
}>;

export async function exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            studentProfile: {
                include: {
                    grades: {
                        include: {
                            evaluation: { select: { title: true, date: true, maxGrade: true } },
                        },
                        take: 500,
                    },
                    payments: {
                        select: { id: true, amount: true, method: true, status: true, createdAt: true },
                        take: 200,
                    },
                    enrollments: {
                        include: {
                            class: { select: { name: true } },
                            academicYear: { select: { name: true } },
                        },
                        take: 20,
                    },
                    attendances: {
                        select: { date: true, status: true, reason: true },
                        take: 500,
                    },
                },
            },
            teacherProfile: {
                select: { matricule: true, specialization: true, hireDate: true },
            },
            parentProfile: {
                select: { profession: true },
            },
            notifications: {
                select: { type: true, title: true, message: true, isRead: true, createdAt: true },
                take: 200,
            },
            auditLogs: {
                select: { action: true, entity: true, createdAt: true },
                take: 200,
            },
            userAchievements: {
                include: { achievement: { select: { name: true, description: true } } },
            },
            mealTickets: {
                select: { purchasedAt: true, usedAt: true, isUsed: true, balance: true, expiresAt: true },
                take: 100,
            },
            messagesSent: {
                select: { subject: true, content: true, createdAt: true },
                take: 200,
            },
            messagesReceived: {
                select: { subject: true, content: true, createdAt: true, isRead: true },
                take: 200,
            },
            attendancesRecorded: {
                select: { date: true, status: true },
                take: 500,
            },
        },
    }) as UserExport | null;

    if (!user) throw new Error("User not found");

    const exportData = {
        exportedAt: new Date().toISOString(),
        personalInfo: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        },
        profiles: {
            student: user.studentProfile
                ? {
                    enrollments: user.studentProfile.enrollments,
                    attendances: user.studentProfile.attendances,
                }
                : null,
            teacher: user.teacherProfile,
            parent: user.parentProfile,
        },
        grades: user.studentProfile?.grades?.map((g) => ({
            value: g.value,
            maxGrade: g.evaluation?.maxGrade,
            evaluation: g.evaluation?.title,
            date: g.evaluation?.date ?? g.createdAt,
        })) ?? [],
        payments: user.studentProfile?.payments?.map((p) => ({
            amount: p.amount,
            method: p.method,
            status: p.status,
            date: p.createdAt,
        })) ?? [],
        notifications: user.notifications,
        messages: {
            sent: user.messagesSent,
            received: user.messagesReceived,
        },
        achievements: user.userAchievements.map((ua) => ({
            name: ua.achievement.name,
            description: ua.achievement.description,
            unlockedAt: ua.unlockedAt,
        })),
        canteenTickets: user.mealTickets,
        auditLogs: user.auditLogs,
    };

    await auditLog.dataAccess(userId, "USER", userId);

    return exportData;
}

// ---------------------------------------------------------------------------
// ANONYMISATION (Article 17 RGPD — droit à l'effacement)
// Remplace toutes les PII par des valeurs neutres et supprime les données
// sensibles liées à la personne (grades, paiements, messages, notifications).
// ---------------------------------------------------------------------------

/** Marqueurs d'un compte anonymisé (reconnus par la purge de conservation, lib/security/retention). */
export const ANONYMIZED_FIRST_NAME = "Utilisateur";
export const ANONYMIZED_LAST_NAME = "Supprimé";

/**
 * @param requestedBy auteur de la demande ; absent pour la purge de conservation (tâche système).
 * @param reason REQUEST (demande de la personne ou de l'école) ou RETENTION (durée de conservation écoulée).
 */
export async function anonymizeUser(userId: string, requestedBy?: string, reason: "REQUEST" | "RETENTION" = "REQUEST") {
    const anonymizedEmail = `deleted_${userId.slice(0, 8)}@anonymized.local`;

    // 1. Récupérer le profil étudiant pour les suppressions liées
    const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
        // 2. Anonymiser l'utilisateur — effacer toutes les PII
        await tx.user.update({
            where: { id: userId },
            data: {
                email: anonymizedEmail,
                firstName: ANONYMIZED_FIRST_NAME,
                lastName: ANONYMIZED_LAST_NAME,
                phone: null,
                avatar: null,
                isActive: false,
                isTwoFactorEnabled: false,
                twoFactorSecret: null,
                twoFactorBackupCodes: [],
                // Mot de passe aléatoire : impossible à utiliser
                password: randomBytes(32).toString("hex"),
            },
        });

        // 3. Anonymiser les profils
        await tx.studentProfile.updateMany({
            where: { userId },
            data: { address: null },
        });
        await tx.teacherProfile.updateMany({
            where: { userId },
            data: { matricule: null, specialization: null },
        });
        await tx.parentProfile.updateMany({
            where: { userId },
            data: { profession: null },
        });

        // 4. Supprimer les notifications personnelles
        await tx.notification.deleteMany({ where: { userId } });

        // 5. Anonymiser les messages (effacer le contenu, pas les threads)
        await tx.message.updateMany({
            where: { senderId: userId },
            data: { subject: "[supprimé]", content: "[contenu supprimé — droit à l'effacement]" },
        });
        await tx.message.updateMany({
            where: { recipientId: userId },
            data: { deletedByRecipient: true },
        });

        // 6. Supprimer les données académiques sensibles si profil étudiant
        if (studentProfile) {
            // Grades
            await tx.grade.deleteMany({ where: { studentId: studentProfile.id } });

            // Examens et Quiz
            await tx.examAnswer.deleteMany({
                where: { examSession: { studentId: studentProfile.id } }
            });
            await tx.examSession.deleteMany({ where: { studentId: studentProfile.id } });

            // LMS
            await tx.lessonCompletion.deleteMany({ where: { studentId: studentProfile.id } });
            await tx.courseEnrollment.deleteMany({ where: { studentId: studentProfile.id } });

            // Orientation
            await tx.studentOrientation.deleteMany({ where: { studentId: studentProfile.id } });

            // Assiduité
            await tx.attendance.updateMany({
                where: { studentId: studentProfile.id },
                data: { reason: "[anonymisé]", justificationDocument: null }
            });

            // Paiements
            await tx.payment.updateMany({
                where: { studentId: studentProfile.id },
                data: { notes: "[anonymisé]", reference: null },
            });

            // Dossier médical
            await tx.medicalRecord.deleteMany({ where: { studentId: studentProfile.id } });

            // Incidents
            await tx.sanction.deleteMany({
                where: { incident: { studentId: studentProfile.id } }
            });
            await tx.behaviorIncident.updateMany({
                where: { studentId: studentProfile.id },
                data: {
                    description: "[anonymisé]",
                    actionTaken: "[supprimé]",
                    followUpNotes: "[supprimé]"
                },
            });

            // Événements
            await tx.eventParticipation.deleteMany({ where: { studentId: studentProfile.id } });
        }
    });

    await auditLog.securityEvent(requestedBy, "USER_ANONYMIZATION", { targetUserId: userId, reason });

    return { success: true, anonymizedEmail };
}

// ---------------------------------------------------------------------------
// STATUT DE RÉTENTION
// ---------------------------------------------------------------------------

export async function getDataRetentionStatus(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, isActive: true },
    });

    if (!user) return null;

    const dataAge = Date.now() - user.createdAt.getTime();
    const yearsOld = dataAge / (365.25 * 24 * 60 * 60 * 1000);

    return {
        accountCreated: user.createdAt,
        dataAgeYears: yearsOld.toFixed(1),
        isActive: user.isActive,
        retentionPolicy: "5 years after account deactivation",
    };
}
