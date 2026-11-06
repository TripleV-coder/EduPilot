/**
 * Notifications push web (Web Push + VAPID). Clés générées une fois par
 * plateforme : `npx web-push generate-vapid-keys`.
 *
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY : la paire de clés ;
 * VAPID_SUBJECT : contact de l'émetteur (« mailto:… » ou « https://… »),
 * transmis aux services push en cas d'abus.
 */
export interface PushConfig {
    configured: boolean;
    publicKey: string | null;
    privateKey: string | null;
    subject: string | null;
}

export function pushConfig(): PushConfig {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null;
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || null;
    const subject = process.env.VAPID_SUBJECT?.trim() || null;
    const validSubject = Boolean(subject && /^(mailto:|https:\/\/)/.test(subject));
    return { configured: Boolean(publicKey && privateKey && validSubject), publicKey, privateKey, subject };
}
