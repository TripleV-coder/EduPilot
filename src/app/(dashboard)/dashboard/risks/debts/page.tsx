import { PageGuard } from "@/components/guard/page-guard";
import { DebtRiskBoard } from "@/components/dashboard/risks/debt-risk-board";
import { PageShell } from "@/components/layout/page-shell";
import { Permission } from "@/lib/rbac/permissions";

export default function DebtRiskPage() {
    return (
        <PageGuard permission={[Permission.FINANCE_READ, Permission.PAYMENT_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <PageShell className="pb-12">
                <DebtRiskBoard />
            </PageShell>
        </PageGuard>
    );
}
