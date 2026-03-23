/**
 * Environment Variables Validation
 * Validates critical environment variables at application startup
 */

const EXAMPLE_SECRET = "generate-a-secure-secret-with-openssl-rand-base64-32";
const MIN_SECRET_LENGTH = 32;

interface EnvValidationError {
  variable: string;
  issue: string;
  suggestion: string;
}

/**
 * Validate NEXTAUTH_SECRET
 */
function validateNextAuthSecret(): EnvValidationError | null {
  const secret = process.env.NEXTAUTH_SECRET;

  if (!secret) {
    return {
      variable: "NEXTAUTH_SECRET",
      issue: "Variable d'environnement manquante",
      suggestion: "Générez un secret avec: openssl rand -base64 32"
    };
  }

  if (secret === EXAMPLE_SECRET) {
    return {
      variable: "NEXTAUTH_SECRET",
      issue: "Utilisation de la valeur d'exemple en production",
      suggestion: "Générez un nouveau secret avec: openssl rand -base64 32"
    };
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    return {
      variable: "NEXTAUTH_SECRET",
      issue: `Secret trop court (${secret.length} caractères, minimum ${MIN_SECRET_LENGTH})`,
      suggestion: "Générez un secret plus long avec: openssl rand -base64 32"
    };
  }

  return null;
}

/**
 * Validate DATABASE_URL
 */
function validateDatabaseUrl(): EnvValidationError | null {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      variable: "DATABASE_URL",
      issue: "Variable d'environnement manquante",
      suggestion: "Définissez DATABASE_URL dans votre fichier .env"
    };
  }

  // Validate PostgreSQL URL format
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    return {
      variable: "DATABASE_URL",
      issue: "Format d'URL PostgreSQL invalide",
      suggestion: "Format attendu: postgresql://user:password@host:port/database"
    };
  }

  return null;
}

/**
 * Validate NEXT_PUBLIC_APP_URL (important for emails, redirects, etc.)
 */
function validateAppUrl(): EnvValidationError | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.warn("⚠️  NEXT_PUBLIC_APP_URL non défini - utilisation de http://localhost:3000 par défaut");
    return null; // Not critical, just a warning
  }

  // En production runtime (pas pendant le build), devrait utiliser HTTPS
  // On saute ce check pendant le build (CI/CD peut ne pas encore avoir l'URL finale)
  if (
    process.env.NODE_ENV === "production" &&
    !appUrl.startsWith("https://") &&
    // Côté serveur uniquement (runtime Node.js)
    typeof window === "undefined" &&
    // Ne pas loguer pendant le build Next (phase-production-build)
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    console.warn("⚠️  NEXT_PUBLIC_APP_URL devrait utiliser HTTPS en production");
    return null; // Warning only, don't block build
  }

  return null;
}

/**
 * Validate all critical environment variables
 */
export function validateEnvironment(): void {
  // Skip validation in test environment
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const errors: EnvValidationError[] = [];

  // Validate critical variables
  const secretError = validateNextAuthSecret();
  if (secretError) errors.push(secretError);

  const dbError = validateDatabaseUrl();
  if (dbError) errors.push(dbError);

  const appUrlError = validateAppUrl();
  if (appUrlError) errors.push(appUrlError);

  // If there are errors, log them and exit
  if (errors.length > 0) {
    console.error("\n❌ ERREURS DE CONFIGURATION - L'application ne peut pas démarrer\n");
    console.error("=".repeat(70));

    errors.forEach((error, index) => {
      console.error(`\n${index + 1}. ${error.variable}`);
      console.error(`   Problème: ${error.issue}`);
      console.error(`   Solution: ${error.suggestion}`);
    });

    console.error("\n" + "=".repeat(70));
    console.error("\n💡 Consultez le fichier .env.example pour référence\n");

    // Exit with error (Edge compatible)
    throw new Error("Critical environment variables missing or invalid. Check logs.");
  }

  // Log success in development
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Variables d'environnement validées avec succès");
  }
}

/**
 * Validate email configuration (optional but recommended)
 */
export function validateEmailConfig(): { configured: boolean; provider?: string } {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.EMAIL_API_KEY;

  if (!provider || !apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn("⚠️  Service d'email non configuré - Les emails ne seront pas envoyés");
    }
    return { configured: false };
  }

  const supportedProviders = ["resend", "sendgrid"];
  if (!supportedProviders.includes(provider)) {
    console.warn(`⚠️  Fournisseur d'email non reconnu: ${provider}`);
    return { configured: false };
  }

  return { configured: true, provider };
}
