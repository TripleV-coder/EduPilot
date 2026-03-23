"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck, AlertCircle, ArrowRight, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const enableMfaSchema = z.object({
    token: z.string().length(6, "Le code doit contenir 6 chiffres"),
});

type EnableMfaFormData = z.infer<typeof enableMfaSchema>;

export default function MfaSetupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(true);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<EnableMfaFormData>({
        resolver: zodResolver(enableMfaSchema),
    });

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
            } catch (err) {
                setError("Erreur de connexion au serveur.");
            } finally {
                setIsGenerating(false);
            }
        };

        generateMfa();
    }, []);

    const onSubmit = async (data: EnableMfaFormData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/auth/mfa/setup?action=enable", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: data.token, secret }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                if (response.status === 401) {
                    router.replace("/login");
                    return;
                }
                setError(result.message || result.error || "Une erreur est survenue lors de l'activation.");
            } else {
                setBackupCodes(result.backupCodes);
            }
        } catch (err) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Copié dans le presse-papiers !");
    };

    if (isGenerating) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                    <p className="text-muted-foreground">Génération de la configuration MFA...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-lg">
                <div className="bg-card border border-border rounded-2xl shadow-lg p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 mb-5">
                            <ShieldCheck className="w-7 h-7 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Authentification à Deux Facteurs (2FA)
                        </h1>
                        <p className="text-muted-foreground">
                            Sécurisez votre compte en activant la vérification en deux étapes.
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

                    {backupCodes ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-6"
                        >
                            <div className="flex flex-col items-center text-center p-6 bg-[hsl(var(--success-bg))] rounded-xl border border-[hsl(var(--success-border))]">
                                <CheckCircle2 className="w-12 h-12 text-[hsl(var(--success))] mb-3" />
                                <h2 className="text-xl font-semibold text-[hsl(var(--success))]">MFA Activé avec Succès</h2>
                                <p className="text-sm text-[hsl(var(--success))]/80 mt-2">
                                    Votre compte est maintenant protégé par l'authentification à deux facteurs.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg border-b border-border pb-2">Codes de secours (Très Important)</h3>
                                <p className="text-sm text-muted-foreground">
                                    Copiez et conservez ces codes en lieu sûr. Ils vous permettront de vous connecter si vous perdez votre appareil d'authentification.
                                    <strong> Ils ne seront affichés qu'une seule fois.</strong>
                                </p>

                                <div className="bg-muted p-4 rounded-lg border border-border mt-4">
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {backupCodes.map((code, idx) => (
                                            <div key={idx} className="font-mono text-sm tracking-wider text-center py-2 px-3 bg-background rounded border border-border shadow-sm">
                                                {code}
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full flex items-center justify-center gap-2"
                                        onClick={() => copyToClipboard(backupCodes.join('\n'))}
                                    >
                                        <Copy className="w-4 h-4" /> Copier tous les codes
                                    </Button>
                                </div>
                            </div>

                            <Button
                                className="w-full mt-6"
                                size="lg"
                                onClick={() => router.push("/dashboard")}
                            >
                                Aller au tableau de bord
                            </Button>
                        </motion.div>
                    ) : (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                                    <div>
                                        <h3 className="font-medium text-foreground">Scannez le code QR</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Ouvrez votre application d'authentification (Google Authenticator, Authy, etc.) et scannez ce code QR.
                                        </p>
                                    </div>
                                </div>

                                {qrCode && (
                                    <div className="flex justify-center p-4 bg-white rounded-xl border border-border shadow-sm mx-auto max-w-[200px]">
                                        <Image src={qrCode} alt="QR Code MFA" width={200} height={200} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                                    <div>
                                        <h3 className="font-medium text-foreground">Entrez le code de vérification</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Saisissez le code à 6 chiffres généré par votre application pour confirmer la configuration.
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit(onSubmit)} className="pl-12 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="token" className="sr-only">Code à 6 chiffres</Label>
                                        <Input
                                            id="token"
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={6}
                                            
                                            className="text-center text-2xl tracking-[0.5em] font-mono h-14"
                                            {...register("token")}
                                            aria-invalid={!!errors.token}
                                        />
                                        {errors.token && (
                                            <p className="text-sm text-destructive">{errors.token.message}</p>
                                        )}
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        size="lg"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                Vérification...
                                            </>
                                        ) : (
                                            <>
                                                Activer la 2FA
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </div>

                            <div className="text-center pt-4 border-t border-border">
                                <Button variant="ghost" className="text-muted-foreground" onClick={() => router.push('/dashboard')}>
                                    Plus tard
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
