import { SkipToContent } from "@/components/a11y/skip-to-content";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardLayoutClient } from "@/components/dashboard/DashboardLayoutClient";
import { EduSidebar } from "@/components/edu-shell/EduSidebar";
import { EduTopBar } from "@/components/edu-shell/EduTopBar";
import { CommandPaletteProvider } from "@/components/edu-shell/CommandPaletteProvider";
import { EduMobileNav } from "@/components/edu-shell/EduMobileNav";
import { MaintenanceScreen } from "@/components/system/maintenance-screen";
import { auth } from "@/lib/auth";
import { getMaintenanceState, maintenanceBlocksRole } from "@/lib/system/maintenance";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Mode maintenance globale : les rôles non-SUPER_ADMIN voient l'écran
    // maintenance au lieu du dashboard (état en cache TTL).
    const session = await auth();
    if (maintenanceBlocksRole(session?.user?.role)) {
        const maintenance = await getMaintenanceState();
        if (maintenance.enabled) {
            return <MaintenanceScreen message={maintenance.message} />;
        }
    }

    return (
        <CommandPaletteProvider>
            <SkipToContent />
            <DashboardLayoutClient
                sidebar={<EduSidebar />}
                header={<EduTopBar />}
            >
                <div className="eduflow-scope" style={{ background: "var(--eduflow-surface-page)" }}>
                    <ErrorBoundary name="DashboardLayout">{children}</ErrorBoundary>
                </div>
                <EduMobileNav />
            </DashboardLayoutClient>
        </CommandPaletteProvider>
    );
}
