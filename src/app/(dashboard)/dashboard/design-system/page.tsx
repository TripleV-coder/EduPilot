import type { Metadata } from "next";
import { DesignSystemShowcase } from "./showcase";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
    title: "Design System v2 · 2026",
    description:
        "EduPilot — système de design Sky → Indigo. Tokens, fondations, composants Edu.",
};

export default function DesignSystemPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <PageShell className="max-w-6xl">
                <PageHeader
                    title="Design System v2 · 2026"
                    description="EduPilot — système de design Sky → Indigo. Tokens, fondations, composants Edu."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Design System" },
                    ]}
                />
                <DesignSystemShowcase />
            </PageShell>
        </PageGuard>
    );
}
