/**
 * AI Predictive Service — Deterministic RNG
 *
 * Générateur pseudo-aléatoire seedable pour rendre les prédictions
 * reproductibles (même élève → même résultat), donc testables de façon fiable.
 *
 * Sans seed, le bootstrap et le K-means utilisaient `Math.random()`, ce qui
 * produisait un résultat différent à chaque appel.
 */

export type Rng = () => number;

/**
 * PRNG mulberry32 — rapide, déterministe, distribution uniforme sur [0, 1).
 * Le même seed produit toujours la même séquence.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash FNV-1a 32 bits → seed entière stable pour un identifiant donné.
 * Utilisé pour dériver un RNG reproductible par élève/classe.
 */
export function seedFromId(id: string): number {
  let hash = 0x811c9dc5; // offset basis FNV-1a 32 bits
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // prime FNV 32 bits
  }
  return hash >>> 0;
}

/**
 * Raccourci : RNG déterministe dérivé d'un identifiant.
 */
export function rngFromId(id: string): Rng {
  return mulberry32(seedFromId(id));
}
