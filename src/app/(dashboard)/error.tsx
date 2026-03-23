"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="alert">
      <div className="flex flex-col items-center gap-6 text-center max-w-md px-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Une erreur s&apos;est produite</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "Une erreur inattendue est survenue. Veuillez réessayer."}
          </p>
        </div>
        <Button onClick={reset} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
