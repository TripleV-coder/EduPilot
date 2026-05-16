import { SkipToContent } from "@/components/a11y/skip-to-content";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardLayoutClient } from "@/components/dashboard/DashboardLayoutClient";
import { EduSidebar } from "@/components/edu-shell/EduSidebar";
import { EduTopBar } from "@/components/edu-shell/EduTopBar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
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
        </DashboardLayoutClient>
    );
}
