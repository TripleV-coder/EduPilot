import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
};

// Prérendue au build : le service worker doit pouvoir la servir hors-ligne
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Vous êtes hors ligne</h1>
        <p className="text-muted-foreground mb-6">
          La connexion réseau a été interrompue. Les données déjà consultées
          restent disponibles, et cette page disparaîtra dès que la connexion reviendra.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90"
        >
          Réessayer
        </Link>
      </div>
    </main>
  );
}