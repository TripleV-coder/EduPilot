/**
 * IP client de confiance — source unique pour le rate-limit et la journalisation
 * (audit H3).
 *
 * Le serveur Next ne renseigne `X-Forwarded-For` avec l'adresse de la socket
 * que si l'en-tête est ABSENT (`base-server`, `??=`) : un client qui envoie son
 * propre XFF efface donc toute trace de son adresse réelle. Le préchargement
 * `scripts/server/client-ip-preload.cjs` (lancé avec `node --require`) corrige
 * cela : il ajoute l'adresse de la socket à la fin de la chaîne et signe la
 * requête avec un jeton aléatoire propre au processus (`EDUPILOT_PEER_TOKEN`),
 * qu'il écrase à chaque requête — un client ne peut pas l'imposer.
 *
 * Lecture de la chaîne (`TRUSTED_PROXY_HOPS`, défaut 0) :
 *   - 0 : pas de reverse proxy → adresse de la socket (dernier élément) ;
 *   - N : N proxys de confiance devant l'application → l'adresse ajoutée par le
 *     plus lointain d'entre eux (N-ième élément en partant de la fin, socket
 *     exclue). Les éléments plus anciens, fournis par le client, sont ignorés.
 *
 * Sans jeton valide (préchargement absent : `next dev`, test), AUCUN en-tête
 * n'est cru : l'IP vaut `unknown` (défaut sûr — un seul compartiment partagé,
 * jamais un compartiment choisi par le client).
 */

export const PEER_TOKEN_HEADER = "x-edupilot-peer-token";
export const UNKNOWN_IP = "unknown";

const MAX_TRUSTED_HOPS = 10;

type HeaderReader = { get(name: string): string | null | undefined };
type Env = Record<string, string | undefined>;

export function getTrustedProxyHops(env: Env = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return 0;
  return Math.min(Number(raw), MAX_TRUSTED_HOPS);
}

/** Comparaison en temps constant (sans dépendance Node : utilisable au middleware). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeIp(ip: string): string {
  const value = ip.trim();
  // IPv4 encapsulée en IPv6 (socket double pile) : ::ffff:203.0.113.9
  if (value.toLowerCase().startsWith("::ffff:") && value.includes(".")) {
    return value.slice("::ffff:".length);
  }
  return value;
}

export function getClientIp(headers: HeaderReader, env: Env = process.env): string {
  const expected = env.EDUPILOT_PEER_TOKEN;
  const presented = headers.get(PEER_TOKEN_HEADER);
  if (!expected || !presented || !safeEqual(presented, expected)) return UNKNOWN_IP;

  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length === 0) return UNKNOWN_IP;

  const index = Math.max(0, chain.length - 1 - getTrustedProxyHops(env));
  return normalizeIp(chain[index]);
}
