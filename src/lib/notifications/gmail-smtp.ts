/**
 * Réglages e-mail pour un compte Gmail (envoi gratuit, ≈ 500 messages par
 * jour) à partir de l'adresse et d'un MOT DE PASSE D'APPLICATION Google
 * (validation en deux étapes requise sur le compte).
 *
 * Évite la saisie à la main de SMTP_URL : « @ » de l'adresse à encoder
 * (%40), espaces du mot de passe à retirer. EMAIL_API_KEY est vidée : une
 * clé Resend/SendGrid restante prendrait sinon le pas sur le SMTP.
 */
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export type GmailSmtpResult =
    | { ok: true; values: { SMTP_URL: string; EMAIL_FROM: string; EMAIL_API_KEY: "" } }
    | { ok: false; error: string };

export function gmailSmtpSettings(address: string, appPassword: string, senderName = "EduPilot"): GmailSmtpResult {
    const email = address.trim().toLowerCase();
    if (!EMAIL.test(email)) return { ok: false, error: "Adresse Gmail invalide." };
    const password = appPassword.replace(/\s+/g, "");
    if (!/^[a-z]{16}$/i.test(password)) {
        return { ok: false, error: "Le mot de passe d'application Google compte 16 lettres (les espaces sont ignorés)." };
    }
    const name = senderName.replace(/[<>"\r\n]/g, "").trim() || "EduPilot";
    return {
        ok: true,
        values: {
            SMTP_URL: `smtps://${encodeURIComponent(email)}:${encodeURIComponent(password)}@smtp.gmail.com:465`,
            EMAIL_FROM: `${name} <${email}>`,
            EMAIL_API_KEY: "",
        },
    };
}
