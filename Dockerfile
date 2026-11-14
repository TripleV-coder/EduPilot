# ============================================================
# EduPilot — Dockerfile multi-stage optimisé
# Node 24 LTS Alpine · next build standalone · rootless
# ============================================================

# -----------------------------------------------
# Étape 1 : deps — installer les dépendances npm
# -----------------------------------------------
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# .npmrc (legacy-peer-deps) : sans lui, npm 11 exige les peer dependencies
# absentes du lockfile (webpack…) et `npm ci` échoue dans l'image seulement.
COPY package.json package-lock.json* .npmrc ./
# Schéma requis par le postinstall (`prisma generate`) ; pas --ignore-scripts,
# qui sauterait aussi la compilation native de bcrypt
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# -----------------------------------------------
# Étape 2 : builder — compiler l'application
# -----------------------------------------------
FROM node:24-alpine AS builder
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Générer le client Prisma
RUN npx prisma generate

# CLI Prisma autonome pour `migrate deploy` au démarrage, AVEC ses dépendances
# (@prisma/config → effect, c12…) : copier le seul paquet `prisma` donnait
# « Cannot find module 'effect' » et le conteneur s'arrêtait. Même version que
# le projet ; moteurs téléchargés ici, donc pour Alpine (musl).
RUN npm install --prefix /opt/prisma-cli --no-save --no-package-lock --omit=dev \
      "prisma@$(node -p "require('./node_modules/prisma/package.json').version")"

# Désactiver la télémétrie Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Build en mode standalone pour une image finale minimale
RUN npm run build

# -----------------------------------------------
# Étape 3 : runner — image de production minimale
# -----------------------------------------------
FROM node:24-alpine AS runner

RUN apk add --no-cache openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Pool de threads libuv : le hachage des mots de passe (bcrypt natif) s'y
# exécute, hors du thread des requêtes. 4 par défaut ; un par cœur alloué au
# processus. Avec WEB_CONCURRENCY > 1, chaque processus a son propre pool.
ENV UV_THREADPOOL_SIZE=4

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder /app/public ./public

# Fichiers générés par next build --standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Préchargements serveur : IP client fiable pour le rate-limit (audit H3) et
# arrêt propre sur SIGTERM (Lot 7) — voir ENTRYPOINT.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/server/client-ip-preload.cjs ./client-ip-preload.cjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/server/graceful-shutdown.cjs ./graceful-shutdown.cjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/server/docker-entrypoint.sh ./docker-entrypoint.sh
# Lanceur multi-processus (WEB_CONCURRENCY), analyse de capacité 2026-10-01.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/server/cluster.cjs ./cluster.cjs

# Fichiers envoyés : stockés dans PostgreSQL (table stored_files), aucun
# volume à monter.

# Schéma et migrations, appliquées au démarrage par l'entrypoint.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# Le CLI Prisma (`migrate deploy`) : il n'est pas dans la sortie standalone,
# qui ne trace que ce que le code importe. Installé à part avec toutes ses
# dépendances (étape builder, /opt/prisma-cli), moteurs pour Alpine (musl).
COPY --from=builder --chown=nextjs:nodejs /opt/prisma-cli/node_modules ./prisma-cli/node_modules

USER nextjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Sans reverse proxy : TRUSTED_PROXY_HOPS=0 (défaut). Derrière nginx/Caddy : 1.
# L'entrypoint applique les migrations puis `exec`ute le serveur, qui devient
# PID 1 et reçoit donc lui-même le SIGTERM de `docker stop` (arrêt propre).
ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
