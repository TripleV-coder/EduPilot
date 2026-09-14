import { after } from "next/server";
import { getDbContext, runWithDbContext } from "@/lib/db/db-context";
import { logger } from "@/lib/utils/logger";

/**
 * Lance une tâche après l'envoi de la réponse HTTP (`after` de Next.js) :
 * le client n'attend pas sa fin. Une erreur non interceptée est journalisée.
 * La tâche garde le contexte de base de la requête qui l'a lancée (audit M2).
 */
export function runInBackground(task: () => Promise<void>): void {
    const context = getDbContext();
    after(async () => {
        try {
            await runWithDbContext(context, task);
        } catch (error) {
            logger.error("Tâche de fond en échec", error as Error);
        }
    });
}
