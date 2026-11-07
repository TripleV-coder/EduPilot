import { publicBaseUrl } from "@/lib/system/platform";

/**
 * URL publique du site, base des liens absolus (Open Graph, sitemap, robots).
 * NEXTAUTH_URL d'abord : lue à l'exécution et obligatoire en production (même
 * origine). NEXT_PUBLIC_APP_URL est figée au build, ce qui piégerait une image
 * Docker construite une fois pour plusieurs déploiements. Enfin le poste local.
 */
export function siteUrl(): URL {
    // NEXTAUTH_URL, NEXT_PUBLIC_APP_URL, puis le domaine fourni par Vercel
    const raw = publicBaseUrl() ?? "http://localhost:3000";
    try {
        return new URL(raw);
    } catch {
        return new URL("http://localhost:3000");
    }
}
