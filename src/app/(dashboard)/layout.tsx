import { Sidebar, MobileSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TabBar } from "@/components/layout/tab-bar";
import { TabProvider } from "@/lib/contexts/tab-context";
import { DashboardClientWrapper } from "@/components/layout/dashboard-client-wrapper";
import { SidebarProvider } from "@/lib/hooks/use-sidebar";
import { CommandPalette } from "@/components/ui/command-palette";
import { ChatbotWidget } from "@/components/ai/chatbot-widget";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <TabProvider>
                <div className="flex flex-col h-screen w-full overflow-hidden bg-apogee-abyss">
                    {/* Main App Area (Sidebar + Content) */}
                    <div className="flex flex-1 overflow-hidden">
                        {/* Desktop Sidebar */}
                        <Sidebar />

                        {/* Mobile Sidebar Overlay */}
                        <MobileSidebar />

                        {/* Main Content Area */}
                        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
                            {/* Header */}
                            <Header />

                            {/* Tab Bar */}
                            <TabBar />

                            {/* Main Content - Scrollable (includes Footer) */}
                            <main className="flex-1 overflow-auto bg-apogee-abyss apogee-grid">
                                <div className="p-4 lg:p-6">
                                    <DashboardClientWrapper>
                                        {children}
                                    </DashboardClientWrapper>
                                </div>

                                {/* Footer - Inside scrollable area */}
                                <Footer />
                            </main>
                        </div>
                    </div>

                    {/* Command Palette (Cmd+K) */}
                    <CommandPalette />

                    {/* AI Chatbot Widget */}
                    <ChatbotWidget />
                </div>
            </TabProvider>
        </SidebarProvider>
    );
}

