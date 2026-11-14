import { createHash, randomBytes } from "node:crypto";
import { siteUrl } from "@/lib/seo/site-url";

/**
 * Lien d'activation d'un compte créé par un tiers (/first-login?token=…).
 *
 * Le jeton est un secret aléatoire de 256 bits remis une seule fois ; la base
 * n'en garde que l'empreinte SHA-256 (une fuite de la table ne donne aucun
 * lien utilisable). Le lien ne porte pas de mot de passe provisoire : le
 * titulaire choisit directement son mot de passe définitif.
 */
export const ACTIVATION_LINK_TTL_HOURS = 72;

export function hashActivationToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newActivationToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: hashActivationToken(token) };
}

export function activationLinkUrl(token: string): string {
    const url = new URL("/first-login", siteUrl());
    url.searchParams.set("token", token);
    return url.toString();
}
