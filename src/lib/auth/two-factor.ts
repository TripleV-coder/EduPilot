import { TOTP } from 'otplib';
import QRCode from 'qrcode';
import { randomInt } from 'crypto';
import { logger } from '@/lib/utils/logger';
export { encryptSecret, decryptSecret, isEncrypted } from './crypto';

// Configure authenticator
const authenticator = new TOTP({
    step: 30,
    window: 1
} as any);

/**
 * Generate a new TOTP secret
 */
export function generateSecret(email: string) {
    const secret = authenticator.generateSecret();
    const service = 'EduPilot';
    const otpauth = `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(service)}&algorithm=SHA1&digits=6&period=30`;
    return { secret, otpauth };
}

/**
 * Generate a QR code data URL from otpauth URL
 */
export async function generateQRCode(otpauth: string): Promise<string> {
    return QRCode.toDataURL(otpauth);
}

/**
 * Verify a TOTP token against a secret.
 * The secret may be stored encrypted (AES-256-GCM) or in plaintext (legacy).
 */
export async function verifyToken(token: string, storedSecret: string): Promise<boolean> {
    try {
        const { decryptSecret, isEncrypted } = await import('./crypto');
        const secret = isEncrypted(storedSecret)
            ? (decryptSecret(storedSecret) ?? storedSecret)
            : storedSecret;
        return await (authenticator as any).verify({ token, secret });
    } catch (err) {
        logger.error('Token verification error', err instanceof Error ? err : new Error(String(err)), { module: 'auth/two-factor' });
        return false;
    }
}

/**
 * Generate backup codes (10 codes of 10 chars).
 * Returns plaintext codes to be shown ONCE to the user.
 */
export function generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < 10; j++) {
            code += chars.charAt(randomInt(0, chars.length));
        }
        // Format: xxxxx-xxxxx
        codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    }

    return codes;
}

/**
 * Hache une liste de backup codes en clair avec bcrypt.
 * À appeler avant de sauvegarder les codes en DB.
 */
export async function hashBackupCodes(plainCodes: string[]): Promise<string[]> {
    const bcrypt = await import('bcryptjs');
    return Promise.all(plainCodes.map((code) => bcrypt.hash(code, 10)));
}

/**
 * Vérifie si un code en clair correspond à l'un des hachages stockés en DB.
 * Retourne l'index du code correspondant, ou -1 si aucun ne correspond.
 * Utilise une comparaison séquentielle pour éviter les timing attacks via bcrypt.
 */
export async function findMatchingBackupCode(
    plainCode: string,
    hashedCodes: string[]
): Promise<number> {
    const bcrypt = await import('bcryptjs');
    for (let i = 0; i < hashedCodes.length; i++) {
        const match = await bcrypt.compare(plainCode, hashedCodes[i]);
        if (match) return i;
    }
    return -1;
}
