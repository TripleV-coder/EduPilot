/**
 * Email Service for EduPilot
 *
 * This module provides email sending functionality.
 * In production, integrate with a real email provider like:
 * - Resend (recommended)
 * - SendGrid
 * - AWS SES
 * - Nodemailer with SMTP ("smtp")
 */

import { logger } from "@/lib/utils/logger";
import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailParams {
  email: string;
  firstName: string;
  resetUrl: string;
}

interface WelcomeEmailParams {
  email: string;
  firstName: string;
  loginUrl: string;
  tempPassword?: string;
}

/**
 * Send an email using the configured email provider
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, text } = options;

  // Check if we're in development mode
  const isDev = process.env.NODE_ENV === "development";

  // Check if email service is configured
  const emailProvider = process.env.EMAIL_PROVIDER;
  const emailApiKey = process.env.EMAIL_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "noreply@edupilot.bj";

  const isSmtpIncomplete = emailProvider === "smtp" && (!process.env.SMTP_HOST || !process.env.SMTP_PORT);
  const isApiIncomplete = (emailProvider === "resend" || emailProvider === "sendgrid") && !emailApiKey;

  if (!emailProvider || isSmtpIncomplete || isApiIncomplete) {
    if (isDev) {
      console.log("=".repeat(60));
      console.log("EMAIL SERVICE - Development Mode");
      console.log("=".repeat(60));
      console.log(`To: ${to}`);
      console.log(`From: ${emailFrom}`);
      console.log(`Subject: ${subject}`);
      console.log("-".repeat(60));
      console.log("HTML Content:");
      console.log(html);
      console.log("-".repeat(60));
      if (text) {
        console.log("Text Content:");
        console.log(text);
      }
      console.log("=".repeat(60));
      return true;
    }

    // En production : l'email n'est pas configuré — erreur explicite
    // (validateEnv() en instrumentation.ts devrait avoir bloqué le démarrage avant d'arriver ici)
    logger.error(
      "Service email non configuré en production. Définir EMAIL_PROVIDER, EMAIL_API_KEY et EMAIL_FROM.",
      undefined,
      { module: "email", to, subject }
    );
    return false;
  }

  try {
    // Resend integration
    if (emailProvider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${emailApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error("Resend API error", new Error(JSON.stringify(error)), { module: "email" });
        return false;
      }

      return true;
    }

    // SendGrid integration
    if (emailProvider === "sendgrid") {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${emailApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: emailFrom },
          subject,
          content: [
            { type: "text/plain", value: text || html.replace(/<[^>]*>/g, "") },
            { type: "text/html", value: html },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("SendGrid API error", new Error(error), { module: "email" });
        return false;
      }

      return true;
    }

    // SMTP (Nodemailer) integration
    if (emailProvider === "smtp") {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });

      await transporter.sendMail({
        from: emailFrom,
        to,
        subject,
        html,
        text,
      });

      return true;
    }

    logger.error("Unknown email provider", undefined, { module: "email", provider: emailProvider });
    return false;
  } catch (error) {
    logger.error("Error sending email", error instanceof Error ? error : new Error(String(error)), { module: "email" });
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<boolean> {
  const { email, firstName, resetUrl } = params;

  const subject = "Réinitialisation de votre mot de passe - EduPilot";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 EduPilot</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Système de Gestion Scolaire</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bonjour ${firstName},</h2>

    <p>Vous avez demandé la réinitialisation de votre mot de passe sur EduPilot.</p>

    <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
        Réinitialiser mon mot de passe
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      <strong>⚠️ Important :</strong> Ce lien expire dans <strong>1 heure</strong>.
    </p>

    <p style="color: #666; font-size: 14px;">
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} EduPilot. Tous droits réservés.</p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Bonjour ${firstName},

Vous avez demandé la réinitialisation de votre mot de passe sur EduPilot.

Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
${resetUrl}

⚠️ Important : Ce lien expire dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.

---
© ${new Date().getFullYear()} EduPilot. Tous droits réservés.
  `.trim();

  return sendEmail({ to: email, subject, html, text });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<boolean> {
  const { email, firstName, loginUrl, tempPassword } = params;

  const subject = "Bienvenue sur EduPilot !";

  const passwordSection = tempPassword
    ? `
    <p><strong>Votre mot de passe temporaire :</strong></p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center; margin: 15px 0;">
      ${tempPassword}
    </div>
    <p style="color: #e74c3c; font-size: 14px;">
      ⚠️ Pour votre sécurité, changez ce mot de passe dès votre première connexion.
    </p>
    `
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur EduPilot</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 EduPilot</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Système de Gestion Scolaire</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Bienvenue ${firstName} ! 🎉</h2>

    <p>Votre compte EduPilot a été créé avec succès.</p>

    <p><strong>Votre identifiant :</strong> ${email}</p>

    ${passwordSection}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
        Se connecter
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

    <p style="color: #666; font-size: 14px;">
      Si vous avez des questions, contactez l'administrateur de votre établissement.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} EduPilot. Tous droits réservés.</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, html });
}
