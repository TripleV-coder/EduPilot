import { TOTP } from 'otplib';
import QRCode from 'qrcode';

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
 * Verify a TOTP token against a secret
 */
export async function verifyToken(token: string, secret: string): Promise<boolean> {
    try {
        // authenticator.verify returns a boolean or Promise<boolean> depending on version/config
        // We cast options to any to avoid TS errors with 'step'
        return await (authenticator as any).verify({ token, secret });
    } catch (err) {
        console.error('Token verification error:', err);
        return false;
    }
}

/**
 * Generate backup codes (10 codes of 10 chars)
 */
export function generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < 10; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        // Format: xxxxx-xxxxx
        codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    }

    return codes;
}
