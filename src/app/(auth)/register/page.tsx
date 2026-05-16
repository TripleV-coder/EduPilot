"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";

export default function RegisterPage() {
    const router = useRouter();
    const [message] = useState(
        "L'inscription publique est désactivée. Vous serez redirigé vers la configuration initiale ou la page de connexion.",
    );

    useEffect(() => {
        const redirectToSetup = async () => {
            try {
                const response = await fetch("/api/auth/initial-setup");
                const data = await response.json();
                if (data?.setupNeeded) {
                    router.replace("/setup");
                    return;
                }
            } catch {
                // ignore and fall back to login
            }
            router.replace("/login");
        };

        redirectToSetup();
    }, [router]);

    return (
        <AuthShell
            title="Créez votre établissement"
            subtitle="Mise en service rapide, données hébergées au Bénin, sans carte bancaire."
        >
            <div
                style={{
                    padding: 16,
                    borderRadius: "var(--eduflow-radius-md)",
                    background: "var(--brand-50)",
                    border: "1px solid var(--brand-200)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "var(--brand-800)",
                }}
            >
                {message}
            </div>
        </AuthShell>
    );
}
