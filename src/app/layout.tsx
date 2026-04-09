import type { Metadata, Viewport } from "next";
import { Geist, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-body",
    display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
    subsets: ["latin"],
    variable: "--font-display",
    weight: "400",
    style: ["normal", "italic"],
    display: "swap",
});

import { SessionProvider } from "@/components/providers/session-provider";
import { SchoolProvider } from "@/components/providers/school-provider";
import { SWRProvider } from "@/components/providers/swr-provider";
import { CookieBanner } from "@/components/gdpr/CookieBanner";
import { Toaster as SonnerToaster } from "sonner";

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    themeColor: "hsl(32, 95%, 52%)",
};

export const metadata: Metadata = {
    title: {
        default: "EduPilot",
        template: "%s — EduPilot",
    },
    description: "Système de Gestion Scolaire Intelligent pour les établissements du Bénin",
    openGraph: {
        title: "EduPilot",
        description: "Système de Gestion Scolaire Intelligent pour les établissements du Bénin",
        url: "https://edupilot.bj",
        siteName: "EduPilot",
        images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
        locale: "fr_FR",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "EduPilot",
        description: "Système de Gestion Scolaire Intelligent pour les établissements du Bénin",
        images: ["/og-image.jpg"],
    },
};

import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr" className={`${geist.variable} ${dmSerifDisplay.variable}`}>
            <body className="font-body antialiased">
                <SessionProvider>
                    <SWRProvider>
                        <SchoolProvider>
                            {children}
                            <CookieBanner />
                            <Toaster />
                            <SonnerToaster position="top-right" richColors closeButton />
                        </SchoolProvider>
                    </SWRProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
