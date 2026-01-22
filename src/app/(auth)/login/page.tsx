"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        email: "",
        password: ""
    });
    const router = useRouter();

    async function onSubmit(event: React.SyntheticEvent) {
        event.preventDefault();
        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email: formData.email.toLowerCase(),
                password: formData.password,
                redirect: false,
            });

            if (result?.error) {
                toast.error("Identifiants incorrects", {
                    description: "Vérifiez votre email et mot de passe."
                });
                setIsLoading(false);
                return;
            }

            if (result?.ok) {
                toast.success("Connexion réussie", {
                    description: "Redirection vers le tableau de bord..."
                });
                router.refresh();
                router.push("/dashboard");
            }
        } catch (error) {
            toast.error("Erreur de connexion", {
                description: "Une erreur inattendue est survenue."
            });
            setIsLoading(false);
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    return (
        <>
            <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Bienvenue</h1>
                <p className="text-sm text-muted-foreground">
                    Entrez vos identifiants pour accéder à votre espace
                </p>
            </div>
            <div className="grid gap-6">
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                placeholder="nom@exemple.com"
                                type="email"
                                autoCapitalize="none"
                                autoComplete="email"
                                autoCorrect="off"
                                disabled={isLoading}
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Mot de passe</Label>
                                <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">
                                    Oublié ?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                disabled={isLoading}
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <Button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white" variant="default">
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Se connecter
                        </Button>
                    </div>
                </form>

                <p className="px-8 text-center text-sm text-muted-foreground">
                    Pas encore de compte ?{" "}
                    <Link href="/register" className="underline underline-offset-4 hover:text-blue-600 font-medium">
                        S&apos;inscrire
                    </Link>
                </p>
            </div>
        </>
    );
}
