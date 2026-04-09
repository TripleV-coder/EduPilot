"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { DebtRiskBoard } from "@/components/dashboard/risks/debt-risk-board";
import { Permission } from "@/lib/rbac/permissions";

export default function DebtRiskPage() {
    return (
        <PageGuard permission={[Permission.FINANCE_READ, Permission.PAYMENT_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <DebtRiskBoard />
        </PageGuard>
    );
}
