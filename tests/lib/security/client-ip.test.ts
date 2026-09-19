import { describe, expect, it } from "vitest";
import { getClientIp, getTrustedProxyHops, PEER_TOKEN_HEADER } from "@/lib/security/client-ip";

/**
 * H3 — l'IP utilisée par le rate-limit ne doit jamais venir d'un en-tête que
 * le client contrôle. La chaîne X-Forwarded-For n'est crue que lorsqu'elle a
 * été complétée par le préchargement serveur (jeton de processus), et on n'y
 * remonte que du nombre de proxys de confiance déclarés (TRUSTED_PROXY_HOPS).
 */
const TOKEN = "a".repeat(64);

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("getTrustedProxyHops", () => {
  it("vaut 0 par défaut (aucun proxy de confiance)", () => {
    expect(getTrustedProxyHops({})).toBe(0);
  });

  it("lit un entier positif", () => {
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "2" })).toBe(2);
  });

  it("retombe à 0 sur une valeur invalide ou négative", () => {
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "abc" })).toBe(0);
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "-1" })).toBe(0);
    expect(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "1.5" })).toBe(0);
  });
});

describe("getClientIp", () => {
  const env = { EDUPILOT_PEER_TOKEN: TOKEN };

  it("sans proxy déclaré, ignore les adresses fournies par le client et retient la socket", () => {
    // Chaîne complétée par le préchargement : "<ce que le client a envoyé>, <socket>"
    const h = headers({
      "x-forwarded-for": "6.6.6.6, 7.7.7.7, 203.0.113.9",
      [PEER_TOKEN_HEADER]: TOKEN,
    });
    expect(getClientIp(h, env)).toBe("203.0.113.9");
  });

  it("un XFF qui change à chaque requête ne change pas l'IP retenue", () => {
    const a = getClientIp(
      headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9", [PEER_TOKEN_HEADER]: TOKEN }),
      env,
    );
    const b = getClientIp(
      headers({ "x-forwarded-for": "2.2.2.2, 203.0.113.9", [PEER_TOKEN_HEADER]: TOKEN }),
      env,
    );
    expect(a).toBe(b);
  });

  it("avec un proxy de confiance, retient l'adresse que ce proxy a ajoutée", () => {
    // client forge 6.6.6.6 ; nginx ajoute l'IP réelle 198.51.100.7 ; la socket est nginx (10.0.0.2)
    const h = headers({
      "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.2",
      [PEER_TOKEN_HEADER]: TOKEN,
    });
    expect(getClientIp(h, { ...env, TRUSTED_PROXY_HOPS: "1" })).toBe("198.51.100.7");
  });

  it("ne remonte pas au-delà du début de la chaîne", () => {
    const h = headers({ "x-forwarded-for": "10.0.0.2", [PEER_TOKEN_HEADER]: TOKEN });
    expect(getClientIp(h, { ...env, TRUSTED_PROXY_HOPS: "3" })).toBe("10.0.0.2");
  });

  it("normalise les adresses IPv4 encapsulées en IPv6", () => {
    const h = headers({ "x-forwarded-for": "::ffff:127.0.0.1", [PEER_TOKEN_HEADER]: TOKEN });
    expect(getClientIp(h, env)).toBe("127.0.0.1");
  });

  it("sans jeton de processus valide, ne fait confiance à aucun en-tête", () => {
    const forged = headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6" });
    expect(getClientIp(forged, env)).toBe("unknown");

    const wrongToken = headers({ "x-forwarded-for": "6.6.6.6", [PEER_TOKEN_HEADER]: "b".repeat(64) });
    expect(getClientIp(wrongToken, env)).toBe("unknown");
  });

  it("sans préchargement (jeton absent de l'environnement), ne fait confiance à aucun en-tête", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6", [PEER_TOKEN_HEADER]: "" });
    expect(getClientIp(h, {})).toBe("unknown");
  });
});
