import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { SkipToContent } from "@/components/a11y/skip-to-content";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardLayoutClient } from "@/components/dashboard/DashboardLayoutClient";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardLayoutClient
            sidebar={<><SkipToContent /><Sidebar /></>}
            header={<Header />}
        >
            <ErrorBoundary name="DashboardLayout">
                {children}
            </ErrorBoundary>
        </DashboardLayoutClient>
    );
}
