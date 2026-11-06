"use client";

import Link from "next/link";
import useSWR from "swr";
import { Bell, Mail } from "lucide-react";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PushDeviceCard } from "@/components/settings/push-device-card";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

type NotificationsResponse = {
  unreadCount?: number;
};

/**
 * Notifications : uniquement des réglages qui ont un effet. Les six
 * interrupteurs d'avant (résumé hebdomadaire, alerte de nouvelle connexion,
 * SMS critiques…) étaient enregistrés sans que rien ne les lise.
 */
export default function NotificationsSettingsPage() {
  // Garde avant chargement (TD-024) : aucune requête tant que le rôle n'est pas admis.
  return (
    <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
      <NotificationsSettingsPageContent />
    </PageGuard>
  );
}

function NotificationsSettingsPageContent() {
  const { data: notificationsData, error: notificationsError } = useSWR<NotificationsResponse>(
    "/api/notifications?unread=true&limit=1",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 },
  );
  const unreadCount = notificationsData?.unreadCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Où et comment l'établissement vous prévient."
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Paramètres", href: "/dashboard/settings" },
          { label: "Notifications" },
        ]}
      />

      <PushDeviceCard />

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            Centre de notifications
          </CardTitle>
          <CardDescription>
            {notificationsError
              ? "Le nombre de notifications non lues n'a pas pu être chargé."
              : notificationsData === undefined
                ? "Chargement…"
                : unreadCount > 0
                  ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}.`
                  : "Aucune notification non lue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <p className="text-sm text-muted-foreground">
            Toutes les notifications restent consultables ici, qu&apos;elles soient arrivées en push ou non.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/notifications">Ouvrir le centre</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            E-mails, SMS et messages de l&apos;établissement
          </CardTitle>
          <CardDescription>Ces envois ne se règlent pas ici.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">E-mails de sécurité</span> — réinitialisation du mot de passe,
            lien d&apos;activation du compte : toujours envoyés, ils protègent votre accès.
          </p>
          <p>
            <span className="font-medium text-foreground">SMS, WhatsApp et messages vocaux</span> — envoyés par votre
            établissement (absences, rappels de paiement, convocations) selon ses propres règles. Pour ne plus les
            recevoir, adressez-vous à l&apos;établissement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
