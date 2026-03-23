/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
    // Mode standalone : génère un bundle autonome pour le déploiement Docker
    // Voir : https://nextjs.org/docs/app/api-reference/config/next-config-js/output
    output: "standalone",

    // Désactiver l'indicateur de développement en prod
    reactStrictMode: true,

    // Optimisation des images - URLs restreintes
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "res.cloudinary.com" },
            { protocol: "https", hostname: "avatars.githubusercontent.com" },
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
        ],
    },

    // Headers de sécurité
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            isProd
                                ? "script-src 'self' 'unsafe-inline'"
                                : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' blob: data: https://res.cloudinary.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
                            "font-src 'self' data:",
                            isProd
                                ? "connect-src 'self' https://*.upstash.io https://*.ingest.sentry.io https://generativelanguage.googleapis.com"
                                : "connect-src 'self' http://localhost:* https://*.upstash.io https://*.ingest.sentry.io https://generativelanguage.googleapis.com",
                            "frame-ancestors 'self'",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join("; "),
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                    {
                        key: "Strict-Transport-Security",
                        value: "max-age=63072000; includeSubDomains; preload",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
