import { SkipToContent } from "@/components/a11y/skip-to-content";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardLayoutClient } from "@/components/dashboard/DashboardLayoutClient";
import { EduSidebar } from "@/components/edu-shell/EduSidebar";
import { EduTopBar } from "@/components/edu-shell/EduTopBar";
import { CommandPaletteProvider } from "@/components/edu-shell/CommandPaletteProvider";
import { EduMobileNav } from "@/components/edu-shell/EduMobileNav";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <CommandPaletteProvider>
            <DashboardLayoutClient
                sidebar={
                    <>
                        <SkipToContent />
                        <EduSidebar />
                    </>
                }
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
