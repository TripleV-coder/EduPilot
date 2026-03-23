"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { User, Mail, Phone, Upload, Save, UserCircle, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export default function ProfileSettingsPage() {
    const { data: session, status, update: updateSession } = useSession();

    const { data: profileData, error: profileError, isLoading: profileLoading } = useSWR("/api/user/profile", fetcher);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [avatar, setAvatar] = useState<string | null>(null);

    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Initialize form fields from profile data
    useEffect(() => {
        if (profileData) {
            setFirstName(profileData.firstName || "");
            setLastName(profileData.lastName || "");
            setEmail(profileData.email || "");
            setPhone(profileData.phone || "");
            setAvatar(profileData.avatar || null);
        }
    }, [profileData]);

    // Compute initials from real user name
    const initials = [firstName, lastName]
        .map((n) => n.charAt(0).toUpperCase())
        .join("");

    async function handleSave() {
        setSaving(true);
        setSuccessMsg(null);
        setErrorMsg(null);

        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firstName, lastName, phone: phone || null, avatar }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Erreur lors de la sauvegarde");
            }

            // Update the client-side session so changes reflect immediately everywhere
            await updateSession();

            setSuccessMsg("Profil mis a jour avec succes !");
            setTimeout(() => setSuccessMsg(null), 4000);
        } catch (err: any) {
            setErrorMsg(err.message || "Erreur lors de la sauvegarde");
            setTimeout(() => setErrorMsg(null), 5000);
        } finally {
            setSaving(false);
        }
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            setErrorMsg("L'image ne doit pas depasser 2MB.");
            setTimeout(() => setErrorMsg(null), 5000);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatar(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setAvatar(null);
    };

    // Loading state while session and profile are being fetched
    if (status === "loading" || profileLoading) {
        return (
            <PageGuard permission={["*" as Permission]}>
                <div className="space-y-6 max-w-4xl mx-auto">
                    <PageHeader
                        title="Mon Profil"
                        description="Gerez vos informations personnelles et vos coordonnees."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Parametres", href: "/dashboard/settings" },
                            { label: "Profil" },
                        ]}
                    />
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="ml-3 text-muted-foreground">Chargement du profil...</span>
                    </div>
                </div>
            </PageGuard>
        );
    }

    // Error state
    if (profileError) {
        return (
            <PageGuard permission={["*" as Permission]}>
                <div className="space-y-6 max-w-4xl mx-auto">
                    <PageHeader
                        title="Mon Profil"
                        description="Gerez vos informations personnelles et vos coordonnees."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Parametres", href: "/dashboard/settings" },
                            { label: "Profil" },
                        ]}
                    />
                    <div className="flex items-center justify-center py-20">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                        <span className="ml-3 text-destructive">Erreur lors du chargement du profil</span>
                    </div>
                </div>
            </PageGuard>
        );
    }

    return (
        <PageGuard permission={["*" as Permission] /* Accessible by everyone */}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Mon Profil"
                    description="Gerez vos informations personnelles et vos coordonnees."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Parametres", href: "/dashboard/settings" },
                        { label: "Profil" },
                    ]}
                />

                {/* Success message */}
                {successMsg && (
                    <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] px-4 py-3 text-sm">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        {successMsg}
                    </div>
                )}

                {/* Error message */}
                {errorMsg && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive px-4 py-3 text-sm">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <div className="grid gap-6">
                    {/* Profile Picture Card */}
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <UserCircle className="w-5 h-5 text-primary" />
                                Photo de profil
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-6">
                            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-4 border-background shadow-sm overflow-hidden relative">
                                {avatar ? (
                                    <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    initials || "??"
                                )}
                            </div>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Button variant="outline" className="gap-2 relative overflow-hidden">
                                        <Upload className="w-4 h-4" /> Changer l&apos;image
                                        <Input
                                            type="file"
                                            accept="image/png, image/jpeg, image/gif"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={handleImageChange}
                                        />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={handleRemoveImage}
                                        disabled={!avatar}
                                    >
                                        Supprimer
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground">JPG, GIF ou PNG. Taille maximale 2MB.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Basic Information Card */}
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/10 border-b border-border">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5 text-primary" />
                                Informations de base
                            </CardTitle>
                            <CardDescription>Mettez a jour vos informations publiques.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">Prenom</Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="bg-background"
                                        
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Nom</Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="bg-background"
                                        
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-muted-foreground" /> Email de contact
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        disabled
                                        className="bg-muted/50 cursor-not-allowed"
                                        title="L'email ne peut pas etre modifie"
                                    />
                                    <p className="text-xs text-muted-foreground">L&apos;email ne peut pas etre modifie.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-muted-foreground" /> Telephone
                                    </Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="bg-background"
                                        
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t border-border mt-2 py-4 flex justify-end">
                            <Button
                                className="gap-2 shadow-sm"
                                onClick={handleSave}
                                disabled={saving || !firstName.trim() || !lastName.trim()}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
