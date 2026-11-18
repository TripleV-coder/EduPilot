/**
 * Notifications push web (Web Push + VAPID).
 *
 * Plus aucune variable à définir (2026-11-08) : la paire de clés P-256 est
 * DÉRIVÉE du secret maître (HKDF, étiquette « push-vapid ») — identique sur
 * toutes les instances, stable d'un redémarrage à l'autre, sans stockage.
 * Le contact (« subject ») est l'adresse publique HTTPS de l'application.
 *
 * Variables explicites toujours prioritaires (installations existantes : les
 * abonnements push déjà enregistrés restent liés à leur clé) :
 * VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY, VAPID_SUBJECT (« mailto:… » ou
 * « https://… »).
 *
 * ⚠️ Changer le secret maître change la clé dérivée : les appareils devront
 * réactiver les notifications (Paramètres › Notifications).
 */
import { createECDH, hkdfSync } from "node:crypto";
import { masterSecret } from "@/lib/security/derived-secrets";
import { publicBaseUrl } from "@/lib/system/platform";

export interface PushConfig {
    configured: boolean;
    publicKey: string | null;
    privateKey: string | null;
    subject: string | null;
}

/** Ordre du groupe de la courbe P-256 : une clé privée valide est dans [1, n-1]. */
const P256_ORDER = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

/** Paire de clés VAPID dérivée du secret maître (base64url, format attendu par web-push). */
export function derivedVapidKeys(master: string): { publicKey: string; privateKey: string } {
    for (let attempt = 0; ; attempt++) {
        const scalar = Buffer.from(hkdfSync("sha256", master, "edupilot:derived-secrets:v1", `edupilot:push-vapid:${attempt}`, 32));
        const value = BigInt(`0x${scalar.toString("hex")}`);
        // Hors intervalle : probabilité ≈ 2⁻³², on passe à l'essai suivant
        if (value === BigInt(0) || value >= P256_ORDER) continue;
        const ecdh = createECDH("prime256v1");
        ecdh.setPrivateKey(scalar);
        return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: scalar.toString("base64url") };
    }
}

let cached: { master: string; keys: { publicKey: string; privateKey: string } } | null = null;

function vapidSubject(): string | null {
    const explicit = process.env.VAPID_SUBJECT?.trim();
    if (explicit) return explicit;
    const base = publicBaseUrl();
    return base && base.startsWith("https://") ? base : null;
}

export function pushConfig(): PushConfig {
    const subject = vapidSubject();
    const validSubject = Boolean(subject && /^(mailto:|https:\/\/)/.test(subject));

    let publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null;
    let privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || null;
    if (!publicKey && !privateKey) {
        const master = masterSecret();
        if (master) {
            if (cached?.master !== master) cached = { master, keys: derivedVapidKeys(master) };
            ({ publicKey, privateKey } = cached.keys);
        }
    }
    return { configured: Boolean(publicKey && privateKey && validSubject), publicKey, privateKey, subject };
}
