"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { AlertTriangle, CheckCircle, KeyRound, ShieldCheck, Smartphone } from "lucide-react";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const mfaCodeSchema = z.object({
  token: z.string().length(6, "Le code 2FA doit contenir 6 chiffres"),
});

const disableMfaSchema = z.object({
  password: z.string().min(1, "Le mot de passe est requis"),
});

export default function SecuritySettingsPage() {
  const { data: session, update } = useSession();
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(Boolean(session?.user?.isTwoFactorEnabled));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [mfaSecret, setMfaSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userEmail = useMemo(() => session?.user?.email || "", [session?.user?.email]);

  useEffect(() => {
    setIsTwoFactorEnabled(Boolean(session?.user?.isTwoFactorEnabled));
  }, [session?.user?.isTwoFactorEnabled]);

  const pushInfo = (message: string) => {
    setInfoMessage(message);
    setErrorMessage(null);
  };

  const pushError = (message: string) => {
    setErrorMessage(message);
    setInfoMessage(null);
  };

  const generateMfaSetup = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/auth/mfa/setup?action=generate", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Impossible de générer la configuration 2FA.");
      }

      setMfaSecret(payload.secret || "");
      setQrCode(payload.qrCode || "");
      setBackupCodes([]);
      pushInfo("Scannez le QR code puis saisissez le code à 6 chiffres généré par votre application.");
    } catch (error) {
      pushError(error instanceof Error ? error.message : "Erreur lors de la génération 2FA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const enableMfa = async () => {
    setIsEnabling(true);
    try {
      const validated = mfaCodeSchema.parse({ token: verificationCode.trim() });
      const response = await fetch("/api/auth/mfa/setup?action=enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: validated.token, secret: mfaSecret }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Activation 2FA impossible.");
      }

      setIsTwoFactorEnabled(true);
      setBackupCodes(Array.isArray(payload.backupCodes) ? payload.backupCodes : []);
      setVerificationCode("");
      pushInfo("Authentification à double facteur activée. Conservez les codes de secours.");
      await update().catch(() => null);
    } catch (error) {
      pushError(error instanceof Error ? error.message : "Erreur lors de l'activation 2FA.");
    } finally {
      setIsEnabling(false);
    }
  };

  const disableMfa = async () => {
    setIsDisabling(true);
    try {
      const validated = disableMfaSchema.parse({ password: disablePassword });
      const response = await fetch("/api/auth/mfa/setup?action=disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Désactivation 2FA impossible.");
      }

      setIsTwoFactorEnabled(false);
      setMfaSecret("");
      setQrCode("");
      setDisablePassword("");
      setBackupCodes([]);
      pushInfo("Authentification à double facteur désactivée.");
      await update().catch(() => null);
    } catch (error) {
      pushError(error instanceof Error ? error.message : "Erreur lors de la désactivation 2FA.");
    } finally {
      setIsDisabling(false);
    }
  };

  const sendPasswordResetLink = async () => {
    if (!userEmail) {
      pushError("Adresse email introuvable dans la session.");
      return;
    }

    setIsSendingResetLink(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Impossible d'envoyer le lien de réinitialisation.");
      }

      pushInfo(payload.message || "Un lien de réinitialisation a été envoyé.");
    } catch (error) {
      pushError(error instanceof Error ? error.message : "Erreur lors de l'envoi du lien.");
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Sécurité & accès"
          description="Activez la MFA avec les vraies routes backend et utilisez le flux sécurisé de réinitialisation pour changer votre mot de passe."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Paramètres", href: "/dashboard/settings" },
            { label: "Sécurité" },
          ]}
        />

        {infoMessage ? (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] px-4 py-3 text-sm text-[hsl(var(--success))]">
            <CheckCircle className="h-4 w-4" />
            {infoMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {errorMessage}
          </div>
        ) : null}

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/10">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-primary" />
                Authentification à double facteur
              </CardTitle>
              <CardDescription className="mt-1">
                Route utilisée: <code>/api/auth/mfa/setup</code> avec génération, activation et désactivation côté serveur.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                isTwoFactorEnabled
                  ? "border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]"
                  : "border-border bg-background text-muted-foreground"
              }
            >
              {isTwoFactorEnabled ? "Activée" : "Inactive"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {!isTwoFactorEnabled ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={() => void generateMfaSetup()} disabled={isGenerating}>
                    {isGenerating ? "Génération..." : "Générer le QR code"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Une application TOTP est requise pour finaliser l'activation.
                  </p>
                </div>

                {qrCode ? (
                  <div className="grid gap-6 rounded-2xl border border-border bg-card p-5 md:grid-cols-[220px_1fr]">
                    <div className="flex justify-center rounded-xl bg-[#F5F4F2] p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCode} alt="QR code MFA" className="h-44 w-44 rounded-lg" />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="mfa-secret">Secret manuel</Label>
                        <Input id="mfa-secret" value={mfaSecret} readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mfa-code">Code à 6 chiffres</Label>
                        <Input
                          id="mfa-code"
                          inputMode="numeric"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456"
                        />
                      </div>
                      <Button type="button" onClick={() => void enableMfa()} disabled={isEnabling || !mfaSecret}>
                        {isEnabling ? "Activation..." : "Activer la MFA"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] p-4 text-sm text-[hsl(var(--success))]">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>
                      Votre compte exige désormais un code TOTP ou un code de secours valide à chaque connexion.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <Label htmlFor="disable-password">Mot de passe pour désactiver la MFA</Label>
                  <Input
                    id="disable-password"
                    type="password"
                    value={disablePassword}
                    onChange={(event) => setDisablePassword(event.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => void disableMfa()}
                  disabled={isDisabling}
                >
                  {isDisabling ? "Désactivation..." : "Désactiver la MFA"}
                </Button>
              </div>
            )}

            {backupCodes.length > 0 ? (
              <div className="rounded-2xl border border-[#E8E7E4] bg-[#FAFAF8] p-5">
                <p className="mb-3 text-sm font-semibold text-foreground">Codes de secours</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {backupCodes.map((code) => (
                    <div
                      key={code}
                      className="rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-foreground"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5 text-primary" />
              Changer votre mot de passe
            </CardTitle>
            <CardDescription>
              Le backend exposé dans ce dépôt fournit un flux sécurisé par email via <code>/api/auth/forgot-password</code> et <code>/api/auth/reset-password</code>, pas de changement direct en session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-lg border border-border bg-[#FAFAF8] p-4 text-sm text-muted-foreground">
              Un lien de réinitialisation sera envoyé à <span className="font-semibold text-foreground">{userEmail || "votre adresse email"}</span>.
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Aucun endpoint authentifié de modification immédiate n&apos;est disponible dans le backend actuel. Cette page utilise donc le flux réel de réinitialisation.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border bg-muted/10 py-4">
            <Button type="button" onClick={() => void sendPasswordResetLink()} disabled={isSendingResetLink}>
              {isSendingResetLink ? "Envoi..." : "Envoyer le lien de réinitialisation"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </PageGuard>
  );
}
