import { describe, expect, it } from "vitest";
import {
    arePaymentSecretsAvailable,
    decryptPaymentSecret,
    encryptPaymentSecret,
    lastFour,
    PaymentSecretsUnavailableError,
} from "@/lib/payments/secret-box";

/** S7 : secrets des comptes marchands chiffrés et liés à leur école et à leur compte. Clés synthétiques. */
const KEY_1 = "1".repeat(64);
const KEY_2 = "2".repeat(64);
const env = (extra: Record<string, string> = {}) => ({ PAYMENT_SECRETS_KEY: KEY_1, ...extra }) as unknown as NodeJS.ProcessEnv;
const ctx = { schoolId: "ecole-a", accountId: "compte-1", field: "secretKey" as const };
const SECRET = "sk_sandbox_synthetique_0123456789";

describe("secret-box", () => {
    it("chiffre puis déchiffre ; le chiffré ne contient pas le secret", () => {
        const { ciphertext, version } = encryptPaymentSecret(SECRET, ctx, env());
        expect(version).toBe(1);
        expect(ciphertext).toMatch(/^v1:/);
        expect(ciphertext).not.toContain("synthetique");
        expect(decryptPaymentSecret(ciphertext, ctx, env())).toBe(SECRET);
    });

    it("lié au contexte : recopié vers une autre école, un autre compte ou un autre champ, il ne se déchiffre pas", () => {
        const { ciphertext } = encryptPaymentSecret(SECRET, ctx, env());
        expect(decryptPaymentSecret(ciphertext, { ...ctx, schoolId: "ecole-b" }, env())).toBeNull();
        expect(decryptPaymentSecret(ciphertext, { ...ctx, accountId: "compte-2" }, env())).toBeNull();
        expect(decryptPaymentSecret(ciphertext, { ...ctx, field: "webhookSecret" }, env())).toBeNull();
    });

    it("chiffré altéré ou format inconnu : null", () => {
        const { ciphertext } = encryptPaymentSecret(SECRET, ctx, env());
        const tampered = ciphertext.slice(0, -2) + (ciphertext.endsWith("00") ? "11" : "00");
        expect(decryptPaymentSecret(tampered, ctx, env())).toBeNull();
        expect(decryptPaymentSecret("texte-en-clair", ctx, env())).toBeNull();
    });

    it("sans clé maîtresse valide : indisponible, jamais de stockage en clair", () => {
        const none = {} as NodeJS.ProcessEnv;
        expect(arePaymentSecretsAvailable(none)).toBe(false);
        expect(arePaymentSecretsAvailable({ PAYMENT_SECRETS_KEY: "court" } as unknown as NodeJS.ProcessEnv)).toBe(false);
        expect(() => encryptPaymentSecret(SECRET, ctx, none)).toThrow(PaymentSecretsUnavailableError);
        expect(() => decryptPaymentSecret("v1:aa:bb:cc", ctx, none)).toThrow(PaymentSecretsUnavailableError);
    });

    it("rotation de la clé maîtresse : l'ancienne reste lisible via PAYMENT_SECRETS_PREVIOUS_KEYS, la nouvelle chiffre", () => {
        const old = encryptPaymentSecret(SECRET, ctx, env()).ciphertext;
        const rotated = env({ PAYMENT_SECRETS_KEY: KEY_2, PAYMENT_SECRETS_KEY_VERSION: "2", PAYMENT_SECRETS_PREVIOUS_KEYS: `1:${KEY_1}` });
        expect(decryptPaymentSecret(old, ctx, rotated)).toBe(SECRET);
        const fresh = encryptPaymentSecret(SECRET, ctx, rotated);
        expect(fresh.version).toBe(2);
        // Ancienne clé retirée du trousseau : l'ancien chiffré n'est plus lisible
        expect(decryptPaymentSecret(old, ctx, env({ PAYMENT_SECRETS_KEY: KEY_2, PAYMENT_SECRETS_KEY_VERSION: "2" }))).toBeNull();
    });

    it("affichage : 4 derniers caractères seulement", () => {
        expect(lastFour(SECRET)).toBe("6789");
    });
});
