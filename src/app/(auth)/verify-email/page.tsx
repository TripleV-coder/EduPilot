"use client";

import { useState } from "react";
import Link from "next/link";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Icon } from "@/components/edu";

const verifyEmailSchema = z.object({
    email: z.string().email("Email invalide").toLowerCase().trim(),
});

type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

export default function VerifyEmailPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<VerifyEmailFormData>({
        resolver: zodResolver(verifyEmailSchema),
    });

    const onSubmit = async (data: VerifyEmailFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/verify-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Une erreur est survenue.");
            } else {
                setIsSuccess(true);
            }
        } catch {
            setError("Erreur de connexion au serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <AuthShell
                title="Lien envoyé"
                subtitle="Vérifiez votre boîte de réception pour finaliser la confirmation."
            >
                <div className="animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{ display: "flex", flexDirection: "column", gap: 18 }}
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
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--eduflow-success-800)",
                            }}
                        >
                            Un email de vérification vient de partir.
                        </div>
                    </div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: "var(--eduflow-text-secondary)",
                            lineHeight: 1.55,
                        }}
                    >
                        Si vous ne le voyez pas d'ici quelques minutes, regardez dans le dossier
                        spam ou indésirables.
                    </p>
                    <Link href="/login" style={{ textDecoration: "none" }}>
                        <Button
                            iconRight="arrowRight"
                            style={{ width: "100%", justifyContent: "center", height: 48 }}
                        >
                            Retourner à la connexion
                        </Button>
                    </Link>
                </div>
            </AuthShell>
        );
    }

    return (
        <AuthShell
            title="Vérification email"
            subtitle="Renvoyez un lien de confirmation à votre adresse pour activer votre compte."
        >
            {error ? (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300"
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
                        marginBottom: 16,
                    }}
                >
                    <Icon name="warning" size={16} color="var(--eduflow-danger-600)" />
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{error}</div>
                </div>
            ) : null}

            <form
                onSubmit={handleSubmit(onSubmit)}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
                <FieldInput
                    id="email"
                    label="Adresse email"
                    type="email"
                    autoComplete="email"
                    placeholder="vous@ecole.bj"
                    error={errors.email?.message}
                    register={register("email")}
                />

                <Button
                    type="submit"
                    iconRight="arrowRight"
                    disabled={isLoading}
                    style={{
                        width: "100%",
                        justifyContent: "center",
                        height: 48,
                        marginTop: 4,
                    }}
                >
                    {isLoading ? "Envoi en cours…" : "Renvoyer le lien"}
                </Button>

                <div
                    style={{
                        textAlign: "center",
                        marginTop: 12,
                        fontSize: 13,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    <Link
                        href="/login"
                        style={{
                            color: "var(--brand-700)",
                            fontWeight: 600,
                            textDecoration: "none",
                        }}
                    >
                        Retourner à la connexion
                    </Link>
                </div>
            </form>
        </AuthShell>
    );
}

function FieldInput({
    id,
    label,
    type,
    autoComplete,
    placeholder,
    error,
    register,
}: {
    id: string;
    label: string;
    type: string;
    autoComplete?: string;
    placeholder?: string;
    error?: string;
    register: ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
    return (
        <label style={{ display: "block" }}>
            <span
                style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--eduflow-text-secondary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <input
                id={id}
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                aria-invalid={!!error}
                {...register}
                style={{
                    width: "100%",
                    height: 44,
                    padding: "0 14px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: `1px solid ${
                        error
                            ? "var(--eduflow-danger-500)"
                            : "var(--eduflow-border-default)"
                    }`,
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "var(--eduflow-text-primary)",
                    outline: "none",
                    transition:
                        "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                }}
            />
            {error ? (
                <p
                    style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "var(--eduflow-danger-700)",
                    }}
                >
                    {error}
                </p>
            ) : null}
        </label>
    );
}
