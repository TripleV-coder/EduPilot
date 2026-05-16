import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// EduPilot Design System — Inter (display + body) et JetBrains Mono (tabular).
// On expose Inter à la fois sous --font-body / --font-display (compat avec
// les composants existants qui utilisent ces variables) et sous
// --font-eduflow-body (utilisé par les composants edu/*).
const inter = Inter({
    subsets: ["latin"],
    variable: "--font-body",
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

const interDisplay = Inter({
    subsets: ["latin"],
    variable: "--font-display",
    weight: ["500", "600", "700"],
    display: "swap",
});

const eduflowBody = Inter({
    subsets: ["latin"],
    variable: "--font-eduflow-body",
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

const eduflowMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-eduflow-mono",
    weight: ["400", "500"],
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
    icons: {
        icon: [
            { url: "/favicon.svg", type: "image/svg+xml" },
        ],
        apple: [
            { url: "/apple-touch-icon.svg", type: "image/svg+xml", sizes: "180x180" },
        ],
        shortcut: "/favicon.svg",
    },
    manifest: "/manifest.json",
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
        <html lang="fr" className={`${inter.variable} ${interDisplay.variable} ${eduflowBody.variable} ${eduflowMono.variable}`}>
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
