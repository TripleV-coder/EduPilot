"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import Image from "next/image";

import { PageGuard } from "@/components/guard/page-guard";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon, Input } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

const mfaCodeSchema = z.object({
    token: z.string().length(6, "Le code 2FA doit contenir 6 chiffres"),
});

const disableMfaSchema = z.object({
    password: z.string().min(1, "Le mot de passe est requis"),
});

export default function SecuritySettingsPage() {
    const { data: session, update } = useSession();
    const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(
        Boolean(session?.user?.isTwoFactorEnabled)
    );
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
            pushInfo(
                "Scanne le QR code puis saisis le code à 6 chiffres généré par ton application."
            );
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
            pushInfo(
                "Authentification à double facteur activée. Conserve les codes de secours."
            );
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
            pushError(
                error instanceof Error ? error.message : "Erreur lors de la désactivation 2FA."
            );
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
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Sécurité & accès"
                    description="Active l'authentification à double facteur (2FA) et utilise le flux sécurisé pour réinitialiser ton mot de passe."
                    breadcrumbs={[
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Sécurité" },
                    ]}
                />

                {infoMessage ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-success-500)",
                            background: "var(--eduflow-success-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="success" size={18} color="var(--eduflow-success-700)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-success-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {infoMessage}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {errorMessage ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {errorMessage}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {/* MFA / 2FA */}
                <Card padding={0}>
                    <div
                        className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <div className="flex items-start gap-3">
                            <Icon name="settings" size={18} color="var(--brand-700)" />
                            <div>
                                <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                    Authentification à double facteur (2FA)
                                </h3>
                                <p
                                    style={{
                                        margin: "2px 0 0",
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    Une couche de sécurité supplémentaire via TOTP ou codes de secours.
                                </p>
                            </div>
                        </div>
                        {isTwoFactorEnabled ? (
                            <Badge variant="success" size="sm" dot>
                                Activée
                            </Badge>
                        ) : (
                            <Badge variant="neutral" size="sm">
                                Inactive
                            </Badge>
                        )}
                    </div>
                    <div className="px-5 py-5">
                        {!isTwoFactorEnabled ? (
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        type="button"
                                        icon="sparkle"
                                        loading={isGenerating}
                                        onClick={() => void generateMfaSetup()}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? "Génération…" : "Générer le QR code"}
                                    </Button>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        Une application TOTP (Google Auth, Authy…) est requise.
                                    </span>
                                </div>

                                {qrCode ? (
                                    <div
                                        className="grid gap-5"
                                        style={{
                                            gridTemplateColumns: "minmax(180px, 220px) 1fr",
                                            padding: 16,
                                            background: "var(--eduflow-surface-sunken)",
                                            borderRadius: "var(--eduflow-radius-card)",
                                        }}
                                    >
                                        <div
                                            className="grid place-items-center"
                                            style={{
                                                background: "white",
                                                padding: 12,
                                                borderRadius: 12,
                                            }}
                                        >
                                            <Image
                                                src={qrCode}
                                                alt="QR code 2FA"
                                                width={176}
                                                height={176}
                                                unoptimized
                                                style={{ borderRadius: 8 }}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <Input
                                                label="Secret manuel"
                                                value={mfaSecret}
                                                icon="settings"
                                                disabled
                                            />
                                            <Input
                                                label="Code à 6 chiffres"
                                                value={verificationCode}
                                                onChange={(e) =>
                                                    setVerificationCode(
                                                        e.target.value.replace(/\D/g, "").slice(0, 6)
                                                    )
                                                }
                                                icon="check"
                                                placeholder="123456"
                                            />
                                            <Button
                                                type="button"
                                                onClick={() => void enableMfa()}
                                                disabled={isEnabling || !mfaSecret}
                                                loading={isEnabling}
                                                icon={isEnabling ? undefined : "check"}
                                            >
                                                {isEnabling ? "Activation…" : "Activer la 2FA"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <Card
                                    padding={14}
                                    style={{
                                        background: "var(--eduflow-success-50)",
                                        borderLeft: "3px solid var(--eduflow-success-500)",
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <Icon
                                            name="success"
                                            size={18}
                                            color="var(--eduflow-success-700)"
                                        />
                                        <p
                                            style={{
                                                margin: 0,
                                                fontSize: 13,
                                                color: "var(--eduflow-success-800)",
                                            }}
                                        >
                                            Ton compte exige désormais un code TOTP ou un code de
                                            secours valide à chaque connexion.
                                        </p>
                                    </div>
                                </Card>
                                <div className="max-w-md">
                                    <Input
                                        label="Mot de passe pour désactiver"
                                        type="password"
                                        value={disablePassword}
                                        onChange={(e) => setDisablePassword(e.target.value)}
                                        icon="settings"
                                    />
                                </div>
                                <div>
                                    <Button
                                        variant="danger"
                                        onClick={() => void disableMfa()}
                                        disabled={isDisabling}
                                        loading={isDisabling}
                                        icon={isDisabling ? undefined : "x"}
                                    >
                                        {isDisabling ? "Désactivation…" : "Désactiver la 2FA"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {backupCodes.length > 0 ? (
                            <div
                                className="mt-5"
                                style={{
                                    padding: 16,
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: "var(--eduflow-radius-card)",
                                }}
                            >
                                <p
                                    style={{
                                        margin: "0 0 10px",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: "var(--eduflow-text-primary)",
                                    }}
                                >
                                    Codes de secours
                                </p>
                                <p
                                    style={{
                                        margin: "0 0 12px",
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    Conserve ces codes en lieu sûr. Chaque code n&apos;est utilisable
                                    qu&apos;une seule fois.
                                </p>
                                <div
                                    className="grid gap-2"
                                    style={{
                                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                                    }}
                                >
                                    {backupCodes.map((code) => (
                                        <div
                                            key={code}
                                            className="eduflow-mono"
                                            style={{
                                                padding: "8px 12px",
                                                background: "var(--eduflow-surface-card)",
                                                border: "1px solid var(--eduflow-border-default)",
                                                borderRadius: 8,
                                                fontSize: 13,
                                                color: "var(--eduflow-text-primary)",
                                            }}
                                        >
                                            {code}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </Card>

                {/* Password reset */}
                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="settings" size={18} color="var(--brand-700)" />
                        <div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Mot de passe
                            </h3>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Le changement passe par un lien envoyé par email pour des raisons de
                                sécurité.
                            </p>
                        </div>
                    </div>
                    <div className="px-5 py-5">
                        <Card
                            padding={12}
                            style={{
                                background: "var(--eduflow-surface-sunken)",
                                marginBottom: 12,
                            }}
                        >
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                }}
                            >
                                Un lien de réinitialisation sera envoyé à{" "}
                                <span
                                    style={{
                                        fontWeight: 700,
                                        color: "var(--eduflow-text-primary)",
                                    }}
                                >
                                    {userEmail || "ton adresse email"}
                                </span>
                                .
                            </p>
                        </Card>
                        <Card
                            padding={12}
                            style={{
                                background: "var(--eduflow-warning-50)",
                                borderLeft: "3px solid var(--eduflow-warning-500)",
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <Icon
                                    name="warning"
                                    size={16}
                                    color="var(--eduflow-warning-700)"
                                />
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: 12,
                                        color: "var(--eduflow-warning-800)",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    Aucun changement direct en session n&apos;est exposé par le
                                    backend. Cette page utilise le flux réel de réinitialisation.
                                </p>
                            </div>
                        </Card>
                    </div>
                    <div
                        className="flex justify-end border-t px-5 py-4"
                        style={{
                            borderColor: "var(--eduflow-border-subtle)",
                            background: "var(--eduflow-surface-sunken)",
                        }}
                    >
                        <Button
                            type="button"
                            onClick={() => void sendPasswordResetLink()}
                            disabled={isSendingResetLink}
                            loading={isSendingResetLink}
                            icon={isSendingResetLink ? undefined : "sms"}
                        >
                            {isSendingResetLink
                                ? "Envoi…"
                                : "Envoyer le lien de réinitialisation"}
                        </Button>
                    </div>
                </Card>
            </PageShell>
        </PageGuard>
    );
}
