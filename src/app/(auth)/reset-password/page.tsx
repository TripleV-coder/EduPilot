"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="text-center">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Lien invalide</h2>
                <p className="text-muted-foreground mb-6">
                    Votre lien de réinitialisation est manquant ou invalide.
                </p>
                <Button asChild className="w-full">
                    <Link href="/forgot-password">Demander un nouveau lien</Link>
                </Button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
            >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] mx-auto mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-medium">Mot de passe réinitialisé !</h2>
                <p className="text-muted-foreground text-sm">
                    Votre mot de passe a été mis à jour avec succès. Vous allez être redirigé vers la page de connexion.
                </p>
                <div className="pt-4">
                    <Button asChild className="w-full">
                        <Link href="/login">Se connecter maintenant</Link>
                    </Button>
                </div>
            </motion.div>
        );
    }

    return (
        <>
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 mb-5">
                    <GraduationCap className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                    Nouveau mot de passe
                </h1>
                <p className="text-muted-foreground">
                    Veuillez entrer votre nouveau mot de passe
                </p>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    role="alert"
                    className="flex items-start gap-2 p-4 mb-6 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]"
                >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm font-medium">{error}</div>
                </motion.div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="password">Nouveau mot de passe</Label>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        {...register("password")}
                        aria-invalid={!!errors.password}
                    />
                    {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                    <Input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        {...register("confirmPassword")}
                        aria-invalid={!!errors.confirmPassword}
                    />
                    {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                </div>

                <Button
                    type="submit"
                    className="w-full mt-6"
                    size="lg"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Réinitialisation...
                        </>
                    ) : (
                        <>
                            Réinitialiser le mot de passe
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
                    <Suspense fallback={
                        <div className="flex justify-center p-8">
                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    }>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
