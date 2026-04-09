"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Info, Cpu, Database, Blocks, ShieldCheck, Server } from "lucide-react";

export default function SystemInfoPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Informations Système"
                    description="Détails de l'instance, versions et caractéristiques techniques"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Système" },
                        { label: "Informations" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/30 border-b border-border">
                            <CardTitle className="flex items-center gap-2">
                                <Info className="w-5 h-5 text-primary" />
                                Instance EduPilot
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground">Version Application</span>
                                <span className="font-medium font-mono text-foreground">v2.4.1 (Stable)</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground">Dernière mise à jour</span>
                                <span className="font-medium text-foreground">12 Mai 2024</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground">Licence</span>
                                <span className="font-medium text-[hsl(var(--success))]">Entreprise (Active)</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Environnement</span>
                                <span className="font-medium text-foreground">Production</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/30 border-b border-border">
                            <CardTitle className="flex items-center gap-2">
                                <Blocks className="w-5 h-5 text-primary" />
                                Modules Installés
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-foreground">Core & Académique</span>
                                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">v2.4</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-foreground">Finance & Facturation</span>
                                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">v1.8</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-foreground">IA Assistant (Ollama)</span>
                                <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-600 rounded-full">Bêta</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-foreground">Portail Parent/Élève</span>
                                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">v2.1</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm md:col-span-2">
                        <CardHeader className="bg-muted/30 border-b border-border">
                            <CardTitle className="flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-primary" />
                                Caractéristiques Techniques
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Database className="w-4 h-4" /> Base de données
                                </span>
                                <span className="font-medium font-mono text-foreground">PostgreSQL 15</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Server className="w-4 h-4" /> Serveur Web
                                </span>
                                <span className="font-medium font-mono text-foreground">Node.js / Next.js 14</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> Certificat SSL
                                </span>
                                <span className="font-medium text-[hsl(var(--success))]">Valide (Let's Encrypt)</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-muted-foreground">Système d'exploitation</span>
                                <span className="font-medium font-mono text-foreground">Linux x64</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
