"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, CheckCircle2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [setupAvailable, setSetupAvailable] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    if (searchParams?.get("setup") === "success") {
      setSuccessMessage("Configuration initiale réussie. Vous pouvez maintenant vous connecter.");
      return;
    }
    if (searchParams?.get("reset") === "1") {
      setSuccessMessage("Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.");
      return;
    }
    if (searchParams?.get("firstLogin") === "1") {
      setSuccessMessage("Compte activé avec succès. Connectez-vous avec votre nouveau mot de passe.");
      return;
    }
    setSuccessMessage(null);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/initial-setup", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setSetupAvailable(Boolean(data?.setupNeeded));
      } catch {
        if (!cancelled) setSetupAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 mb-5">
          <GraduationCap className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Bon retour !
        </h1>
        <p className="text-muted-foreground">
          Connectez-vous pour accéder à votre espace
        </p>
      </div>

      {/* Success message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-center gap-2 p-4 mb-6 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))]"
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{successMessage}</span>
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-2 p-4 mb-6 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-[hsl(var(--error))]"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}

      {/* Form */}
      <form method="POST" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium">
            Adresse email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              
              autoComplete="email"
              className="pl-10"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Utilisez l'email fourni par votre établissement pour accéder à EduPilot.
          </p>
          {errors.email && (
            <p id="email-error" role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-foreground font-medium">
              Mot de passe
            </Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              
              autoComplete="current-password"
              className="pl-10 pr-10"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ne partagez jamais votre mot de passe. Contactez l'administration en cas de doute.
          </p>
          {errors.password && (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          variant="default"
          className="w-full h-11 font-semibold text-base"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
              Connexion...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Se connecter
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </span>
          )}
        </Button>
      </form>

      {setupAvailable && (
        <>
          {/* Divider */}
          <div className="relative my-6" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* Lien configuration initiale */}
          <p className="text-center text-muted-foreground text-sm">
            Première installation ?{" "}
            <Link
              href="/setup"
              className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
            >
              Configurer le système
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center p-8" aria-label="Chargement en cours">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          EduPilot — Système de Gestion Scolaire Intelligent
        </p>
      </div>
    </div>
  );
}
