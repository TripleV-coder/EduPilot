import { describe, expect, it } from "vitest";
import { acquireJobLease, releaseJobLease } from "@/lib/system/job-lease";
import { uniqueCode } from "./helpers";

/**
 * N8 — exclusion mutuelle des tâches planifiées, contre une vraie base.
 * Constat du Lot 2 : un planificateur qui réessaie après expiration de sa
 * requête lançait une 2e maintenance quotidienne concurrente (observé : deux
 * exécutions simultanées). Le bail est une ligne de `system_settings`, prise
 * de façon atomique ; il expire seul si le processus meurt en cours de tâche.
 */
describe("N8 — bail d'exclusion mutuelle des tâches planifiées", () => {
  it("un seul détenteur à la fois, même en acquisitions simultanées", async () => {
    const job = uniqueCode("job");
    const tokens = await Promise.all(Array.from({ length: 5 }, () => acquireJobLease(job, 60_000)));

    expect(tokens.filter((token) => token !== null)).toHaveLength(1);
  });

  it("seul le détenteur libère le bail", async () => {
    const job = uniqueCode("job");
    const token = await acquireJobLease(job, 60_000);
    expect(token).not.toBeNull();

    await releaseJobLease(job, "jeton-d-un-autre-processus");
    expect(await acquireJobLease(job, 60_000)).toBeNull();

    await releaseJobLease(job, token!);
    expect(await acquireJobLease(job, 60_000)).not.toBeNull();
  });

  it("un bail expiré (processus arrêté en cours de tâche) peut être repris", async () => {
    const job = uniqueCode("job");
    expect(await acquireJobLease(job, 1)).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await acquireJobLease(job, 60_000)).not.toBeNull();
  });
});
