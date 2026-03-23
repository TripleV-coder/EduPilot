const REQUIRED_SECRETS = [
  "NEXTAUTH_SECRET",
] as const;

type RequiredSecretKey = (typeof REQUIRED_SECRETS)[number];

function getEnv(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[key];
}

export function getRequiredSecret(key: RequiredSecretKey): string {
  const value = getEnv(key);
  if (!value || value === "changeme" || value === "generate-a-secure-secret-with-openssl-rand-base64-32") {
    throw new Error(`Configuration manquante ou invalide pour la variable critique ${key}`);
  }
  return value;
}

export const appEnv = {
  nodeEnv: getEnv("NODE_ENV") ?? "development",
  isProduction: (getEnv("NODE_ENV") ?? "development") === "production",
  isTest: (getEnv("NODE_ENV") ?? "development") === "test",

  allowBackupApi: getEnv("ALLOW_BACKUP_API") === "true",

  ai: {
    enabled: getEnv("AI_ENABLED") !== "false",
    providers: (getEnv("AI_PROVIDER") ?? "").split(",").map((p) => p.trim()).filter(Boolean),
    hasExternalKeys: Boolean(
      getEnv("OPENAI_API_KEY") ||
        getEnv("ANTHROPIC_API_KEY") ||
        getEnv("GOOGLE_AI_API_KEY")
    ),
  },
};

