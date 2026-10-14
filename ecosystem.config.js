/**
 * PM2 Ecosystem Configuration for EduPilot
 * Production-ready process management
 */

/**
 * Nombre de processus (analyse de capacité 2026-10-01, G1) : un processus Node
 * n'exécute le code applicatif que sur un cœur. WEB_CONCURRENCY=N ou « max ».
 * Au-delà de 1, les limites de débit et les compteurs d'échecs de connexion
 * doivent être partagés par REDIS_URL : sans lui, on reste à 1 processus.
 */
const sharedStore = Boolean(
  process.env.REDIS_URL || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
);
const requested = (process.env.WEB_CONCURRENCY || '1').trim();
const instances = sharedStore ? (requested === 'max' ? 'max' : Math.max(1, Number(requested) || 1)) : 1;
if (!sharedStore && requested !== '1') {
  console.warn(`[ecosystem] WEB_CONCURRENCY=${requested} ignoré : REDIS_URL absent, un seul processus.`);
}

module.exports = {
  apps: [
    {
      name: 'edupilot',
      // Serveur standalone produit par `next build` (output: standalone).
      script: '.next/standalone/server.js',
      // Adresse client fiable pour le rate-limit (audit H3) + arrêt propre
      // sur SIGTERM (Lot 7 : fin des requêtes en cours, puis Prisma et Redis).
      node_args: '--require ./scripts/server/client-ip-preload.cjs --require ./scripts/server/graceful-shutdown.cjs',
      // Laisse le temps à l'arrêt propre de se dérouler avant le SIGKILL
      // (20 s de drainage + 5 s de fermetures, cf. graceful-shutdown.cjs).
      kill_timeout: 30000,
      // Plusieurs processus seulement avec un magasin partagé (REDIS_URL) :
      // sans lui, rate-limit et compteurs d'échecs en mémoire seraient
      // multipliés par processus (décision du 2026-09-12, levée le 2026-10-01).
      // Mode cluster PM2 : les processus partagent le port et le disque
      // (téléversements dans ./uploads).
      instances,
      exec_mode: 'cluster',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: 'localhost',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        // bcrypt natif : hachage des mots de passe dans ce pool, hors du thread des requêtes.
        UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || '4',
        WEB_CONCURRENCY: requested,

        // AI Configuration
        AI_MODEL_PATH: './models',
        AI_CACHE_DIR: './.ai-cache',
        AI_ENABLE_RATE_LIMITING: 'true',
        AI_MAX_CONCURRENT_REQUESTS: '10',
        AI_STREAMING_ENABLED: 'true',
        AI_LOG_LEVEL: 'info',
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      merge_logs: true,

      // Advanced features
      autorestart: true,
      watch: false, // Set to true for development
      // Pic mesuré sous charge : 970 Mo (redescend à ~390 Mo au repos, pas de
      // fuite). 1G redémarrait presque à chaque pointe.
      max_memory_restart: '1536M',

      // Graceful shutdown
      // (kill_timeout est défini plus haut à 30 s : l'arrêt propre du Lot 7
      // a besoin de ce délai ; 5 s coupaient les requêtes en cours.)
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Cluster mode settings
      instance_var: 'INSTANCE_ID',

      // Monitoring
      min_uptime: '10s',
      max_restarts: 10,

      // Source map support
      source_map_support: true,

      // Crash handling
      exp_backoff_restart_delay: 100,
    },
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/edupilot.git',
      path: '/var/www/edupilot',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."',
      'post-deploy-local': 'echo "Deployment completed!"',
    },
    staging: {
      user: 'deploy',
      host: ['staging-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-repo/edupilot.git',
      path: '/var/www/edupilot-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
    },
  },
};
