import { PageGuard } from "@/components/guard/page-guard";
import { StudentRiskBoard } from "@/components/dashboard/risks/student-risk-board";
import { PageShell } from "@/components/layout/page-shell";
import { Permission } from "@/lib/rbac/permissions";

export default function FailureRiskPage() {
    return (
        <PageGuard permission={Permission.ANALYTICS_VIEW} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <PageShell>
                <StudentRiskBoard
                    mode="failure"
                    title="Échec scolaire"
                    description="Isolez les élèves dont la trajectoire académique se dégrade avant la fin de période."
                    breadcrumbLabel="Échec scolaire"
                />
            </PageShell>
        </PageGuard>
    );
}
