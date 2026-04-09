"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Server, Cpu, HardDrive, Users, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SystemMonitoringPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Monitoring Système"
                    description="Surveillance en temps réel des performances des serveurs et de l'application"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Système" },
                        { label: "Monitoring" },
                    ]}
                />

                {/* Global Status */}
                <div className="flex items-center gap-3 p-4 bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border border-[hsl(var(--success-border))] rounded-xl shadow-sm">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold">Tous les systèmes sont opérationnels</h3>
                        <p className="text-sm opacity-90 mt-0.5">Dernier incident critique: Aucun signalement dans les 30 derniers jours.</p>
                    </div>
                </div>

                {/* Live Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Charge CPU</p>
                                    <p className="text-2xl font-bold text-foreground">12.4%</p>
                                </div>
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Cpu className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: '12.4%' }} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Mémoire RAM</p>
                                    <p className="text-2xl font-bold text-foreground">42%</p>
                                </div>
                                <div className="p-2 bg-orange-500/10 text-orange-600 rounded-lg">
                                    <Server className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">1.7 GB / 4.0 GB Utilisés</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Espace Disque (DB)</p>
                                    <p className="text-2xl font-bold text-foreground">18.5 GB</p>
                                </div>
                                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                                    <HardDrive className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">Environ 12% d'augmentation ce mois</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-muted-foreground">Sessions Actives</p>
                                    <p className="text-2xl font-bold text-foreground">142</p>
                                </div>
                                <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
                                    <Users className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">+32 connexions la dernière heure</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Services Status */}
                <Card className="border-border shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            État des micro-services
                        </CardTitle>
                        <CardDescription>
                            Latence et disponibilité des différents modules de la plateforme.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg">
                                <div>
                                    <h4 className="font-medium text-foreground">Core API</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Authentification, Utilisateurs, Sécurité</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-muted-foreground font-mono">45ms</span>
                                    <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">En ligne</Badge>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg">
                                <div>
                                    <h4 className="font-medium text-foreground">Finance Service</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Facturation, Paiements, Passereaux</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-muted-foreground font-mono">112ms</span>
                                    <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">En ligne</Badge>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg">
                                <div>
                                    <h4 className="font-medium text-foreground">Email / SMS Dispatcher</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Envoi de notifications asynchrones</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-muted-foreground font-mono">--</span>
                                    <Badge variant="outline" className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] border-[hsl(var(--success-border))] font-normal">En ligne</Badge>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
