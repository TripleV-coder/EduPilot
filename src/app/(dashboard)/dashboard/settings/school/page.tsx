"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Building2, Save, Upload, MapPin, Mail, Phone, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export default function SchoolProfilePage() {
    const { data: cities } = useSWR("/api/reference/cities", fetcher);

    return (
        <PageGuard permission={[Permission.SCHOOL_UPDATE]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Profil de l'Établissement"
                    description="Gérez les informations publiques de votre école, le logo et les contacts officiels."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Profil École" },
                    ]}
                />

                <form className="grid gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-primary" />
                                Logo et Identité Visuelle
                            </CardTitle>
                            <CardDescription>Ce logo sera utilisé sur les bulletins, reçus et l'interface.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-6">
                            <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer">
                                <div className="flex flex-col items-center">
                                    <Upload className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-medium">Uploader</span>
                                </div>
                            </div>
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="schoolName">Nom Officiel de l'Établissement</Label>
                                <Input id="schoolName" defaultValue="Complexe Scolaire Jean E." className="font-semibold bg-background" />

                                <Label htmlFor="tagline" className="mt-4 block">Devise / Slogan (Optionnel)</Label>
                                <Input id="tagline" defaultValue="Excellence - Rigueur - Réussite" className="bg-background" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-primary" />
                                Coordonnées & Adresse
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-muted-foreground" /> Email de Scolarité
                                    </Label>
                                    <Input id="email" type="email" defaultValue="contact@csjem.sn" className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-muted-foreground" /> Téléphone Principal
                                    </Label>
                                    <Input id="phone" type="tel" defaultValue="+221 33 800 00 00" className="bg-background" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Adresse Physique</Label>
                                <Textarea
                                    id="address"
                                    defaultValue="Quartier Mermoz, BP 1234, Dakar, Sénégal"
                                    className="bg-background min-h-[80px]"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">Ville</Label>
                                    <Input id="city" defaultValue="Dakar" list="cities-list" className="bg-background" />
                                    <datalist id="cities-list">
                                        {Array.isArray(cities) && cities.map((c: string) => (
                                            <option key={c} value={c} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="inspection">Inspection Académique (IA)</Label>
                                    <Input id="inspection" defaultValue="IA de Dakar" className="bg-background" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="registrationNumber">N° d'Agrément / Déclaration</Label>
                                    <Input id="registrationNumber" defaultValue="AGR-2004-DKR-145" className="bg-background font-mono text-sm" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t border-border mt-2 py-4 flex justify-end">
                            <Button className="gap-2 shadow-sm">
                                <Save className="w-4 h-4" /> Enregistrer le profil
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </div>
        </PageGuard>
    );
}
