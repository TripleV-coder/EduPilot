"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { z } from "zod";
import { Bell, CheckCircle, Mail, Save, Smartphone } from "lucide-react";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetcher } from "@/lib/fetcher";

const notificationPreferencesSchema = z.object({
  securityNewLogin: z.boolean(),
  securityUpdates: z.boolean(),
  weeklyDigest: z.boolean(),
  productUpdates: z.boolean(),
  inAppMessages: z.boolean(),
  criticalSms: z.boolean(),
});

type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

type ProfileResponse = {
  preferences?: Record<string, unknown> | null;
};

type NotificationsResponse = {
  unreadCount?: number;
};

const defaultPreferences: NotificationPreferences = {
  securityNewLogin: true,
  securityUpdates: true,
  weeklyDigest: true,
  productUpdates: false,
  inAppMessages: true,
  criticalSms: true,
};

export default function NotificationsSettingsPage() {
  const { data: profileData, mutate } = useSWR<ProfileResponse>("/api/user/profile", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: notificationsData } = useSWR<NotificationsResponse>("/api/notifications?unread=true&limit=1", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedPreferences =
      profileData?.preferences?.notifications &&
      typeof profileData.preferences.notifications === "object"
        ? profileData.preferences.notifications
        : null;

    if (!storedPreferences) return;

    const parsed = notificationPreferencesSchema.safeParse(storedPreferences);
    if (parsed.success) {
      setPreferences(parsed.data);
    }
  }, [profileData]);

  const unreadCount = useMemo(() => notificationsData?.unreadCount || 0, [notificationsData]);

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const validatedPreferences = notificationPreferencesSchema.parse(preferences);

    const currentPreferences =
      profileData?.preferences && typeof profileData.preferences === "object"
        ? profileData.preferences
        : {};
    const nextPreferences = {
      ...currentPreferences,
      notifications: validatedPreferences,
    };

    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextPreferences }),
      });

      await mutate({ ...(profileData || {}), preferences: nextPreferences }, false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Préférences de notifications"
          description="Choisissez quels signaux vous recevez et sur quels canaux ils sont transmis."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Paramètres", href: "/dashboard/settings" },
            { label: "Notifications" },
          ]}
        />

        {saved ? (
          <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] px-4 py-3 text-sm text-[hsl(var(--success))]">
            <CheckCircle className="h-4 w-4" />
            Préférences enregistrées avec succès.
          </div>
        ) : null}

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-primary" />
              Centre in-app
            </CardTitle>
            <CardDescription>
              {unreadCount > 0
                ? `${unreadCount} notification(s) non lue(s) dans votre centre de notifications.`
                : "Aucune notification non lue pour le moment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base text-foreground">Messages et annonces in-app</Label>
                <p className="text-sm text-muted-foreground">
                  Active l'affichage temps réel dans le centre de notifications et les badges du header.
                </p>
              </div>
              <Switch
                checked={preferences.inAppMessages}
                onCheckedChange={(checked) => updatePreference("inAppMessages", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              Email
            </CardTitle>
            <CardDescription>
              Les emails de sécurité restent recommandés. Les autres préférences sont stockées sur votre profil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base text-foreground">Nouvelle connexion détectée</Label>
                <p className="text-sm text-muted-foreground">Email lors d'une connexion inhabituelle.</p>
              </div>
              <Switch
                checked={preferences.securityNewLogin}
                onCheckedChange={(checked) => updatePreference("securityNewLogin", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base text-foreground">Alertes de sécurité et conformité</Label>
                <p className="text-sm text-muted-foreground">Maintenance, RGPD et évènements sensibles de compte.</p>
              </div>
              <Switch
                checked={preferences.securityUpdates}
                onCheckedChange={(checked) => updatePreference("securityUpdates", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base text-foreground">Digest hebdomadaire</Label>
                <p className="text-sm text-muted-foreground">Résumé académique et vie scolaire de la semaine.</p>
              </div>
              <Switch
                checked={preferences.weeklyDigest}
                onCheckedChange={(checked) => updatePreference("weeklyDigest", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base text-foreground">Nouveautés EduPilot</Label>
                <p className="text-sm text-muted-foreground">Communications produit non critiques.</p>
              </div>
              <Switch
                checked={preferences.productUpdates}
                onCheckedChange={(checked) => updatePreference("productUpdates", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-primary" />
              SMS d'urgence
            </CardTitle>
            <CardDescription>
              Réservé aux alertes critiques de l'établissement, incident grave ou dette critique.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-6">
            <div className="space-y-1">
              <Label className="text-base text-foreground">Activer les SMS critiques</Label>
              <p className="text-sm text-muted-foreground">
                Les SMS classiques restent gérés par les campagnes dédiées et les droits métier.
              </p>
            </div>
            <Switch
              checked={preferences.criticalSms}
              onCheckedChange={(checked) => updatePreference("criticalSms", checked)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => void handleSave()} disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Enregistrement..." : "Enregistrer les préférences"}
          </Button>
        </div>
      </div>
    </PageGuard>
  );
}
