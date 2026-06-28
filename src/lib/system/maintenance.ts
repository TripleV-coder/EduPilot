/**
 * Mode maintenance global — source de vérité partagée.
 *
 * L'état est persisté dans `SystemSetting` (clés `maintenance_mode` et
 * `maintenance_message`) pour survivre aux redémarrages, et mis en cache en
 * mémoire process (TTL court) afin que l'enforcement par requête
 * (createApiHandler + layout dashboard) n'ajoute pas une requête SQL à chaque
 * appel. Seul SUPER_ADMIN traverse le mode maintenance.
 */
import prisma from "@/lib/prisma";

export const MAINTENANCE_ENABLED_KEY = "maintenance_mode";
export const MAINTENANCE_MESSAGE_KEY = "maintenance_message";

/** Durée de vie du cache en mémoire (ms). */
const TTL_MS = 15_000;

export const DEFAULT_MAINTENANCE_MESSAGE =
    "EduPilot est momentanément en maintenance. Nos équipes interviennent et le service sera rétabli sous peu. Merci de votre patience.";

export interface MaintenanceState {
    enabled: boolean;
    message: string;
}

let cache: { state: MaintenanceState; at: number } | null = null;

/**
 * Lit l'état du mode maintenance (avec cache TTL en mémoire).
 * En cas d'erreur de base, on considère le service comme accessible (fail-open)
 * pour ne jamais verrouiller toute la plateforme sur un incident transitoire.
 */
export async function getMaintenanceState(): Promise<MaintenanceState> {
    if (cache && Date.now() - cache.at < TTL_MS) return cache.state;

    try {
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: [MAINTENANCE_ENABLED_KEY, MAINTENANCE_MESSAGE_KEY] } },
        });
        const enabled =
            settings.find((s) => s.key === MAINTENANCE_ENABLED_KEY)?.value === "true";
        const rawMessage = settings.find((s) => s.key === MAINTENANCE_MESSAGE_KEY)?.value?.trim();
        const state: MaintenanceState = {
            enabled,
            message: rawMessage && rawMessage.length > 0 ? rawMessage : DEFAULT_MAINTENANCE_MESSAGE,
        };
        cache = { state, at: Date.now() };
        return state;
    } catch {
        return { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE };
    }
}

/** Invalide le cache (à appeler après toute écriture de l'état). */
export function invalidateMaintenanceCache(): void {
    cache = null;
}

/**
 * Indique si le mode maintenance doit bloquer ce rôle.
 * SUPER_ADMIN conserve toujours l'accès pour piloter la sortie de maintenance.
 */
export function maintenanceBlocksRole(role: string | undefined | null): boolean {
    return role !== "SUPER_ADMIN";
}
