"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function RegisterPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstname: "",
        lastname: "",
        email: "",
        password: ""
    });
    const router = useRouter();

    async function onSubmit(event: React.SyntheticEvent) {
        event.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    firstName: formData.firstname,
                    lastName: formData.lastname,
                    email: formData.email.toLowerCase(),
                    password: formData.password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                toast.error("Erreur d'inscription", {
                    description: data.error || "Une erreur est survenue."
                });
                setIsLoading(false);
                return;
            }

            toast.success("Système initialisé avec succès !", {
                description: "Vous êtes maintenant le Super Administrateur."
            });
            router.push("/login");

        } catch (error) {
            toast.error("Erreur serveur", {
                description: "Impossible de contacter le serveur."
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
                <div className="mx-auto p-3 rounded-full bg-red-500/10 mb-2">
                    <ShieldAlert className="h-8 w-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Configuration Initiale</h1>
                <p className="text-sm text-muted-foreground">
                    Créez le compte <strong>Super Administrateur</strong>.
                </p>
                <p className="text-xs text-red-500 font-bold">
                    ⚠️ Cette page se désactivera définitivement après la création.
                </p>
            </div>
            <div className="grid gap-6 mt-4">
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="firstname">Prénom</Label>
                                <Input
                                    id="firstname"
                                    placeholder="Votre prénom"
                                    disabled={isLoading}
                                    value={formData.firstname}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="lastname">Nom</Label>
                                <Input
                                    id="lastname"
                                    placeholder="Votre nom"
                                    disabled={isLoading}
                                    value={formData.lastname}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                placeholder="admin@edupilot.bj"
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
                            <Label htmlFor="password">Mot de passe Maître</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="Minimum 8 caractères"
                                disabled={isLoading}
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={8}
                            />
                        </div>
                        <Button disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold" variant="default">
                            {isLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            👑 Initialiser le Système
                        </Button>
                    </div>
                </form>

                <p className="px-8 text-center text-sm text-muted-foreground">
                    Déjà initialisé ?{" "}
                    <Link href="/login" className="underline underline-offset-4 hover:text-primary font-medium">
                        Se connecter
                    </Link>
                </p>
            </div>
        </>
    );
}
