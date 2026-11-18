import { describe, expect, it } from "vitest";
import { gmailSmtpSettings } from "@/lib/notifications/gmail-smtp";
import { resolveEmailProvider, smtpSettings } from "@/lib/email";

/** Assistant Gmail de la console : réglages produits relus par le module d'envoi. */
describe("gmailSmtpSettings", () => {
    it("adresse + mot de passe d'application → SMTP_URL relue exactement par smtpSettings", () => {
        const result = gmailSmtpSettings(" EduPilot.Notifications@gmail.com ", "abcd efgh ijkl mnop");
        if (!result.ok) throw new Error(result.error);
        expect(result.values.EMAIL_FROM).toBe("EduPilot <edupilot.notifications@gmail.com>");
        expect(result.values.EMAIL_API_KEY).toBe("");
        expect(smtpSettings({ SMTP_URL: result.values.SMTP_URL })).toEqual({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            user: "edupilot.notifications@gmail.com",
            pass: "abcdefghijklmnop",
        });
        // Sans clé d'API restante, le fournisseur déduit est bien le SMTP
        expect(resolveEmailProvider({ SMTP_URL: result.values.SMTP_URL })).toBe("smtp");
    });

    it("nom d'expéditeur nettoyé", () => {
        const result = gmailSmtpSettings("ecole@gmail.com", "abcdefghijklmnop", 'Lycée "Béhanzin" <x>');
        expect(result.ok && result.values.EMAIL_FROM).toBe("Lycée Béhanzin x <ecole@gmail.com>");
    });

    it("refuse une adresse invalide ou un mot de passe qui n'a pas 16 lettres", () => {
        expect(gmailSmtpSettings("pas-une-adresse", "abcdefghijklmnop")).toMatchObject({ ok: false });
        expect(gmailSmtpSettings("ecole@gmail.com", "motdepasse-normal")).toMatchObject({ ok: false });
        expect(gmailSmtpSettings("ecole@gmail.com", "abcd efgh ijkl")).toMatchObject({ ok: false });
    });
});
