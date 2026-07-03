import { PageGuard } from "@/components/guard/page-guard";
import { StudentRiskBoard } from "@/components/dashboard/risks/student-risk-board";
import { PageShell } from "@/components/layout/page-shell";
import { Permission } from "@/lib/rbac/permissions";

export default function DropoutRiskPage() {
    return (
        <PageGuard permission={Permission.ANALYTICS_VIEW} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <PageShell className="pb-12">
                <StudentRiskBoard
                    mode="dropout"
                    title="Décrochage"
                    description="Surveillez les signaux d'absentéisme, de rupture d'engagement et d'incidents qui précèdent le décrochage."
                    breadcrumbLabel="Décrochage"
                />
            </PageShell>
        </PageGuard>
    );
}
