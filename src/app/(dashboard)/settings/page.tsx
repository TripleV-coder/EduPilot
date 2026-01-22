"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useApiMutation } from "@/hooks/use-api";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
                <p className="text-muted-foreground">Gérez votre profil, vos préférences et la sécurité de votre compte.</p>
            </div>

            <Tabs defaultValue="profile" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="profile">Profil</TabsTrigger>
                    {/* <TabsTrigger value="appearance">Apparence</TabsTrigger> */}
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    <TabsTrigger value="security">Sécurité</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                    <ProfileSettings />
                </TabsContent>
                <TabsContent value="appearance" className="space-y-4">
                    <AppearanceSettings />
                </TabsContent>
                <TabsContent value="notifications" className="space-y-4">
                    <NotificationSettings />
                </TabsContent>
                <TabsContent value="security" className="space-y-4">
                    <SecuritySettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function ProfileSettings() {
    const { data: session, update } = useSession();
    const [isLoading, setIsLoading] = useState(false);

    // Initialize form state with session data
    const [formData, setFormData] = useState({
        firstName: session?.user?.firstName || "",
        lastName: session?.user?.lastName || "",
        phone: session?.user?.phone || "",
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error("Erreur lors de la mise à jour");

            const updatedUser = await res.json();

            // Update session
            await update({
                ...session,
                user: { ...session?.user, ...updatedUser }
            });

            toast.success("Profil mis à jour avec succès");
        } catch (error) {
            toast.error("Impossible de mettre à jour le profil");
        } finally {
            setIsLoading(false);
        }
    };

    if (!session?.user) return null;

    return (
        <Card variant="glass">
            <CardHeader>
                <CardTitle>Informations Personnelles</CardTitle>
                <CardDescription>Gérez vos informations personnelles.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-20 w-20">
                            <AvatarImage src={session.user.image || ""} />
                            <AvatarFallback className="text-xl bg-primary/10 text-primary">
                                {(session.user.firstName?.[0] || "") + (session.user.lastName?.[0] || "")}
                            </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium">Photo de profil</h4>
                            <p className="text-xs text-muted-foreground">
                                Géré automatiquement via votre email (Gravatar).
                            </p>
                        </div>
                    </div>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Prénom</Label>
                            <Input
                                value={formData.firstName}
                                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nom</Label>
                            <Input
                                value={formData.lastName}
                                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Téléphone</Label>
                            <Input
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="+229..."
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={session.user.email || ""} disabled className="bg-muted" />
                            <p className="text-[10px] text-muted-foreground">L'email ne peut pas être modifié.</p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enregistrer les modifications
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function AppearanceSettings() {
    return (
        <Card variant="glass">
            <CardHeader>
                <CardTitle>Apparence</CardTitle>
                <CardDescription>Coming Soon (Thèmes personnalisés).</CardDescription>
            </CardHeader>
        </Card>
    );
}

function NotificationSettings() {
    return (
        <Card variant="glass">
            <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choisissez comment vous souhaitez être notifié.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Emails Système</Label>
                        <p className="text-xs text-muted-foreground">Rapports et alertes de sécurité.</p>
                    </div>
                    <Switch checked={true} disabled />
                </div>
            </CardContent>
        </Card>
    )
}

function SecuritySettings() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const changePasswordMutation = useApiMutation<any, any>(
        "/api/auth/password-change",
        "POST",
        {
            onSuccess: () => {
                toast.success("Mot de passe mis à jour avec succès");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            },
            onError: (err) => {
                toast.error(err.message || "Erreur lors du changement de mot de passe");
            }
        }
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Les nouveaux mots de passe ne correspondent pas");
            return;
        }

        changePasswordMutation.mutate({ currentPassword, newPassword });
    };

    return (
        <Card variant="glass">
            <CardHeader>
                <CardTitle>Sécurité</CardTitle>
                <CardDescription>Gérez votre mot de passe.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="current">Mot de passe actuel</Label>
                        <Input
                            id="current"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new">Nouveau mot de passe</Label>
                        <Input
                            id="new"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                        <Input
                            id="confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" variant="outline" disabled={changePasswordMutation.isPending}>
                            {changePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Mettre à jour le mot de passe
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
