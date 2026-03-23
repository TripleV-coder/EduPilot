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

const firstLoginSchema = z
    .object({
        currentPassword: z.string().min(1, "Mot de passe temporaire requis"),
        newPassword: z
            .string()
            .min(8, "Minimum 8 caractères")
            .regex(/[A-Z]/, "Au moins une majuscule")
            .regex(/[a-z]/, "Au moins une minuscule")
            .regex(/[0-9]/, "Au moins un chiffre")
            .regex(/[^A-Za-z0-9]/, "Au moins un caractère spécial"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
    });

type FirstLoginFormData = z.infer<typeof firstLoginSchema>;

function FirstLoginForm() {
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
    } = useForm<FirstLoginFormData>({
        resolver: zodResolver(firstLoginSchema),
    });

    const onSubmit = async (data: FirstLoginFormData) => {
        if (!token) {
            setError("Le lien d'accès est invalide ou manquant.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/first-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword,
                    useMagicLink: false,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Une erreur est survenue.");
            } else {
                setIsSuccess(true);
                setTimeout(() => {
                    router.push("/login?firstLogin=1");
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
                    Votre lien de première connexion est manquant ou invalide. Veuillez contacter votre administrateur.
                </p>
                <Button asChild className="w-full">
                    <Link href="/login">Retourner à la connexion</Link>
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
                <h2 className="text-xl font-medium">Compte activé !</h2>
                <p className="text-muted-foreground text-sm">
                    Votre mot de passe a été défini avec succès. Vous allez être redirigé vers la page de connexion.
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
                    Première Connexion
                </h1>
                <p className="text-muted-foreground">
                    Veuillez définir votre mot de passe définitif
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
                    <Label htmlFor="currentPassword">Mot de passe temporaire</Label>
                    <Input
                        id="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        {...register("currentPassword")}
                        aria-invalid={!!errors.currentPassword}
                    />
                    {errors.currentPassword && (
                        <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
                    )}
                </div>

                <div className="space-y-2 mt-6">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input
                        id="newPassword"
                        type="password"
                        autoComplete="new-password"
                        {...register("newPassword")}
                        aria-invalid={!!errors.newPassword}
                    />
                    {errors.newPassword && (
                        <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
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
                            Activation...
                        </>
                    ) : (
                        <>
                            Activer mon compte
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </form>
        </>
    );
}

export default function FirstLoginPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
                    <Suspense fallback={
                        <div className="flex justify-center p-8">
                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                    }>
                        <FirstLoginForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
