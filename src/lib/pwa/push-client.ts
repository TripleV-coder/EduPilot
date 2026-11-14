"use client";

/**
 * Côté navigateur : abonnement de CET appareil aux notifications push
 * (lib/push côté serveur). Le service worker de l'application doit être
 * actif — il ne l'est qu'en production (components/pwa/ServiceWorkerRegister).
 */
export type PushAvailability =
    | { state: "unsupported"; reason: "browser" | "ios-install" }
    | { state: "no-worker" }
    | { state: "ready"; registration: ServiceWorkerRegistration };

function isIos(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function pushAvailability(): Promise<PushAvailability> {
    if (typeof window === "undefined") return { state: "unsupported", reason: "browser" };
    const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    // iPhone / iPad : les notifications web n'existent que pour l'application ajoutée à l'écran d'accueil
    if (!hasApis) return { state: "unsupported", reason: isIos() ? "ios-install" : "browser" };
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return { state: "no-worker" };
    return { state: "ready", registration };
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
    if (!current) return false;
    const bytes = new Uint8Array(current);
    return bytes.length === expected.length && bytes.every((b, i) => b === expected[i]);
}

export type SubscribeResult =
    | { ok: true }
    | { ok: false; reason: "denied" | "dismissed" | "server" | "error"; message?: string };

export async function subscribeThisDevice(registration: ServiceWorkerRegistration, publicKey: string): Promise<SubscribeResult> {
    try {
        const permission = await Notification.requestPermission();
        if (permission === "denied") return { ok: false, reason: "denied" };
        if (permission !== "granted") return { ok: false, reason: "dismissed" };

        const key = urlBase64ToUint8Array(publicKey);
        let subscription = await registration.pushManager.getSubscription();
        // Clé de la plateforme changée : l'ancien abonnement ne peut plus recevoir
        if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
            await subscription.unsubscribe();
            subscription = null;
        }
        subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

        const res = await fetch("/api/push/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subscription.toJSON()),
        });
        if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            return { ok: false, reason: "server", message: body.error };
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: "error", message: error instanceof Error ? error.message : undefined };
    }
}

/** Retire l'abonnement de cet appareil (serveur puis navigateur). Sans effet s'il n'y en a pas. */
export async function unsubscribeThisDevice(registration?: ServiceWorkerRegistration | null): Promise<void> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = registration ?? (await navigator.serviceWorker.getRegistration());
    const subscription = await reg?.pushManager?.getSubscription();
    if (!subscription) return;
    await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        keepalive: true,
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
}
