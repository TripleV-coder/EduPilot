import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { 
  getAdminDashboardData, 
  getGlobalDashboardData,
  getTeacherDashboardData,
  getStudentDashboardData,
  getParentDashboardData,
  getAccountantDashboardData,
  getStaffDashboardData,
} from "@/lib/services/analytics-dashboard";
import DashboardOverviewContent from "@/components/dashboard/DashboardOverviewContent";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const role = session.user.role;
  const schoolId = getActiveSchoolId(session) ?? null;
  const academicYearId = (searchParams.academicYearId as string) || cookieStore.get("edupilot_year_id")?.value;
  
  const isSuperAdminGlobal = role === "SUPER_ADMIN" && !schoolId;

  type DashboardAnalytics = 
    | Awaited<ReturnType<typeof getGlobalDashboardData>>
    | Awaited<ReturnType<typeof getAdminDashboardData>>
    | Awaited<ReturnType<typeof getTeacherDashboardData>>
    | Awaited<ReturnType<typeof getStudentDashboardData>>
    | Awaited<ReturnType<typeof getParentDashboardData>>
    | Awaited<ReturnType<typeof getAccountantDashboardData>>
    | Awaited<ReturnType<typeof getStaffDashboardData>>;

  let analyticsData: DashboardAnalytics | null = null;

  try {
    if (isSuperAdminGlobal) {
      analyticsData = await getGlobalDashboardData(
        academicYearId,
        searchParams.classId as string,
        searchParams.periodId as string,
        searchParams.subjectId as string
      );
    } else {
      if (!schoolId) {
        throw new Error("School ID missing for non-global admin");
      }

      // Resolve Year
      let yearId = academicYearId;
      if (!yearId) {
        const currentYear = await prisma.academicYear.findFirst({
          where: { schoolId, isCurrent: true },
          select: { id: true }
        });
        yearId = currentYear?.id;
      }

      if (!yearId) {
        // Aucun millésime académique actif pour cette école :
        // on affiche un message clair avec un lien direct vers la configuration.
        return (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="max-w-md space-y-3 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Aucune année académique active n&apos;a été trouvée pour cet établissement.
              </p>
              <p className="text-xs text-muted-foreground">
                Créez ou activez une année académique dans les paramètres pour afficher le
                tableau de bord consolidé.
              </p>
              <div className="mt-4">
                <a
                  href="/dashboard/settings/academic"
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
                >
                  Ouvrir les paramètres académiques
                </a>
              </div>
            </div>
          </div>
        );
      }

      if (["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(role)) {
        const comparisonSchoolIds =
          Array.isArray(session.user.accessibleSchoolIds) && session.user.accessibleSchoolIds.length > 0
            ? session.user.accessibleSchoolIds
            : await getAccessibleSchoolIdsForUser({
                userId: session.user.id,
                role: session.user.role,
                primarySchoolId: session.user.primarySchoolId ?? schoolId,
              });
        analyticsData = await getAdminDashboardData(
          schoolId,
          yearId,
          searchParams.classId as string,
          searchParams.periodId as string,
          searchParams.subjectId as string,
          comparisonSchoolIds
        );
      } else if (role === "TEACHER") {
        analyticsData = await getTeacherDashboardData(session.user.id, schoolId, yearId);
      } else if (role === "STUDENT") {
        analyticsData = await getStudentDashboardData(session.user.id, yearId);
      } else if (role === "PARENT") {
        analyticsData = await getParentDashboardData(session.user.id, yearId);
      } else if (role === "ACCOUNTANT") {
        analyticsData = await getAccountantDashboardData(schoolId);
      } else if (role === "STAFF") {
        analyticsData = await getStaffDashboardData(schoolId, yearId);
      } else {
        throw new Error(`Unsupported dashboard role: ${role}`);
      }
    }
  } catch (error) {
    console.error("Dashboard data fetch error:", error);
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <p className="text-sm font-semibold">Impossible de charger le tableau de bord</p>
          <p className="text-xs text-muted-foreground">
            Vérifie ta connexion et réessaie. Si le problème persiste, contacte l’administrateur.
          </p>
          <div className="pt-2">
            <a
              href="/dashboard"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
            >
              Réessayer
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardOverviewContent 
      analytics={analyticsData} 
      isSuperAdminGlobal={isSuperAdminGlobal}
      role={role as UserRole}
    />
  );
}
