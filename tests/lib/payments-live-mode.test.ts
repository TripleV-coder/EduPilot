import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectLiveIndicators,
  isLivePaymentsEnabled,
  livePaymentsGuard,
  resetLivePaymentsWarning,
} from "@/lib/payments/live-mode";

/**
 * Lot 7 (règle 11) — l'argent réel ne doit jamais partir d'un oubli de
 * configuration. Tant que `PAYMENTS_LIVE_ENABLED` n'est pas explicitement à
 * "true", toute configuration qui viserait la production est refusée avant
 * le moindre appel au fournisseur.
 */
const PAYMENT_VARIABLES = [
  "PAYMENTS_LIVE_ENABLED",
  "FEDAPAY_ENVIRONMENT",
  "FEDAPAY_SECRET_KEY",
  "MOMO_TARGET_ENVIRONMENT",
  "MOMO_BASE_URL",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(PAYMENT_VARIABLES.map((k) => [k, process.env[k]]));
  for (const key of PAYMENT_VARIABLES) delete process.env[key];
});

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

describe("détection d'une configuration d'argent réel", () => {
  it("ne voit rien à signaler sur une configuration de bac à sable", () => {
    process.env.FEDAPAY_ENVIRONMENT = "sandbox";
    process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_abc";
    process.env.MOMO_TARGET_ENVIRONMENT = "sandbox";
    process.env.MOMO_BASE_URL = "https://sandbox.momodeveloper.mtn.com";

    expect(detectLiveIndicators()).toEqual([]);
  });

  it("ne voit rien à signaler quand rien n'est configuré", () => {
    expect(detectLiveIndicators()).toEqual([]);
  });

  it("signale FEDAPAY_ENVIRONMENT=live", () => {
    process.env.FEDAPAY_ENVIRONMENT = "live";
    expect(detectLiveIndicators().map((i) => i.variable)).toEqual(["FEDAPAY_ENVIRONMENT"]);
  });

  it("signale une clé FedaPay de production même si l'environnement dit « sandbox »", () => {
    process.env.FEDAPAY_ENVIRONMENT = "sandbox";
    process.env.FEDAPAY_SECRET_KEY = "sk_live_0123456789";
    expect(detectLiveIndicators().map((i) => i.variable)).toEqual(["FEDAPAY_SECRET_KEY"]);
  });

  it("ne divulgue jamais la valeur d'une clé secrète", () => {
    process.env.FEDAPAY_SECRET_KEY = "sk_live_0123456789";
    const indicator = detectLiveIndicators().find((i) => i.variable === "FEDAPAY_SECRET_KEY");
    expect(indicator?.value).not.toContain("0123456789");
  });

  it("signale un environnement MoMo hors bac à sable", () => {
    process.env.MOMO_TARGET_ENVIRONMENT = "mtnbenin";
    expect(detectLiveIndicators().map((i) => i.variable)).toEqual(["MOMO_TARGET_ENVIRONMENT"]);
  });

  it("signale l'URL MoMo de production", () => {
    process.env.MOMO_BASE_URL = "https://proxy.momoapi.mtn.com";
    expect(detectLiveIndicators().map((i) => i.variable)).toEqual(["MOMO_BASE_URL"]);
  });
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

describe("garde des routes d'initiation", () => {
  it("laisse passer une configuration de bac à sable", () => {
    process.env.FEDAPAY_ENVIRONMENT = "sandbox";
    expect(livePaymentsGuard()).toBeNull();
  });

  it("refuse une configuration de production non autorisée, en 503", async () => {
    process.env.FEDAPAY_ENVIRONMENT = "live";

    const response = livePaymentsGuard();

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    const body = (await response?.json()) as { code: string; error: string };
    expect(body.code).toBe("PAYMENTS_LIVE_DISABLED");
    expect(body.error).toMatch(/PAYMENTS_LIVE_ENABLED/);
  });

  it("laisse passer la production quand elle est explicitement autorisée", () => {
    process.env.FEDAPAY_ENVIRONMENT = "live";
    process.env.PAYMENTS_LIVE_ENABLED = "true";
    expect(livePaymentsGuard()).toBeNull();
  });

  it("ne journalise le refus qu'une fois par configuration", async () => {
    const { logger } = await import("@/lib/utils/logger");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    resetLivePaymentsWarning();
    process.env.FEDAPAY_ENVIRONMENT = "live";

    livePaymentsGuard();
    livePaymentsGuard();
    livePaymentsGuard();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
