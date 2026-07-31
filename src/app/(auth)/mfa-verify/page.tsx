"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import { AuthShell } from "@/components/auth/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/auth/OtpInput";
import { Button } from "@/components/edu";

const ERROR_ID = "mfa-verify-error";

/**
 * Étape 2 de la connexion pour les comptes protégés par un second facteur.
 *
 * `authorize()` délivre une session « pré-2FA » (mot de passe vérifié,
 * `isTwoFactorAuthenticated: false`) que le middleware confine à cette page.
 * La validation passe par `update({ twoFactorCode })`, qui vérifie le code
 * côté serveur dans le callback JWT et bascule le jeton en authentifié.
 */
function MfaVerifyForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session, status, update } = useSession();

    const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [backupCode, setBackupCode] = useState("");
    const [useBackup, setUseBackup] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    // Un utilisateur déjà validé (ou sans 2FA) n'a rien à faire ici.
    useEffect(() => {
        if (status !== "authenticated") return;
        if (!session?.user?.isTwoFactorEnabled || session.user.isTwoFactorAuthenticated) {
            router.replace(callbackUrl);
        }
    }, [status, session, router, callbackUrl]);

    const verify = useCallback(
        async (value: string) => {
            setIsLoading(true);
            setError(null);
            try {
                const updated = await update({ twoFactorCode: value });

                if (updated?.user?.isTwoFactorAuthenticated) {
                    router.replace(callbackUrl);
                    router.refresh();
                    return;
                }

                // Le serveur n'a pas basculé le jeton : code erroné, expiré, ou
                // plafond de tentatives atteint.
                setError(
                    "Code incorrect ou expiré. Vérifiez l'horloge de votre application, puis réessayez."
                );
                setCode(Array(OTP_LENGTH).fill(""));
                setBackupCode("");
            } catch {
                setError("Erreur de connexion au serveur.");
            } finally {
                setIsLoading(false);
            }
        },
        [update, router, callbackUrl]
    );

    if (status === "loading") {
        return (
            <AuthShell title="Vérification en deux étapes" soloColumn>
                <p style={{ color: "var(--eduflow-text-secondary)" }}>Chargement…</p>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Vérification en deux étapes"
            subtitle={
                useBackup
                    ? "Saisissez l'un de vos codes de secours à usage unique."
                    : "Saisissez le code à 6 chiffres affiché par votre application d'authentification."
            }
            soloColumn
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {error && (
                    <div
                        id={ERROR_ID}
                        role="alert"
                        aria-live="assertive"
                        style={{
                            padding: 14,
                            borderRadius: 10,
                            background: "var(--eduflow-danger-50, #fef2f2)",
                            border: "1px solid var(--eduflow-danger-600)",
                            color: "var(--eduflow-danger-700, #b91c1c)",
                            fontSize: 14,
                        }}
                    >
                        {error}
                    </div>
                )}

                {useBackup ? (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const trimmed = backupCode.trim();
                            if (trimmed) void verify(trimmed);
                        }}
                        style={{ display: "flex", flexDirection: "column", gap: 16 }}
                    >
                        <label
                            htmlFor="backup-code"
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--eduflow-text-primary)",
                            }}
                        >
                            Code de secours
                        </label>
                        <input
                            id="backup-code"
                            value={backupCode}
                            onChange={(e) => setBackupCode(e.target.value)}
                            disabled={isLoading}
                            autoComplete="one-time-code"
                            aria-describedby={error ? ERROR_ID : undefined}
                            placeholder="ex. a1b2c3d4e5"
                            style={{
                                height: 48,
                                padding: "0 14px",
                                fontSize: 16,
                                fontFamily: "var(--eduflow-font-mono)",
                                color: "var(--eduflow-text-primary)",
                                background: "var(--eduflow-surface-card)",
                                border: "2px solid var(--eduflow-border-default)",
                                borderRadius: 12,
                                outline: "none",
                            }}
                        />
                        <Button
                            type="submit"
                            loading={isLoading}
                            disabled={!backupCode.trim()}
                            full
                        >
                            Valider le code de secours
                        </Button>
                    </form>
                ) : (
                    <>
                        <OtpInput
                            value={code}
                            onChange={setCode}
                            onComplete={(value) => void verify(value)}
                            disabled={isLoading}
                            errorId={error ? ERROR_ID : undefined}
                        />
                        <Button
                            onClick={() => void verify(code.join(""))}
                            loading={isLoading}
                            disabled={code.join("").length !== OTP_LENGTH}
                            full
                        >
                            Vérifier
                        </Button>
                    </>
                )}

                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setUseBackup((v) => !v);
                            setError(null);
                            setCode(Array(OTP_LENGTH).fill(""));
                            setBackupCode("");
                        }}
                    >
                        {useBackup
                            ? "Utiliser l'application d'authentification"
                            : "Utiliser un code de secours"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void signOut({ callbackUrl: "/login" })}
                    >
                        Se déconnecter
                    </Button>
                </div>
            </div>
        </AuthShell>
    );
}

export default function MfaVerifyPage() {
    return (
        <Suspense fallback={null}>
            <MfaVerifyForm />
        </Suspense>
    );
}
