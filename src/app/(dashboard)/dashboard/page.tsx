import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
    getAdminDashboardData,
    getGlobalDashboardData,
    getTeacherDashboardData,
    getStudentDashboardData,
    getParentDashboardData,
} from "@/lib/services/analytics-dashboard";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import {
    DirectorHome,
    TeacherHome,
    ParentHome,
    StudentHome,
    SuperAdminHome,
} from "@/components/edu-homes";
import { PageShell } from "@/components/layout/page-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const cookieStore = await cookies();
    const role = session.user.role;
    const userName = session.user.name ?? session.user.email ?? "Utilisateur";
    const schoolId = getActiveSchoolId(session) ?? null;
    const requestedYearId = cookieStore.get("edupilot_year_id")?.value;

    const isSuperAdminGlobal = role === "SUPER_ADMIN" && !schoolId;

    if (isSuperAdminGlobal) {
        const data = await getGlobalDashboardData();
        return (
            <PageShell>
                <SuperAdminHome userName={userName} data={data} />
            </PageShell>
        );
    }

    if (!schoolId) {
        return (
            <PageShell>
                <NoSchoolFallback />
            </PageShell>
        );
    }

    const yearId = await resolveYearId(schoolId, requestedYearId);
    if (!yearId) {
        return (
            <PageShell>
                <NoYearFallback />
            </PageShell>
        );
    }

    const now = new Date();
    const [school, period] = await Promise.all([
        prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true },
        }),
        prisma.period
            .findFirst({
                where: {
                    academicYearId: yearId,
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                select: { name: true },
                orderBy: { sequence: "asc" },
            })
            .then(async (p) =>
                p ??
                (await prisma.period.findFirst({
                    where: { academicYearId: yearId },
                    select: { name: true },
                    orderBy: { sequence: "desc" },
                }))
            ),
    ]);
    const schoolName = school?.name ?? null;
    const periodName = period?.name ?? null;

    let payload:
        | { kind: "director"; data: Awaited<ReturnType<typeof getAdminDashboardData>> }
        | { kind: "teacher"; data: Awaited<ReturnType<typeof getTeacherDashboardData>> }
        | { kind: "student"; data: Awaited<ReturnType<typeof getStudentDashboardData>> }
        | { kind: "parent"; data: Awaited<ReturnType<typeof getParentDashboardData>> }
        | null = null;

    try {
        if (role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN" || role === "DIRECTOR") {
            payload = { kind: "director", data: await getAdminDashboardData(schoolId, yearId) };
        } else if (role === "TEACHER") {
            payload = {
                kind: "teacher",
                data: await getTeacherDashboardData(session.user.id, schoolId, yearId),
            };
        } else if (role === "STUDENT") {
            payload = {
                kind: "student",
                data: await getStudentDashboardData(session.user.id, yearId),
            };
        } else if (role === "PARENT") {
            payload = {
                kind: "parent",
                data: await getParentDashboardData(session.user.id, yearId),
            };
        } else {
            // ACCOUNTANT, STAFF — vue Director par défaut (besoin des KPIs établissement).
            payload = { kind: "director", data: await getAdminDashboardData(schoolId, yearId) };
        }
    } catch (error) {
        console.error("Dashboard data fetch error:", error);
        return (
            <PageShell>
                <DashboardErrorFallback />
            </PageShell>
        );
    }

    const homeProps = { userName, schoolName, periodName };
    switch (payload.kind) {
        case "teacher":
            return (
                <PageShell>
                    <TeacherHome {...homeProps} data={payload.data} />
                </PageShell>
            );
        case "student":
            return (
                <PageShell>
                    <StudentHome {...homeProps} data={payload.data} />
                </PageShell>
            );
        case "parent":
            return (
                <PageShell>
                    <ParentHome {...homeProps} data={payload.data} />
                </PageShell>
            );
        case "director":
        default:
            return (
                <PageShell>
                    <DirectorHome {...homeProps} data={payload.data} />
                </PageShell>
            );
    }
}

async function resolveYearId(schoolId: string, requestedYearId: string | undefined): Promise<string | null> {
    if (requestedYearId) return requestedYearId;
    const currentYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
    });
    return currentYear?.id ?? null;
}

function NoSchoolFallback() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="max-w-md space-y-3 text-center">
                <p
                    style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--eduflow-text-secondary)",
                    }}
                >
                    Aucun établissement n&apos;est associé à ton compte.
                </p>
                <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                    Contacte un administrateur pour rattacher ton compte à un établissement.
                </p>
            </div>
        </div>
    );
}

function NoYearFallback() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="max-w-md space-y-3 text-center">
                <p
                    style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--eduflow-text-secondary)",
                    }}
                >
                    Aucune année académique active n&apos;a été trouvée.
                </p>
                <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                    Active une année académique dans les paramètres pour afficher le tableau de bord.
                </p>
                <a
                    href="/dashboard/settings/academic"
                    className="mt-4 inline-flex items-center rounded-md px-4 py-2"
                    style={{
                        background: "var(--brand-700)",
                        color: "var(--eduflow-text-on-brand)",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                    }}
                >
                    Ouvrir les paramètres académiques
                </a>
            </div>
        </div>
    );
}

function DashboardErrorFallback() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="max-w-md space-y-3 text-center">
                <p style={{ fontSize: 14, fontWeight: 600 }}>
                    Impossible de charger le tableau de bord.
                </p>
                <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                    Vérifie ta connexion et réessaie. Si le problème persiste, contacte
                    l&apos;administrateur.
                </p>
                <a
                    href="/dashboard"
                    className="mt-4 inline-flex items-center rounded-md px-4 py-2"
                    style={{
                        background: "var(--brand-700)",
                        color: "var(--eduflow-text-on-brand)",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                    }}
                >
                    Réessayer
                </a>
            </div>
        </div>
    );
}
