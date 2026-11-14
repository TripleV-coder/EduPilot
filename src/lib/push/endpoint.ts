import { z } from "zod";

/**
 * Le serveur envoie une requête HTTP à l'adresse fournie par le navigateur :
 * seuls les services push des navigateurs sont acceptés (sinon un compte
 * pourrait faire appeler une adresse interne par le serveur — SSRF).
 */
const PUSH_SERVICE_HOSTS: readonly RegExp[] = [
    /^fcm\.googleapis\.com$/, // Chrome, Edge, Opera, Samsung Internet
    /^android\.googleapis\.com$/,
    /(^|\.)push\.services\.mozilla\.com$/, // Firefox
    /(^|\.)notify\.windows\.com$/, // Windows
    /(^|\.)push\.apple\.com$/, // Safari (web.push.apple.com)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false;
    }
    if (url.protocol !== "https:" || (url.port !== "" && url.port !== "443")) return false;
    if (url.username || url.password) return false;
    return PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
}

const base64url = /^[A-Za-z0-9_-]+={0,2}$/;

/** Abonnement tel que renvoyé par `PushSubscription.toJSON()` dans le navigateur. */
export const pushSubscriptionSchema = z.object({
    endpoint: z
        .string()
        .max(2048)
        .refine(isAllowedPushEndpoint, { message: "Service de notification du navigateur non reconnu." }),
    keys: z.object({
        p256dh: z.string().min(20).max(200).regex(base64url),
        auth: z.string().min(8).max(64).regex(base64url),
    }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().max(2048) });
