import type { MetadataRoute } from "next";
import prisma from "@/lib/prisma";
import { siteUrl } from "@/lib/seo/site-url";
import { logger } from "@/lib/utils/logger";

// Calculé à la requête : pré-rendu au build, il interrogeait une base absente.
// Seuls les robots le demandent, et la requête est bornée (MAX_SCHOOLS).
export const dynamic = "force-dynamic";

/** Plafond de sécurité : un sitemap unique est limité à 50 000 URL. */
const MAX_SCHOOLS = 45_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = siteUrl();
    const url = (path: string) => new URL(path, base).toString();
    const pages: MetadataRoute.Sitemap = [
        { url: url("/"), changeFrequency: "weekly", priority: 1 },
        { url: url("/ecoles"), changeFrequency: "daily", priority: 0.8 },
        { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
        { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
    ];

    try {
        // Table `schools` hors RLS ; mêmes critères que l'annuaire public.
        const schools = await prisma.school.findMany({
            where: { isPublic: true, isActive: true },
            select: { code: true, updatedAt: true },
            orderBy: { code: "asc" },
            take: MAX_SCHOOLS,
        });
        for (const school of schools) {
            pages.push({ url: url(`/ecole/${encodeURIComponent(school.code)}`), lastModified: school.updatedAt, changeFrequency: "weekly", priority: 0.6 });
        }
    } catch (error) {
        // Base indisponible (build, panne) : le sitemap reste servi avec les pages fixes.
        logger.warn("[sitemap] écoles publiées indisponibles", { module: "seo", reason: error instanceof Error ? error.message : String(error) });
    }
    return pages;
}
