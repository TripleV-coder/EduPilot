# ============================================================
# EduPilot — Dockerfile multi-stage optimisé
# Node 20 Alpine · next build standalone · rootless
# ============================================================

# -----------------------------------------------
# Étape 1 : deps — installer les dépendances npm
# -----------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile

# -----------------------------------------------
# Étape 2 : builder — compiler l'application
# -----------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Générer le client Prisma
RUN npx prisma generate

# Désactiver la télémétrie Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Build en mode standalone pour une image finale minimale
RUN npm run build

# -----------------------------------------------
# Étape 3 : runner — image de production minimale
# -----------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder /app/public ./public

# Fichiers générés par next build --standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copier le schéma Prisma pour les migrations runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/api/system/health || exit 1

CMD ["node", "server.js"]
