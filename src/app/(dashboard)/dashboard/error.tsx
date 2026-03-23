"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/utils/logger";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service or local logger
        console.error("Dashboard caught error:", error);
        
        if (logger && typeof logger.error === "function") {
            logger.error("Client error in dashboard", error);
        }
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="bg-destructive/10 p-4 rounded-full mb-6">
                <AlertCircle className="w-12 h-12 text-destructive" />
            </div>

            <h2 className="text-2xl font-bold tracking-tight mb-2">
                Une erreur inattendue est survenue
            </h2>

            <p className="text-muted-foreground max-w-md mb-8">
                Nous sommes désolés, une erreur technique s'est produite lors du chargement de cette page. Notre équipe a été notifiée.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <Button
                    onClick={() => reset()}
                    variant="default"
                    className="gap-2"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Réessayer
                </Button>

                <Link href="/dashboard">
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                        <Home className="w-4 h-4" />
                        Retour à l'accueil
                    </Button>
                </Link>
            </div>

            {process.env.NODE_ENV === "development" && (
                <div className="mt-12 text-left max-w-2xl w-full bg-muted p-4 rounded-md overflow-auto border border-border">
                    <p className="font-mono text-sm font-semibold text-destructive mb-2">
                        Details (Dev Only):
                    </p>
                    <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {error.message || "Unknown error"}
                        {"\n\n"}
                        {error.stack}
                    </pre>
                </div>
            )}
        </div>
    );
}
