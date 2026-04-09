import { sendWelcomeEmail, sendPasswordResetEmail } from "../src/lib/email";
import nodemailer from "nodemailer";

async function testEmails() {
  console.log("Creation d'un compte de test Ethereal...");
  const testAccount = await nodemailer.createTestAccount();

  console.log("Compte Ethereal créé:", testAccount.user);

  // Forcer l'utilisation de SMTP pour le test
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = testAccount.smtp.host;
  process.env.SMTP_PORT = testAccount.smtp.port.toString();
  process.env.SMTP_SECURE = testAccount.smtp.secure ? "true" : "false";
  process.env.SMTP_USER = testAccount.user;
  process.env.SMTP_PASS = testAccount.pass;
  process.env.EMAIL_FROM = "test@edupilot.bj";

  console.log("\nEnvoi de l'email de bienvenue...");
  const welcomeSuccess = await sendWelcomeEmail({
    email: "etudiant@example.com",
    firstName: "Jean",
    loginUrl: "http://localhost:3000/login",
    tempPassword: "Password123!"
  });

  console.log("Statut Bienvenue:", welcomeSuccess ? "SUCCÈS" : "ÉCHEC");

  console.log("\nEnvoi de l'email de réinitialisation...");
  const resetSuccess = await sendPasswordResetEmail({
    email: "professeur@example.com",
    firstName: "Marie",
    resetUrl: "http://localhost:3000/reset-password?token=123"
  });

  console.log("Statut Réinitialisation:", resetSuccess ? "SUCCÈS" : "ÉCHEC");

  console.log("\nPour voir les emails envoyés (comme s'ils étaient arrivés en boîte de réception), connectez-vous ici :");
  console.log("URL de la Webmail Ethereal : https://ethereal.email/login");
  console.log(`Email : ${testAccount.user}`);
  console.log(`Mot de passe : ${testAccount.pass}`);
}

testEmails().catch(console.error);
