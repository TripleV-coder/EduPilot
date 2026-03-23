import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <SearchX className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="text-6xl font-display font-bold text-primary mb-2">404</p>
          <h1 className="text-2xl font-bold text-foreground mb-3">Page introuvable</h1>
          <p className="text-muted-foreground">
            La page que vous recherchez n&apos;existe pas ou a été déplacée.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard">
            <Home className="w-4 h-4" aria-hidden="true" />
            Retour au tableau de bord
          </Link>
        </Button>
      </div>
    </div>
  );
}
