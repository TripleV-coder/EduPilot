"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { ShieldCheck, KeyRound, Smartphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function SecuritySettingsPage() {
    return (
        <PageGuard permission={["*" as Permission] /* Accessible by everyone */}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Sécurité & Connexion"
                    description="Gérez votre mot de passe et l'authentification à double facteur (2FA)."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Sécurité" },
                    ]}
                />

                <div className="grid gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Smartphone className="w-5 h-5 text-primary" />
                                    Authentification à Double Facteur (2FA)
                                </CardTitle>
                                <CardDescription className="mt-1">Protégez votre compte avec une étape de sécurité supplémentaire.</CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">
                                Activée
                            </Badge>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="p-4 bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] rounded-lg flex gap-3 text-[hsl(var(--success))] text-sm">
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <p>
                                    L'authentification 2FA est actuellement configurée via une application d'authentification (Google Authenticator, Authy, etc.).
                                </p>
                            </div>
                            <div className="mt-6 flex gap-3 flex-col sm:flex-row">
                                <Button variant="outline" className="border-border">Afficher les codes de récupération</Button>
                                <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30">Désactiver la 2FA</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <KeyRound className="w-5 h-5 text-primary" />
                                Changer de mot de passe
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2 max-w-md">
                                <Label htmlFor="current">Mot de passe actuel</Label>
                                <Input id="current" type="password" className="bg-background" />
                            </div>

                            <div className="pt-2" />

                            <div className="space-y-2 max-w-md">
                                <Label htmlFor="new">Nouveau mot de passe</Label>
                                <Input id="new" type="password" className="bg-background" />
                            </div>
                            <div className="space-y-2 max-w-md">
                                <Label htmlFor="confirm">Confirmer le nouveau mot de passe</Label>
                                <Input id="confirm" type="password" className="bg-background" />
                            </div>

                            <div className="p-4 mt-2 bg-muted/30 border border-border rounded-lg max-w-md text-xs text-muted-foreground flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                                <p>Le mot de passe doit comporter au moins 8 caractères, dont une majuscule, un chiffre et un caractère spécial.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t border-border py-4">
                            <Button>Mettre à jour le mot de passe</Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
