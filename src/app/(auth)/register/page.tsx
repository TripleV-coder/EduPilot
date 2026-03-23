"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
    const router = useRouter();
    const [message] = useState("L'inscription publique est désactivée. Utilisez la configuration initiale.");

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
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </div>
        </div>
    );
}
