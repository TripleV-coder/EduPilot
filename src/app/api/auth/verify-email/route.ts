/**
 * Vérification d'adresse email
 *
 * POST /api/auth/verify-email          → Envoie (ou renvoie) le lien de vérification
 * GET  /api/auth/verify-email?token=xx → Valide le token et marque l'email comme vérifié
 *
 * Le champ User.emailVerified est un DateTime? standard NextAuth.
 * Il est mis à jour lors du premier login (first-login/route.ts) ET ici.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/utils/logger";
import { authLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

// ---------------------------------------------------------------------------
// GET — Validation du token
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 404 });
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "Token expiré. Veuillez en demander un nouveau." }, { status: 410 });
  }

  // Marquer l'email comme vérifié
  await prisma.user.updateMany({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });

  // Supprimer le token utilisé
  await prisma.verificationToken.delete({ where: { token } });

  // Rediriger vers le dashboard avec message de succès
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/login?verified=1`);
}

// ---------------------------------------------------------------------------
// POST — Envoi/renvoi du lien de vérification
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const identifier = getClientIdentifier(req);
    const rateLimitResult = await checkRateLimit(authLimiter, identifier);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Trop de requêtes. Veuillez réessayer plus tard." }, { status: 429 });
    }

    // Authentification requise OU email passé en body (pour le renvoi depuis login)
    const session = await auth();
    let userEmail: string | null = session?.user?.email ?? null;

    if (!userEmail) {
      const body = await req.json().catch(() => ({}));
      if (typeof body.email === "string") {
        userEmail = body.email.toLowerCase().trim();
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, email: true, firstName: true, emailVerified: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // Réponse identique pour éviter l'énumération
      return NextResponse.json({
        success: true,
        message: "Si votre compte existe, un email de vérification a été envoyé.",
      });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, message: "Email déjà vérifié." });
    }

    // Supprimer l'ancien token si existant
    await prisma.verificationToken.deleteMany({
      where: { identifier: userEmail },
    });

    // Créer un nouveau token
    const token = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier: userEmail,
        token,
        expires: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}`;

    // Envoyer l'email
    await sendEmail({
      to: userEmail,
      subject: "Vérifiez votre adresse email — EduPilot",
      html: buildVerificationEmailHtml(user.firstName, verifyUrl),
      text: `Bonjour ${user.firstName},\n\nVérifiez votre email en cliquant sur ce lien (valide 24h) :\n${verifyUrl}\n\nSi vous n'avez pas créé de compte EduPilot, ignorez cet email.`,
    });

    logger.info("Email de vérification envoyé", { module: "api/auth/verify-email", email: userEmail });

    return NextResponse.json({
      success: true,
      message: "Email de vérification envoyé. Vérifiez votre boîte mail.",
    });
  } catch (error) {
    logger.error(
      "Erreur envoi email de vérification",
      error instanceof Error ? error : new Error(String(error)),
      { module: "api/auth/verify-email" }
    );
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Template HTML
// ---------------------------------------------------------------------------

function buildVerificationEmailHtml(firstName: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vérification email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f7f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <tr>
            <td style="background:#f97316;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">EduPilot</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Bonjour ${firstName},</h2>
              <p style="color:#475569;line-height:1.6;">
                Cliquez sur le bouton ci-dessous pour vérifier votre adresse email. Ce lien est valide pendant <strong>24 heures</strong>.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${verifyUrl}" style="background:#f97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;display:inline-block;">
                  Vérifier mon email
                </a>
              </div>
              <p style="color:#94a3b8;font-size:13px;line-height:1.5;">
                Ou copiez ce lien dans votre navigateur :<br>
                <a href="${verifyUrl}" style="color:#f97316;word-break:break-all;">${verifyUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                Si vous n'avez pas créé de compte EduPilot, ignorez cet email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
