import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site-url";

/** Seules la vitrine, l'annuaire des écoles publiées et les pages légales sont indexables. */
export default function robots(): MetadataRoute.Robots {
    const base = siteUrl();
    return {
        rules: {
            userAgent: "*",
            allow: ["/", "/ecoles", "/ecole/", "/privacy", "/terms"],
            disallow: ["/dashboard", "/api/", "/login", "/register", "/setup", "/first-login", "/forgot-password", "/reset-password", "/verify-email", "/mfa-setup", "/mfa-verify", "/explorer", "/disabled", "/offline"],
        },
        sitemap: new URL("/sitemap.xml", base).toString(),
        host: base.host,
    };
}
