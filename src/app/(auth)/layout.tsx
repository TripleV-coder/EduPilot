import type { Metadata } from "next";

// Parcours d'authentification : jamais indexés par les moteurs de recherche.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    // Repère principal des pages d'authentification (axe landmark-one-main).
    return <main>{children}</main>;
}
