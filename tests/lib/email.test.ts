import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMailMock = vi.fn().mockResolvedValue({});
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}));

import { sendEmail, sendPasswordResetEmail, sendWelcomeEmail, maskEmail } from "@/lib/email";
import { logger } from "@/lib/utils/logger";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("maskEmail", () => {
  it("masque la partie locale en gardant le domaine", () => {
    expect(maskEmail("awa.dossou@ecole.bj")).toBe("aw***@ecole.bj");
    expect(maskEmail("a@x.bj")).toBe("a***@x.bj");
    expect(maskEmail("pas-un-email")).toBe("***");
  });
});

describe("sendEmail", () => {
  it("en dev sans provider : simule l'envoi via le logger avec destinataire masqué", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_PROVIDER", "");
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const debugSpy = vi.spyOn(logger, "debug").mockImplementation(() => {});

    const ok = await sendEmail({
      to: "awa.dossou@ecole.bj",
      subject: "Test",
      html: "<p>secret-reset-link</p>",
    });

    expect(ok).toBe(true);
    const context = infoSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(context.to).toBe("aw***@ecole.bj"); // jamais l'adresse en clair
    expect(JSON.stringify(infoSpy.mock.calls[0])).not.toContain("secret-reset-link");
    expect(debugSpy).toHaveBeenCalled(); // contenu complet relégué en debug

    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it("en prod sans provider : échec explicite loggé, pas d'envoi silencieux", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_PROVIDER", "");
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    const ok = await sendEmail({ to: "x@y.bj", subject: "Test", html: "<p>x</p>" });

    expect(ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("provider resend : poste sur l'API et retourne true si 200", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "noreply@edupilot.bj");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const ok = await sendEmail({ to: "x@y.bj", subject: "Sujet", html: "<p>x</p>" });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
      })
    );
  });

  it("provider resend : retourne false sur erreur API", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "invalid" }) })
    );
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    expect(await sendEmail({ to: "x@y.bj", subject: "S", html: "<p>x</p>" })).toBe(false);
    errorSpy.mockRestore();
  });

  it("provider smtp : délègue à nodemailer", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    vi.stubEnv("SMTP_HOST", "mail.ecole.bj");
    vi.stubEnv("SMTP_PORT", "587");

    const ok = await sendEmail({ to: "x@y.bj", subject: "S", html: "<p>x</p>" });

    expect(ok).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "x@y.bj", subject: "S" })
    );
  });
});

describe("templates", () => {
  it("reset password : contient le lien et l'avertissement d'expiration", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendPasswordResetEmail({
      email: "awa@ecole.bj",
      firstName: "Awa",
      resetUrl: "https://edupilot.bj/reset?token=abc",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.subject).toContain("Réinitialisation");
    expect(payload.html).toContain("https://edupilot.bj/reset?token=abc");
    expect(payload.html).toContain("1 heure");
    expect(payload.text).toContain("https://edupilot.bj/reset?token=abc");
  });

  it("bienvenue : inclut le mot de passe temporaire seulement s'il est fourni", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_API_KEY", "re_test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendWelcomeEmail({
      email: "bio@ecole.bj",
      firstName: "Bio",
      loginUrl: "https://edupilot.bj/login",
      tempPassword: "Temp1234!",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).html).toContain("Temp1234!");

    await sendWelcomeEmail({
      email: "bio@ecole.bj",
      firstName: "Bio",
      loginUrl: "https://edupilot.bj/login",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).html).not.toContain("mot de passe temporaire");
  });
});

describe("SMTP_URL : une seule variable pour le serveur SMTP", () => {
  it("smtps:// → TLS, port 465 par défaut ; identifiants décodés", async () => {
    const { smtpSettings } = await import("@/lib/email");
    expect(smtpSettings({ SMTP_URL: "smtps://direction%40ecole.bj:p%40ss%3Aw0rd@smtp.ecole.bj" })).toEqual({
      host: "smtp.ecole.bj", port: 465, secure: true, user: "direction@ecole.bj", pass: "p@ss:w0rd",
    });
  });

  it("smtp:// → STARTTLS, port 587 par défaut ; port explicite respecté", async () => {
    const { smtpSettings } = await import("@/lib/email");
    expect(smtpSettings({ SMTP_URL: "smtp://u:p@mail.ecole.bj" })).toMatchObject({ port: 587, secure: false });
    expect(smtpSettings({ SMTP_URL: "smtp://u:p@mail.ecole.bj:2525" })).toMatchObject({ port: 2525 });
  });

  it("ancienne forme acceptée sans SMTP_URL ; SMTP_URL prioritaire ; valeur invalide refusée", async () => {
    const { smtpSettings, resolveEmailProvider } = await import("@/lib/email");
    expect(smtpSettings({ SMTP_HOST: "h", SMTP_PORT: "25", SMTP_USER: "u", SMTP_PASS: "p" })).toEqual({ host: "h", port: 25, secure: false, user: "u", pass: "p" });
    expect(smtpSettings({ SMTP_URL: "smtps://a:b@nouveau", SMTP_HOST: "ancien" })?.host).toBe("nouveau");
    expect(smtpSettings({ SMTP_URL: "https://pas-un-smtp" })).toBeNull();
    expect(smtpSettings({})).toBeNull();
    expect(resolveEmailProvider({ SMTP_URL: "smtps://a:b@h" })).toBe("smtp");
  });
});

describe("parseSender : nom affiché accepté dans l'adresse d'expédition", () => {
  it("sépare nom et adresse ; adresse seule inchangée", async () => {
    const { parseSender } = await import("@/lib/email");
    expect(parseSender("EduPilot <noreply@ecole.bj>")).toEqual({ name: "EduPilot", email: "noreply@ecole.bj" });
    expect(parseSender('"Lycée Béhanzin" <contact@lycee.bj>')).toEqual({ name: "Lycée Béhanzin", email: "contact@lycee.bj" });
    expect(parseSender("noreply@ecole.bj")).toEqual({ email: "noreply@ecole.bj" });
    expect(parseSender("<noreply@ecole.bj>")).toEqual({ email: "noreply@ecole.bj" });
  });
});
