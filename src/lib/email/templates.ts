/**
 * Email Templates
 * Templates d'emails pour le système d'authentification
 */

interface WelcomeEmailData {
  firstName: string;
  email: string;
  tempPassword: string;
  magicLinkUrl: string;
  loginUrl: string;
  role: string;
}

/**
 * Template email de bienvenue avec mot de passe temporaire
 */
export function getWelcomeEmailTemplate(data: WelcomeEmailData): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 40px 30px;
    }
    .credentials-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      margin: 25px 0;
      border-radius: 10px;
      text-align: center;
    }
    .temp-password {
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 4px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      margin: 15px 0;
      backdrop-filter: blur(10px);
    }
    .magic-link-btn {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      padding: 16px 48px;
      text-decoration: none;
      border-radius: 50px;
      font-weight: bold;
      font-size: 16px;
      margin: 20px 0;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
    }
    .magic-link-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    .alternative {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      margin: 25px 0;
      border-radius: 5px;
    }
    .security-note {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 20px;
      margin: 25px 0;
      border-radius: 5px;
    }
    .instructions {
      background: #f8f9fa;
      padding: 25px;
      margin: 25px 0;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }
    .instructions ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .instructions li {
      margin: 8px 0;
    }
    .footer {
      text-align: center;
      color: #666;
      font-size: 13px;
      margin-top: 30px;
      padding: 30px;
      border-top: 1px solid #e0e0e0;
    }
    .email-field {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 5px;
      font-family: monospace;
      margin: 10px 0;
      border: 1px solid #dee2e6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Bienvenue sur EduPilot</h1>
    </div>

    <div class="content">
      <p style="font-size: 16px;">Bonjour <strong>${data.firstName}</strong>,</p>

      <p>
        Votre compte EduPilot a été créé avec succès en tant que
        <strong>${data.role}</strong>.
      </p>

      <!-- Option 1: Lien Magique (Recommandé) -->
      <div class="credentials-box">
        <h2 style="margin-top: 0; color: white;">🚀 Option 1: Accès Direct (Recommandé)</h2>
        <p style="color: rgba(255,255,255,0.9);">
          Cliquez sur le bouton ci-dessous pour vous connecter automatiquement
          et définir votre mot de passe personnel :
        </p>
        <div style="margin: 25px 0;">
          <a href="${data.magicLinkUrl}" class="magic-link-btn">
            ✨ Activer mon compte
          </a>
        </div>
        <p style="font-size: 13px; color: rgba(255,255,255,0.8); margin: 15px 0 0 0;">
          Ce lien est valide pendant 7 jours et ne peut être utilisé qu'une seule fois.
        </p>
      </div>

      <!-- Option 2: Login Manuel (Alternative) -->
      <div class="alternative">
        <h3 style="margin-top: 0;">🔑 Option 2: Connexion Manuelle</h3>
        <p>Si le lien magique ne fonctionne pas, utilisez ces identifiants :</p>

        <div style="margin: 15px 0;">
          <strong>Email :</strong>
          <div class="email-field">${data.email}</div>
        </div>

        <div style="margin: 15px 0;">
          <strong>Mot de passe temporaire :</strong>
          <div class="temp-password">${data.tempPassword}</div>
        </div>

        <p style="margin-top: 20px;">
          <a href="${data.loginUrl}" style="color: #667eea; text-decoration: none; font-weight: bold; font-size: 16px;">
            👉 Se connecter manuellement
          </a>
        </p>
      </div>

      <!-- Note de Sécurité -->
      <div class="security-note">
        <strong>🔒 Sécurité :</strong><br>
        Pour votre sécurité, vous devrez créer un nouveau mot de passe lors de
        votre première connexion. Le mot de passe temporaire ne fonctionnera plus
        après ce changement.
      </div>

      <!-- Instructions -->
      <div class="instructions">
        <h3 style="margin-top: 0;">📝 Prochaines étapes :</h3>
        <ol>
          <li><strong>Cliquez</strong> sur le lien magique ou connectez-vous manuellement</li>
          <li><strong>Créez</strong> un nouveau mot de passe sécurisé (min. 8 caractères)</li>
          <li><strong>Explorez</strong> votre tableau de bord personnalisé</li>
          <li><strong>Configurez</strong> votre profil et préférences</li>
        </ol>
      </div>

      <p style="margin-top: 30px;">
        Besoin d'aide ? Répondez à cet email ou contactez-nous à
        <a href="mailto:support@edupilot.com" style="color: #667eea; text-decoration: none;">
          support@edupilot.com
        </a>
      </p>

      <p style="margin-top: 25px;">
        Cordialement,<br>
        <strong>L'équipe EduPilot</strong>
      </p>
    </div>

    <div class="footer">
      <p style="margin: 5px 0;">
        <strong>⚠️ Sécurité :</strong> Cet email contient des informations confidentielles.
      </p>
      <p style="margin: 5px 0;">
        Si vous avez reçu cet email par erreur, veuillez le supprimer immédiatement.
      </p>
      <p style="margin: 15px 0 5px 0; color: #999;">
        © 2025 EduPilot - Plateforme de Gestion Scolaire
      </p>
      <p style="margin: 5px 0; color: #999;">
        Fait avec ❤️ pour l'éducation
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Template email de confirmation Super Admin
 */
export function getSuperAdminCreatedTemplate(data: {
  firstName: string;
  email: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 0 0 10px 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .success-box {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Compte Super Admin Créé</h1>
  </div>

  <div class="content">
    <p>Bonjour <strong>${data.firstName}</strong>,</p>

    <div class="success-box">
      <p style="margin: 0;">
        ✅ Votre compte Super Administrateur a été créé avec succès !
      </p>
    </div>

    <p>
      Vous pouvez maintenant vous connecter avec l'email :
      <strong>${data.email}</strong>
    </p>

    <p>
      En tant que Super Admin, vous avez un accès complet pour :
    </p>

    <ul>
      <li>Créer et gérer des établissements scolaires</li>
      <li>Créer des administrateurs d'établissements</li>
      <li>Accéder à toutes les données du système</li>
      <li>Configurer les paramètres globaux</li>
      <li>Gérer les utilisateurs et les rôles</li>
    </ul>

    <p style="margin-top: 30px;">
      Cordialement,<br>
      <strong>L'équipe EduPilot</strong>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Helper pour envoyer un email (wrapper)
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const _html = getWelcomeEmailTemplate(data);

  // TODO: Intégrer avec votre service d'email (SendGrid, Resend, etc.)
  // Safe logging - do not log sensitive data
  if (process.env.NODE_ENV === 'development') {
    console.log('[Email] Sending welcome email to:', data.email);
    // SECURITY: Never log passwords or tokens
  }

  // Exemple avec console (remplacer par vraie intégration)
  // await sendEmail({
  //   to: data.email,
  //   subject: `Bienvenue sur EduPilot - Vos identifiants`,
  //   html,
  // });
}
