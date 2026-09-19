import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Annuaire des établissements",
    description: "Trouvez un établissement scolaire du Bénin publié sur EduPilot : niveaux, type, localisation et contacts.",
    alternates: { canonical: "/ecoles" },
};

export default function EcolesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
