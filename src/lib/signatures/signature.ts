/**
 * Signature électronique simple — helpers purs testés.
 *
 * `contentHash` scelle le document au moment de la signature : toute modification
 * ultérieure du document produit un hash différent, rendant l'altération détectable.
 * On ne vise PAS une signature qualifiée eIDAS (pas de PKI).
 */
import { createHash } from "crypto";
import { roleSatisfies } from "@/lib/rbac/permissions";
import type { SignableDocType } from "@prisma/client";

/** Sérialisation canonique (clés triées) → hash reproductible quel que soit l'ordre. */
export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Empreinte SHA-256 (hex) du document signé. */
export function computeContentHash(docType: string, docId: string, payload: unknown): string {
    return createHash("sha256")
        .update(`${docType}:${docId}:${stableStringify(payload)}`)
        .digest("hex");
}

/** Hache une IP (RGPD : on ne stocke jamais l'IP en clair). */
export function hashIp(ip: string, salt = ""): string {
    return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

const DIRECTION_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

/**
 * Qui peut signer quel type de document :
 *  - bulletins / certificats / contrats → direction (NETWORK_ADMIN hérite) ;
 *  - autorisation parentale → le parent lui-même.
 */
export function canSignDocType(
    role: string | null | undefined,
    docType: SignableDocType,
): boolean {
    if (docType === "PARENT_AUTHORIZATION") return role === "PARENT";
    return roleSatisfies(role, DIRECTION_ROLES);
}
