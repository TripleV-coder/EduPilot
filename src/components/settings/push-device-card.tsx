"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { BellRing, Loader2 } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import {
    pushAvailability,
    subscribeThisDevice,
    unsubscribeThisDevice,
    type PushAvailability,
} from "@/lib/pwa/push-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PushServerState {
    configured: boolean;
    publicKey: string | null;
    devices: number;
}

type DeviceState = "checking" | "subscribed" | "not-subscribed" | "denied";

/**
 * Notifications push sur CET appareil : l'école prévient (absence, note,
 * paiement, message…) même application fermée. Chaque état dit ce qui se
 * passe vraiment, y compris quand le navigateur ou la plateforme ne le
 * permettent pas.
 */
export function PushDeviceCard() {
    const { data: server, error, mutate } = useSWR<PushServerState>("/api/push/subscription", fetcher, { revalidateOnFocus: false });
    const [availability, setAvailability] = useState<PushAvailability | null>(null);
    const [device, setDevice] = useState<DeviceState>("checking");
    const [busy, setBusy] = useState<"on" | "off" | "test" | null>(null);

    const refreshDevice = useCallback(async () => {
        const current = await pushAvailability();
        setAvailability(current);
        if (current.state !== "ready") return;
        if (Notification.permission === "denied") {
            setDevice("denied");
            return;
        }
        const subscription = await current.registration.pushManager.getSubscription();
        setDevice(subscription && Notification.permission === "granted" ? "subscribed" : "not-subscribed");
    }, []);

    useEffect(() => {
        void refreshDevice();
    }, [refreshDevice]);

    const enable = async () => {
        if (availability?.state !== "ready" || !server?.publicKey) return;
        setBusy("on");
        const result = await subscribeThisDevice(availability.registration, server.publicKey);
        setBusy(null);
        if (result.ok) {
            toast.success("Notifications activées sur cet appareil.");
        } else if (result.reason === "denied") {
            toast.error("Notifications bloquées par le navigateur.");
        } else if (result.reason === "dismissed") {
            toast.info("Autorisation non donnée : rien n'a changé.");
        } else {
            toast.error(result.message || "L'activation a échoué. Réessayez dans un instant.");
        }
        await Promise.all([refreshDevice(), mutate()]);
    };

    const disable = async () => {
        if (availability?.state !== "ready") return;
        setBusy("off");
        await unsubscribeThisDevice(availability.registration);
        setBusy(null);
        toast.success("Notifications désactivées sur cet appareil.");
        await Promise.all([refreshDevice(), mutate()]);
    };

    const sendTest = async () => {
        setBusy("test");
        try {
            const res = await fetch("/api/push/test", { method: "POST" });
            const body = (await res.json().catch(() => ({}))) as { error?: string; sent?: number };
            if (!res.ok) toast.error(body.error || "La notification d'essai n'est pas partie.");
            else toast.success(`Notification d'essai envoyée (${body.sent} appareil${(body.sent ?? 0) > 1 ? "s" : ""}).`);
        } catch {
            toast.error("Connexion impossible : la notification d'essai n'est pas partie.");
        } finally {
            setBusy(null);
        }
    };

    let content: React.ReactNode;
    if (error) {
        content = (
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">L&apos;état des notifications n&apos;a pas pu être chargé.</p>
                <Button variant="outline" size="sm" onClick={() => void mutate()}>Réessayer</Button>
            </div>
        );
    } else if (!server || !availability || (availability.state === "ready" && device === "checking")) {
        content = (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Vérification de cet appareil…
            </p>
        );
    } else if (!server.configured) {
        content = (
            <p className="text-sm text-muted-foreground">
                Les notifications push ne sont pas encore activées sur la plateforme EduPilot. Les notifications restent
                visibles dans l&apos;application (cloche en haut de l&apos;écran).
            </p>
        );
    } else if (availability.state === "unsupported") {
        content =
            availability.reason === "ios-install" ? (
                <p className="text-sm text-muted-foreground">
                    Sur iPhone et iPad, ajoutez d&apos;abord EduPilot à l&apos;écran d&apos;accueil (bouton Partager, puis « Sur
                    l&apos;écran d&apos;accueil »), ouvrez l&apos;application depuis son icône et revenez sur cette page.
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Ce navigateur ne permet pas les notifications push. Elles fonctionnent avec Chrome, Edge, Firefox et
                    Samsung Internet, sur ordinateur comme sur téléphone.
                </p>
            );
    } else if (availability.state === "no-worker") {
        content = (
            <p className="text-sm text-muted-foreground">
                Le service de l&apos;application n&apos;est pas actif dans ce navigateur (navigation privée ou stockage
                désactivé) : rechargez la page, ou utilisez une fenêtre normale.
            </p>
        );
    } else if (device === "denied") {
        content = (
            <p className="text-sm text-muted-foreground">
                Les notifications d&apos;EduPilot sont bloquées dans ce navigateur. Autorisez-les dans les réglages du site
                (icône à gauche de l&apos;adresse, puis « Notifications »), puis rechargez cette page.
            </p>
        );
    } else if (device === "subscribed") {
        content = (
            <div className="space-y-3">
                <p className="text-sm font-medium text-[hsl(var(--success))]">Activées sur cet appareil.</p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => void sendTest()} disabled={busy !== null}>
                        {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Envoyer un essai
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void disable()} disabled={busy !== null}>
                        {busy === "off" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Désactiver sur cet appareil
                    </Button>
                </div>
            </div>
        );
    } else {
        content = (
            <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Recevez les notifications de l&apos;établissement (absences, notes, paiements, messages…) même quand
                    l&apos;application est fermée. Le navigateur vous demandera votre accord.
                </p>
                <Button onClick={() => void enable()} disabled={busy !== null}>
                    {busy === "on" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Activer sur cet appareil
                </Button>
            </div>
        );
    }

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border bg-muted/10">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <BellRing className="h-5 w-5 text-primary" aria-hidden="true" />
                    Notifications sur cet appareil
                </CardTitle>
                <CardDescription>
                    {server && server.devices > 0
                        ? `${server.devices} appareil${server.devices > 1 ? "s" : ""} abonné${server.devices > 1 ? "s" : ""} sur votre compte. À la déconnexion, l'appareil cesse de les recevoir.`
                        : "Chaque téléphone ou ordinateur s'active séparément. À la déconnexion, l'appareil cesse de les recevoir."}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">{content}</CardContent>
        </Card>
    );
}
