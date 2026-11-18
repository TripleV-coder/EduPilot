import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isLivePaymentsEnabled } from "@/lib/payments/live-mode";

/**
 * Lot 7 (règle 11) — l'argent réel ne doit jamais partir d'un oubli de
 * configuration : tant que `PAYMENTS_LIVE_ENABLED` n'est pas explicitement à
 * "true", seuls les comptes d'école en bac à sable sont utilisés (comportement
 * éprouvé par tests/integration-db/school-payment-accounts.test.ts : « compte
 * LIVE actif alors que l'argent réel n'est pas autorisé : jamais utilisé »).
 */
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.PAYMENTS_LIVE_ENABLED;
  delete process.env.PAYMENTS_LIVE_ENABLED;
});

afterEach(() => {
  if (saved === undefined) delete process.env.PAYMENTS_LIVE_ENABLED;
  else process.env.PAYMENTS_LIVE_ENABLED = saved;
});

describe("interrupteur d'activation", () => {
  it("est fermé par défaut", () => {
    expect(isLivePaymentsEnabled()).toBe(false);
  });

  it("ne s'ouvre que sur la valeur exacte « true »", () => {
    process.env.PAYMENTS_LIVE_ENABLED = "1";
    expect(isLivePaymentsEnabled()).toBe(false);
    process.env.PAYMENTS_LIVE_ENABLED = "yes";
    expect(isLivePaymentsEnabled()).toBe(false);
    process.env.PAYMENTS_LIVE_ENABLED = "true";
    expect(isLivePaymentsEnabled()).toBe(true);
  });
});
