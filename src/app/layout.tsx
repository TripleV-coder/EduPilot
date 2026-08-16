import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// EduPilot Design System — Inter (display + body) et JetBrains Mono (tabular).
// Inter n'est chargé qu'UNE seule fois sous --font-body ; les alias
// --font-display / --font-eduflow-body / --font-ui sont dérivés en CSS
// (cf. globals.css) pour éviter trois téléchargements de la même police.
const inter = Inter({
    subsets: ["latin"],
    variable: "--font-body",
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
import { SkipToContent } from "@/components/a11y/skip-to-content";
import { WebVitalsReporter } from "@/components/performance/WebVitalsReporter";
import { Toaster as SonnerToaster } from "sonner";

// Rendu dynamique forcé : indispensable pour la CSP à nonce par requête
// (cf. src/proxy.ts). Un nonce ne peut pas s'appliquer à du HTML prérendu
// statiquement. L'app étant authentifiée (pages majoritairement dynamiques),
// le coût de cache est marginal.
export const dynamic = "force-dynamic";

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
        <html lang="fr" className={`${inter.variable} ${eduflowMono.variable}`}>
            <body className="font-body antialiased">
                <SkipToContent />
                <SessionProvider>
                    <SWRProvider>
                        <SchoolProvider>
                            <div id="main-content">
                                {children}
                            </div>
                            <WebVitalsReporter />
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
