"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, AlertCircle, ArrowRight, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const setupSchema = z
    .object({
        firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
        lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
        email: z.string().email("Email invalide").toLowerCase().trim(),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
    });

type SetupFormData = z.infer<typeof setupSchema>;

export default function SetupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SetupFormData>({
        resolver: zodResolver(setupSchema),
    });

    useEffect(() => {
        const checkSetupStatus = async () => {
            try {
                const response = await fetch("/api/auth/initial-setup");
                const data = await response.json();
                setSetupNeeded(data.setupNeeded);
                if (data.setupNeeded === false) {
                    router.replace("/login");
                }
            } catch (err) {
                setError("Impossible de vérifier l'état du système.");
            } finally {
                setIsChecking(false);
            }
        };

        checkSetupStatus();
    }, [router]);

    const onSubmit = async (data: SetupFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/initial-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || "Une erreur est survenue lors de l'initialisation.");
            } else {
                router.push("/login?setup=success");
            }
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isChecking) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-muted-foreground">Vérification de l'état du système...</p>
                </div>
            </div>
        );
    }

    if (setupNeeded === false) {
        return null; // The useEffect will redirect
    }

    return (
        <div className="min-h-screen bg-background flex py-12 px-4 sm:px-6 lg:px-8 justify-center">
            <div className="w-full max-w-3xl">
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 mb-5">
                            <GraduationCap className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold text-foreground mb-2">
                            Bienvenue sur EduPilot
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Création du compte Super Administrateur
                        </p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            role="alert"
                            className="flex items-start gap-2 p-4 mb-8 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]"
                        >
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="text-sm font-medium">{error}</div>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
                        {/* Section Administrateur */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 border-b border-border pb-2">
                                <User className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-semibold text-foreground">Super Administrateur</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">Prénom</Label>
                                    <Input
                                        id="firstName"
                                        
                                        {...register("firstName")}
                                        aria-invalid={!!errors.firstName}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Ce prénom sera utilisé dans toutes les interfaces administrateur.
                                    </p>
                                    {errors.firstName && (
                                        <p className="text-sm text-destructive">{errors.firstName.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Nom</Label>
                                    <Input
                                        id="lastName"
                                        
                                        {...register("lastName")}
                                        aria-invalid={!!errors.lastName}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Utilisez le nom légal de la personne responsable de la plateforme.
                                    </p>
                                    {errors.lastName && (
                                        <p className="text-sm text-destructive">{errors.lastName.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="email">Email de connexion</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        
                                        autoComplete="email"
                                        {...register("email")}
                                        aria-invalid={!!errors.email}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Cet email servira d'identifiant principal pour le Super Administrateur.
                                    </p>
                                    {errors.email && (
                                        <p className="text-sm text-destructive">{errors.email.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Mot de passe</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        autoComplete="new-password"
                                        {...register("password")}
                                        aria-invalid={!!errors.password}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Choisissez un mot de passe long et unique, réservé à la gestion globale du système.
                                    </p>
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
                                    <p className="text-xs text-muted-foreground">
                                        Confirmez exactement le même mot de passe pour éviter toute erreur de saisie.
                                    </p>
                                    {errors.confirmPassword && (
                                        <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-lg font-medium mt-8"
                            size="lg"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                                    Initialisation du système...
                                </>
                            ) : (
                                <>
                                    Compléter l'installation
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
