"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Globe, Clock, Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

const STORAGE_KEY = "edupilot-locale-prefs";

interface LocalePrefs {
    language: string;
    timezone: string;
    dateformat: string;
    currency: string;
}

const defaults: LocalePrefs = {
    language: "fr",
    timezone: "gmt",
    dateformat: "dmy",
    currency: "xof",
};

export default function LocaleSettingsPage() {
    const { data: profileData, mutate } = useSWR("/api/user/profile", fetcher);

    const [language, setLanguage] = useState(defaults.language);
    const [timezone, setTimezone] = useState(defaults.timezone);
    const [dateformat, setDateformat] = useState(defaults.dateformat);
    const [currency, setCurrency] = useState(defaults.currency);
    const [saved, setSaved] = useState(false);

    // Load saved preferences from profile
    useEffect(() => {
        if (profileData?.preferences?.locale) {
            const prefs = profileData.preferences.locale;
            queueMicrotask(() => {
                if (prefs.language) setLanguage(prefs.language);
                if (prefs.timezone) setTimezone(prefs.timezone);
                if (prefs.dateformat) setDateformat(prefs.dateformat);
                if (prefs.currency) setCurrency(prefs.currency);
            });
        }
    }, [profileData]);

    const handleSave = async () => {
        const localePrefs: LocalePrefs = { language, timezone, dateformat, currency };

        try {
            const currentPrefs = profileData?.preferences || {};
            const updatedPrefs = { ...currentPrefs, locale: localePrefs };

            await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferences: updatedPrefs }),
            });

            mutate({ ...profileData, preferences: updatedPrefs }, false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error("Failed to save locale preferences:", error);
        }
    };

    return (
        <PageGuard permission={["*" as Permission] /* Accessible by everyone */}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Langue & Région"
                    description="Configurez la langue de l'interface et le format des dates."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Localisation" },
                    ]}
                />

                {saved && (
                    <div className="p-3 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4" /> Préférences enregistrées avec succès.
                    </div>
                )}

                <div className="grid gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Globe className="w-5 h-5 text-primary" />
                                Langue de l'interface
                            </CardTitle>
                            <CardDescription>
                                Cette modification ne s'applique qu'à votre compte personnel.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-3 max-w-md">
                                <Label htmlFor="lang">Langue</Label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger id="lang" className="bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fr">Français (France)</SelectItem>
                                        <SelectItem value="en">English (US)</SelectItem>
                                        <SelectItem value="es">Español</SelectItem>
                                        <SelectItem value="ar">العربية (Arabic) - Bêta</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                Formats & Fuseau horaire
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6 max-w-md">
                            <div className="space-y-3">
                                <Label htmlFor="timezone">Fuseau horaire</Label>
                                <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger id="timezone" className="bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gmt">GMT (Dakar, Abidjan)</SelectItem>
                                        <SelectItem value="gmt1">GMT+1 (Paris, Kinshasa)</SelectItem>
                                        <SelectItem value="gmt2">GMT+2 (Kigali, Bujumbura)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="dateformat">Format de date</Label>
                                <Select value={dateformat} onValueChange={setDateformat}>
                                    <SelectTrigger id="dateformat" className="bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dmy">JJ/MM/AAAA (ex: 24/05/2024)</SelectItem>
                                        <SelectItem value="mdy">MM/JJ/AAAA (ex: 05/24/2024)</SelectItem>
                                        <SelectItem value="ymd">AAAA-MM-JJ (ex: 2024-05-24)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="currency">Devise d'affichage (Visuel uniquement)</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger id="currency" className="bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="xof">FCFA (XOF)</SelectItem>
                                        <SelectItem value="eur">Euro (€)</SelectItem>
                                        <SelectItem value="usd">Dollar Américain ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t border-border py-4">
                            <Button className="gap-2" onClick={handleSave}>
                                <Save className="w-4 h-4" /> Enregistrer les préférences
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
