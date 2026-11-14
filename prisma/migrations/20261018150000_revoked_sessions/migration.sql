-- Sessions fermées (sécurité HTTP, 2026-10-18) : la déconnexion inscrit
-- l'identifiant de session stable du jeton ; il est refusé à chaque requête
-- jusqu'à l'expiration du jeton. Aucune donnée existante n'est touchée.
CREATE TABLE "revoked_sessions" (
    "sid" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "revoked_sessions_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "revoked_sessions_expiresAt_idx" ON "revoked_sessions"("expiresAt");
