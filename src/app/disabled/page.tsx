import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DisabledPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-border">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle className="text-foreground">Compte désactivé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Votre compte a été désactivé. Contactez l&apos;administrateur de votre établissement pour plus d&apos;informations.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
