"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { AuthShell } from "@/components/auth/AuthShell";
import { OtpInput, OTP_LENGTH } from "@/components/auth/OtpInput";
import { Button, Icon } from "@/components/edu";

const ERROR_ID = "mfa-setup-error";

export default function MfaSetupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(true);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [code, setCode] = useState<string[]>(Array(OTP_LENGTH).fill(""));

    useEffect(() => {
        const generateMfa = async () => {
            try {
                const response = await fetch("/api/auth/mfa/setup?action=generate", {
                    method: "POST",
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    setQrCode(data.qrCode);
                    setSecret(data.secret);
                } else {
                    if (response.status === 401) {
                        router.replace("/login");
                        return;
                    }
                    setError(data.message || data.error || "Impossible de générer le code QR.");
                }
            } catch {
                setError("Erreur de connexion au serveur.");
            } finally {
                setIsGenerating(false);
            }
        };

        generateMfa();
    }, [router]);

    const submitCode = useCallback(
        async (token: string) => {
            if (isLoading || backupCodes) return;
            if (token.length !== OTP_LENGTH) {
                setError("Le code doit contenir 6 chiffres.");
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch("/api/auth/mfa/setup?action=enable", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, secret }),
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    if (response.status === 401) {
                        router.replace("/login");
                        return;
                    }
                    setError(
                        result.message ||
                            result.error ||
                            "Code incorrect. Réessayez avec un nouveau code de votre application."
                    );
                    setCode(Array(OTP_LENGTH).fill(""));
                } else {
                    setBackupCodes(result.backupCodes);
                }
            } catch {
                setError("Erreur de connexion au serveur.");
            } finally {
                setIsLoading(false);
            }
        },
        [secret, router, isLoading, backupCodes]
    );

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    if (isGenerating) {
        return (
            <AuthShell
                title="Activation 2FA"
                subtitle="Préparation de votre configuration sécurisée…"
            >
                <div className="flex flex-col items-center gap-3 py-10">
                    <div
                        className="animate-spin"
                        style={{
                            width: 36,
                            height: 36,
                            border: "3px solid var(--brand-100)",
                            borderTopColor: "var(--brand-600)",
                            borderRadius: "50%",
                        }}
                    />
                    <p style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                        Génération du code QR…
                    </p>
                </div>
            </AuthShell>
        );
    }

    if (backupCodes) {
        return (
            <AuthShell
                title="2FA activée"
                subtitle="Conservez ces codes de secours en lieu sûr — ils ne seront plus affichés."
            >
                <div className="animate-in fade-in zoom-in-95 duration-300"
                    style={{ display: "flex", flexDirection: "column", gap: 20 }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "14px 16px",
                            borderRadius: "var(--eduflow-radius-card)",
                            background: "var(--eduflow-success-50)",
                            border: "1px solid var(--eduflow-success-200)",
                        }}
                    >
                        <Icon name="check" size={20} color="var(--eduflow-success-700)" />
                        <div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--eduflow-success-800)",
                                }}
                            >
                                Authentification à deux facteurs activée
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-success-700)",
                                    marginTop: 2,
                                }}
                            >
                                Votre compte est désormais protégé.
                            </div>
                        </div>
                    </div>

                    <div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--eduflow-text-tertiary)",
                                marginBottom: 8,
                            }}
                        >
                            Codes de secours · Important
                        </div>
                        <p
                            style={{
                                fontSize: 13,
                                color: "var(--eduflow-text-secondary)",
                                margin: "0 0 12px",
                                lineHeight: 1.55,
                            }}
                        >
                            Copiez ces codes dans un gestionnaire de mots de passe. Chacun ne
                            peut servir qu'une seule fois pour récupérer l'accès si vous perdez
                            votre téléphone.
                        </p>
                        <div
                            style={{
                                padding: 14,
                                borderRadius: "var(--eduflow-radius-card)",
                                background: "var(--eduflow-surface-sunken)",
                                border: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, 1fr)",
                                    gap: 8,
                                    marginBottom: 12,
                                }}
                            >
                                {backupCodes.map((c, idx) => (
                                    <div
                                        key={idx}
                                        className="eduflow-mono eduflow-tabular"
                                        style={{
                                            textAlign: "center",
                                            padding: "8px 10px",
                                            background: "var(--eduflow-surface-card)",
                                            border: "1px solid var(--eduflow-border-subtle)",
                                            borderRadius: 8,
                                            fontSize: 13,
                                            letterSpacing: "0.06em",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {c}
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="cards"
                                onClick={() => copyToClipboard(backupCodes.join("\n"))}
                                style={{ width: "100%", justifyContent: "center" }}
                            >
                                Copier tous les codes
                            </Button>
                        </div>
                    </div>

                    <Button
                        iconRight="arrowRight"
                        onClick={() => router.push("/dashboard")}
                        style={{ width: "100%", justifyContent: "center", height: 48 }}
                    >
                        Aller au tableau de bord
                    </Button>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Activez la 2FA"
            subtitle="Ajoutez une seconde barrière de sécurité à votre compte avec votre application d'authentification."
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {error ? (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300"
                        id={ERROR_ID}
                        role="alert"
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            padding: "12px 14px",
                            borderRadius: 10,
                            background: "var(--eduflow-danger-50)",
                            border: "1px solid var(--eduflow-danger-200)",
                            color: "var(--eduflow-danger-800)",
                        }}
                    >
                        <Icon name="warning" size={16} color="var(--eduflow-danger-600)" />
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{error}</div>
                    </div>
                ) : null}

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 14,
                        alignItems: "start",
                    }}
                >
                    <StepBadge n={1} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            Scannez le code QR
                        </div>
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                margin: 0,
                                lineHeight: 1.5,
                            }}
                        >
                            Ouvrez Google Authenticator, Authy ou 1Password puis scannez le code
                            ci-dessous.
                        </p>
                    </div>
                </div>

                {qrCode ? (
                    <div
                        style={{
                            margin: "0 auto",
                            padding: 14,
                            background: "#fff",
                            border: "1px solid var(--eduflow-border-subtle)",
                            borderRadius: "var(--eduflow-radius-card)",
                            boxShadow: "var(--eduflow-shadow-sm)",
                            width: 196,
                            height: 196,
                            display: "grid",
                            placeItems: "center",
                        }}
                    >
                        <Image src={qrCode} alt="QR Code MFA" width={168} height={168} />
                    </div>
                ) : null}

                {secret ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            background: "var(--eduflow-surface-sunken)",
                            border: "1px dashed var(--eduflow-border-default)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                        }}
                    >
                        <span style={{ flexShrink: 0 }}>Clé manuelle :</span>
                        <code
                            className="eduflow-mono"
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--eduflow-text-primary)",
                                letterSpacing: "0.06em",
                            }}
                        >
                            {secret}
                        </code>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(secret)}
                            aria-label="Copier la clé manuelle"
                            style={{
                                marginLeft: "auto",
                                background: "transparent",
                                border: 0,
                                cursor: "pointer",
                                color: "var(--brand-700)",
                                display: "grid",
                                placeItems: "center",
                            }}
                        >
                            <Icon name="cards" size={14} />
                        </button>
                    </div>
                ) : null}

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: 14,
                        alignItems: "start",
                        marginTop: 4,
                    }}
                >
                    <StepBadge n={2} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            Saisissez le code à 6 chiffres
                        </div>
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                margin: 0,
                                lineHeight: 1.5,
                            }}
                        >
                            La validation est automatique dès que les 6 chiffres sont entrés.
                        </p>
                    </div>
                </div>

                <OtpInput
                    value={code}
                    onChange={setCode}
                    onComplete={(token) => void submitCode(token)}
                    disabled={isLoading}
                    errorId={error ? ERROR_ID : undefined}
                />

                {isLoading ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            fontSize: 13,
                            color: "var(--eduflow-text-secondary)",
                        }}
                    >
                        <div
                            className="animate-spin"
                            style={{
                                width: 14,
                                height: 14,
                                border: "2px solid var(--brand-100)",
                                borderTopColor: "var(--brand-600)",
                                borderRadius: "50%",
                            }}
                        />
                        Vérification…
                    </div>
                ) : null}

                <div
                    style={{
                        marginTop: 8,
                        paddingTop: 16,
                        borderTop: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        style={{
                            background: "transparent",
                            border: 0,
                            color: "var(--eduflow-text-tertiary)",
                            fontSize: 13,
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "inherit",
                        }}
                    >
                        Configurer plus tard
                    </button>
                    <span
                        style={{
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        Besoin d'aide ? Contactez votre administrateur
                    </span>
                </div>
            </div>
        </AuthShell>
    );
}

function StepBadge({ n }: { n: number }) {
    return (
        <div
            style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "var(--brand-50)",
                color: "var(--brand-700)",
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                fontWeight: 700,
                border: "1px solid var(--brand-100)",
            }}
        >
            {n}
        </div>
    );
}
