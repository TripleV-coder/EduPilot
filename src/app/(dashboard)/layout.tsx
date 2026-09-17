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
import { ConsentScreen } from "@/components/compliance/consent-screen";
import { getPendingConsent } from "@/lib/security/consent";
import { runWithDbContext } from "@/lib/db/db-context";
import { dbContextForSession } from "@/lib/db/session-db-context";

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

    // Consentement (Lot 6) : conditions et politique de confidentialité
    // acceptées à la première connexion et à chaque nouvelle version ; un
    // parent répond en même temps pour chacun de ses enfants rattachés.
    if (session?.user) {
        // Contexte d'établissement obligatoire (M2) : les enfants rattachés
        // passent par `student_profiles`, table fermée par la sécurité par
        // ligne. Sans contexte, Prisma échouait sur la relation masquée (500).
        const pending = await runWithDbContext(dbContextForSession(session), () =>
            getPendingConsent(session.user.id),
        );
        if (pending.needsTerms || pending.children.some((c) => c.granted === null)) {
            return <ConsentScreen pending={pending} />;
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
