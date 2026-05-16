"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Icon } from "@/components/edu";

const resetPasswordSchema = z
    .object({
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
    });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams?.get("token");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
    });

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) {
            setError("Le lien de réinitialisation est invalide ou manquant.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password: data.password }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Une erreur est survenue.");
            } else {
                setIsSuccess(true);
                setTimeout(() => {
                    router.push("/login?reset=1");
                }, 3000);
            }
        } catch {
            setError("Erreur de connexion au serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: "14px 16px",
                        borderRadius: "var(--eduflow-radius-card)",
                        background: "var(--eduflow-danger-50)",
                        border: "1px solid var(--eduflow-danger-200)",
                    }}
                >
                    <Icon name="warning" size={20} color="var(--eduflow-danger-600)" />
                    <div>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--eduflow-danger-800)",
                                marginBottom: 4,
                            }}
                        >
                            Lien invalide
                        </div>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                color: "var(--eduflow-danger-700)",
                                lineHeight: 1.5,
                            }}
                        >
                            Votre lien de réinitialisation est manquant ou expiré.
                        </p>
                    </div>
                </div>
                <Link href="/forgot-password" style={{ textDecoration: "none" }}>
                    <Button
                        iconRight="arrowRight"
                        style={{ width: "100%", justifyContent: "center", height: 48 }}
                    >
                        Demander un nouveau lien
                    </Button>
                </Link>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
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
                    <div>
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--eduflow-success-800)",
                            }}
                        >
                            Mot de passe réinitialisé
                        </div>
                        <p
                            style={{
                                margin: "2px 0 0",
                                fontSize: 12,
                                color: "var(--eduflow-success-700)",
                                lineHeight: 1.5,
                            }}
                        >
                            Redirection vers la page de connexion…
                        </p>
                    </div>
                </div>
                <Link href="/login" style={{ textDecoration: "none" }}>
                    <Button
                        iconRight="arrowRight"
                        style={{ width: "100%", justifyContent: "center", height: 48 }}
                    >
                        Se connecter maintenant
                    </Button>
                </Link>
            </motion.div>
        );
    }

    return (
        <>
            {error ? (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
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
                </motion.div>
            ) : null}

            <form
                onSubmit={handleSubmit(onSubmit)}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
                <FieldInput
                    id="password"
                    label="Nouveau mot de passe"
                    type="password"
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    error={errors.password?.message}
                    register={register("password")}
                />
                <FieldInput
                    id="confirmPassword"
                    label="Confirmer le mot de passe"
                    type="password"
                    autoComplete="new-password"
                    error={errors.confirmPassword?.message}
                    register={register("confirmPassword")}
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
                    {isLoading ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
                </Button>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <AuthShell
            title="Nouveau mot de passe"
            subtitle="Choisissez un mot de passe robuste pour reprendre la main sur votre compte."
        >
            <Suspense
                fallback={
                    <div
                        className="flex items-center justify-center p-8"
                        aria-label="Chargement en cours"
                    >
                        <div
                            className="animate-spin"
                            style={{
                                width: 32,
                                height: 32,
                                border: "3px solid var(--brand-100)",
                                borderTopColor: "var(--brand-600)",
                                borderRadius: "50%",
                            }}
                        />
                    </div>
                }
            >
                <ResetPasswordForm />
            </Suspense>
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
