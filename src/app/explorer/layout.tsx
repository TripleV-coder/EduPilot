import type { Metadata } from "next";

// La page est un composant client : ses métadonnées vivent ici. Sans elles,
// /explorer héritait du titre de la page d'accueil (titre en double).
export const metadata: Metadata = {
    title: "Cartographie du réseau",
    description: "Vue géographique du réseau d'établissements scolaires publiés sur EduPilot au Bénin.",
    alternates: { canonical: "/explorer" },
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
    return children;
}
