"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const forgotPasswordSchema = z.object({
    email: z.string().email("Email invalide").toLowerCase().trim(),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async (data: ForgotPasswordFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/forgot-password", {
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
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 mb-5">
                            <GraduationCap className="w-7 h-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Mot de passe oublié
                        </h1>
                        <p className="text-muted-foreground">
                            Entrez votre email pour réinitialiser votre mot de passe
                        </p>
                    </div>

                    {isSuccess ? (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center space-y-4"
                        >
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] mx-auto mb-2">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-medium">Lien envoyé !</h2>
                            <p className="text-muted-foreground text-sm">
                                Si cet email correspond à un compte, vous recevrez un lien de réinitialisation d'ici quelques minutes.
                            </p>
                            <div className="pt-4">
                                <Link
                                    href="/login"
                                    className="text-primary hover:underline font-medium text-sm"
                                >
                                    Retourner à la connexion
                                </Link>
                            </div>
                        </motion.div>
                    ) : (
                        <>
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
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        
                                        autoComplete="email"
                                        {...register("email")}
                                        aria-invalid={!!errors.email}
                                    />
                                    {errors.email && (
                                        <p className="text-sm text-destructive">{errors.email.message}</p>
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
                                            Envoi en cours...
                                        </>
                                    ) : (
                                        <>
                                            Envoyer le lien
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                >
                                    Annuler et retourner à la connexion
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
