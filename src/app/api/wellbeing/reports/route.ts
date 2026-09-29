import { NextResponse } from "next/server";
import { z } from "zod";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { ANONYMOUS_SUBMISSION_HEADER, createApiHandler } from "@/lib/api/api-helpers";
import { allowedWellbeingTags, WELLBEING_DESK_ROLES } from "@/lib/wellbeing/report-tags";
import { roleSatisfies } from "@/lib/rbac/permissions";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

/**
 * GET /api/wellbeing/reports — liste des dossiers de signalement.
 * Filtres : ?status=OPEN|IN_REVIEW|IN_FOLLOWUP|CLOSED, ?severity=P0|P1|P2.
 */
export const GET = createApiHandler(
    async (request, { session }) => {
        try {
            const url = new URL(request.url);
            const requestedSchoolId = url.searchParams.get("schoolId");
            const accessError = ensureRequestedSchoolAccess(session, requestedSchoolId);
            if (accessError) return accessError;

            const schoolId = requestedSchoolId ?? getActiveSchoolId(session);
            if (!schoolId) {
                return NextResponse.json(
                    { error: "Aucun établissement actif associé au compte." },
                    { status: 400 }
                );
            }

            const status = url.searchParams.get("status");
            const severity = url.searchParams.get("severity");

            const where: Record<string, unknown> = { schoolId };
            if (status && ["OPEN", "IN_REVIEW", "IN_FOLLOWUP", "CLOSED"].includes(status)) {
                where.status = status;
            }
            if (severity && ["P0", "P1", "P2"].includes(severity)) {
                where.severity = severity;
            }

            const reports = await prisma.wellbeingReport.findMany({
                where,
                orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
                take: 100,
            });

            return NextResponse.json({
                schoolId,
                reports: reports.map((r) => ({
                    id: r.id,
                    tag: r.tag,
                    category: r.category,
                    excerpt: r.excerpt,
                    severity: r.severity,
                    severityLabel: r.severityLabel,
                    status: r.status,
                    createdAt: r.createdAt.toISOString(),
                })),
            });
        } catch (error) {
            logger.error("Error listing wellbeing reports", error as Error);
            return NextResponse.json({ error: "Erreur lors de la lecture des dossiers" }, { status: 500 });
        }
    },
    { allowedRoles: [...ALLOWED_ROLES] },
);

const SEVERITY_LABELS: Record<string, string> = {
    P0: "P0 · CPS prévenu",
    P1: "P1 · Suivi rapproché",
    P2: "P2 · Veille",
};

const createReportSchema = z.object({
    tag: z.enum(["ANONYME", "PARENT", "ENSEIGNANT", "NOMINATIF"]),
    category: z.string().min(2).max(80),
    excerpt: z.string().min(10).max(500),
    severity: z.enum(["P0", "P1", "P2"]),
    /** Élève concerné (optionnel — jamais pour un signalement anonyme) */
    reportedUserId: z.string().cuid().optional(),
});

/**
 * POST /api/wellbeing/reports — déposer un signalement (P2.5).
 * La cellule d'écoute (direction) lit et traite les dossiers ; élèves,
 * parents et personnel peuvent en déposer (avant : seule la direction pouvait
 * saisir, la cellule ne recevait donc rien directement). Chaque rôle n'a que
 * les étiquettes qui le concernent ; un dépôt anonyme ne garde aucun lien
 * avec son auteur.
 */
export const POST = createApiHandler(
    async (request, { session }) => {
        try {
            // Un dossier appartient toujours à une école : super-admin compris,
            // sans école active la création échouait en 500 (schoolId nul).
            const schoolId = getActiveSchoolId(session);
            if (!schoolId) {
                return NextResponse.json(
                    { error: "Aucun établissement actif associé au compte." },
                    { status: 400 }
                );
            }

            const body = await request.json();
            const data = createReportSchema.parse(body);

            if (!allowedWellbeingTags(session.user.role).includes(data.tag)) {
                return NextResponse.json({ error: "Type de signalement non autorisé pour votre profil." }, { status: 403 });
            }
            const isDesk = roleSatisfies(session.user.role, [...WELLBEING_DESK_ROLES]);

            if (data.tag === "ANONYME" && data.reportedUserId) {
                return NextResponse.json(
                    { error: "Un signalement anonyme ne peut pas désigner nominativement un élève." },
                    { status: 400 }
                );
            }

            // L'élève désigné doit appartenir à l'école (anti cross-tenant)
            if (data.reportedUserId) {
                const reported = await prisma.user.findFirst({
                    where: { id: data.reportedUserId, schoolId },
                    select: { id: true },
                });
                if (!reported) {
                    return NextResponse.json({ error: "Élève concerné introuvable" }, { status: 404 });
                }
            }

            const report = await prisma.wellbeingReport.create({
                data: {
                    schoolId,
                    tag: data.tag,
                    category: data.category,
                    excerpt: data.excerpt,
                    severity: data.severity,
                    severityLabel: SEVERITY_LABELS[data.severity],
                    status: "OPEN",
                    // La source n'est tracée que pour les signalements non anonymes
                    reporterUserId: data.tag === "ANONYME" ? null : session.user.id,
                    reportedUserId: data.reportedUserId ?? null,
                },
            });

            // Dépôt anonyme par un élève, un parent ou un membre du personnel :
            // pas de ligne d'audit (userId obligatoire), sinon la direction — qui
            // lit le journal — retrouverait l'auteur.
            if (isDesk || data.tag !== "ANONYME") {
                await prisma.auditLog.create({
                    data: {
                        userId: session.user.id,
                        action: "CREATE_WELLBEING_REPORT",
                        entity: "WellbeingReport",
                        entityId: report.id,
                        // La purge de conservation s'appuie sur l'école du journal.
                        schoolId,
                    },
                });
            }

            // Hors cellule : accusé de réception seulement (le dossier ne lui est pas lisible).
            const response = NextResponse.json(isDesk ? report : { id: report.id, status: report.status }, { status: 201 });
            if (!isDesk && data.tag === "ANONYME") response.headers.set(ANONYMOUS_SUBMISSION_HEADER, "1");
            return response;
        } catch (error) {
            if (isZodError(error)) {
                return NextResponse.json(
                    { error: "Données invalides", details: error.issues },
                    { status: 400 }
                );
            }
            logger.error("Error creating wellbeing report", error as Error);
            return NextResponse.json({ error: "Erreur lors de la création du dossier" }, { status: 500 });
        }
    },
    { allowedRoles: [...ALLOWED_ROLES, "TEACHER", "STAFF", "PARENT", "STUDENT"] },
);
