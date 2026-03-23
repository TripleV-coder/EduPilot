/**
 * EduPilot - Configuration optimisée pour la production
 * Inclut les optimisations de performance et de sécurité
 */

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  // Turbopack config (vide pour accepter config webpack existante)
  turbopack: {},
  // ─────────────────────────────────────────────────────────────
  // BUILD & DEPLOYMENT
  // ─────────────────────────────────────────────────────────────
  
  // Mode standalone pour Docker
  output: "standalone",
  
  // Strict mode pour détecter les problèmes
  reactStrictMode: true,
  
  // Note: swcMinify est maintenant activé par défaut dans Next.js 16+

  // ─────────────────────────────────────────────────────────────
  // OPTIMISATION DES PERFORMANCES
  // ─────────────────────────────────────────────────────────────
  
  // Compression
  compress: true,
  
  // Optimisation des polyfills
  experimental: {
    // Server Actions
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Optimistic Client Cache
    optimisticClientCache: true,
    // Turbopack en dev (Next.js 15+)
    // turbotrace: {},
  },

  // PoweredBy header supprimé pour la sécurité
  poweredByHeader: false,

  // ─────────────────────────────────────────────────────────────
  // IMAGES OPTIMIZATION
  // ─────────────────────────────────────────────────────────────
  
  images: {
    // Domaines autorisés
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
    ],
    // Formats modernes
    formats: ["image/avif", "image/webp"],
    // Tailles prédéfinies pour optimisation
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 an
  },

  // ─────────────────────────────────────────────────────────────
  // HEADERS DE SÉCURITÉ
  // ─────────────────────────────────────────────────────────────
  
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Protection XSS
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          
          // Referrer Policy
          { 
            key: "Referrer-Policy", 
            value: "strict-origin-when-cross-origin" 
          },
          
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              isProd
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://res.cloudinary.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.amazonaws.com",
              "font-src 'self' data:",
              isProd
                ? "connect-src 'self' https://*.upstash.io https://*.ingest.sentry.io https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com"
                : "connect-src 'self' http://localhost:* https://*.upstash.io https://*.ingest.sentry.io https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          
          // Permissions Policy
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          
          // HSTS (production uniquement)
          ...(isProd ? [{
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          }] : []),
        ],
      },
      // Cache statique agressif
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache pour les assets Next.js
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // ─────────────────────────────────────────────────────────────
  // REDIRECTIONS
  // ─────────────────────────────────────────────────────────────
  
  async redirects() {
    return [
      // Redirection racine vers dashboard si connecté (géré par middleware)
      {
        source: "/home",
        destination: "/dashboard",
        permanent: true,
      },
    ];
  },

  // ─────────────────────────────────────────────────────────────
  // WEBPACK CUSTOM CONFIG
  // ─────────────────────────────────────────────────────────────
  
  webpack: (config, { isServer }) => {
    // Optimisation du bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Ignorer les source maps en production
    if (isProd) {
      config.devtool = false;
    }

    return config;
  },

  // ─────────────────────────────────────────────────────────────
  // LOGGING & MONITORING
  // ─────────────────────────────────────────────────────────────
  
  // Sentry (si configuré)
  ...(process.env.SENTRY_DSN && {
    sentry: {
      hideSourceMaps: true,
      widenClientFileUpload: true,
    },
  }),
};

module.exports = nextConfig;
