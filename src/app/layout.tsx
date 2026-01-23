import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";
import { OfflineIndicator } from "@/components/ui/offline-indicator";

const fontSans = localFont({
  src: [
    {
      path: "./fonts/GeistVF.woff",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "EduPilot - La Révolution Scolaire",
  description: "Plateforme de gestion scolaire nouvelle génération.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased apogee",
          fontSans.variable
        )}
      >
        <QueryProvider>
          {children}
          <OfflineIndicator />
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}

