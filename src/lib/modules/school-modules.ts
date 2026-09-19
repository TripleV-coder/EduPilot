/**
 * Modules actifs d'un établissement (Lot 6) — lecture avec cache TTL.
 *
 * L'enforcement est par requête (`createApiHandler`) : sans cache, chaque appel
 * d'API ajouterait une lecture SQL. Même schéma que le mode maintenance.
 */
import prisma from "@/lib/prisma";
import { normalizeEnabledModules, type ModuleId } from "@/lib/modules/catalog";

/** Durée de vie du cache en mémoire (ms). */
const TTL_MS = 30_000;

const cache = new Map<string, { modules: ModuleId[]; at: number }>();

/**
 * Modules actifs d'une école. `null` si l'école est introuvable ou si la base
 * est momentanément indisponible : l'appelant ne bloque alors rien (fail-open,
 * comme le mode maintenance — un incident de base ne doit pas éteindre l'app).
 */
export async function getEnabledModules(schoolId: string): Promise<ModuleId[] | null> {
    const hit = cache.get(schoolId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.modules;

    try {
        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { enabledModules: true },
        });
        // Colonne absente ou illisible : état inconnu, on ne bloque rien
        // (en base elle est NOT NULL avec défaut, donc ce cas n'arrive pas).
        if (!school || !Array.isArray(school.enabledModules)) return null;
        const modules = normalizeEnabledModules(school.enabledModules);
        cache.set(schoolId, { modules, at: Date.now() });
        return modules;
    } catch {
        return null;
    }
}

/** Invalide le cache (après toute écriture des modules). */
export function invalidateSchoolModulesCache(schoolId?: string): void {
    if (schoolId) cache.delete(schoolId);
    else cache.clear();
}
