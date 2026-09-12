import { after } from "next/server";
import { logger } from "@/lib/utils/logger";

/**
 * Lance une tâche après l'envoi de la réponse HTTP (`after` de Next.js) :
 * le client n'attend pas sa fin. Une erreur non interceptée est journalisée.
 */
export function runInBackground(task: () => Promise<void>): void {
    after(async () => {
        try {
            await task();
        } catch (error) {
            logger.error("Tâche de fond en échec", error as Error);
        }
    });
}
