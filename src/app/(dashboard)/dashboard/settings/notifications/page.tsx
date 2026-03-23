"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Bell, Mail, Smartphone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function NotificationsSettingsPage() {
    return (
        <PageGuard permission={["*" as Permission] /* Accessible by everyone */}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Préférences de Notifications"
                    description="Choisissez comment et pour quelles raisons vous souhaitez être contacté."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Notifications" },
                    ]}
                />

                <div className="grid gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Bell className="w-5 h-5 text-primary" />
                                Alertes Système et Sécurité
                            </CardTitle>
                            <CardDescription>Notifications critiques liées à votre compte et à l'établissement.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-foreground">Nouvelle connexion détectée</Label>
                                    <p className="text-sm text-muted-foreground">Recevoir un email lorsqu'un appareil non reconnu se connecte.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-foreground">Mises à jour de sécurité</Label>
                                    <p className="text-sm text-muted-foreground">Alertes de maintenance EduPilot et changements RGPD.</p>
                                </div>
                                <Switch defaultChecked disabled />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Mail className="w-5 h-5 text-primary" />
                                Rapports par Email
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-foreground">Rapport d'activité hebdomadaire</Label>
                                    <p className="text-sm text-muted-foreground">Résumé des absences, notes et événements de la semaine.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-foreground">Nouveautés et Annonces</Label>
                                    <p className="text-sm text-muted-foreground">Marketing EduPilot, nouvelles fonctionnalités.</p>
                                </div>
                                <Switch />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-primary" />
                                Push & SMS
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-foreground">Notifications In-App (Navigateur)</Label>
                                    <p className="text-sm text-muted-foreground">Être notifié d'un message entrant lorsque vous êtes connecté.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-foreground">Alertes SMS d'urgence</Label>
                                    <p className="text-sm text-muted-foreground">Seulement pour les communications critiques de l'établissement.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t border-border py-4 flex justify-end">
                            <Button className="gap-2 shadow-sm">
                                <Save className="w-4 h-4" /> Enregistrer les préférences
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
