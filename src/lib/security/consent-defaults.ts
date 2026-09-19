/**
 * Constantes du consentement (Lot 6) — module sans dépendance, pour être lu
 * aussi bien par le serveur que par les seeds et les scripts.
 *
 * `LEGAL_TERMS_VERSION` : version des conditions d'utilisation et de la
 * politique de confidentialité. À incrémenter (date ISO) à chaque modification
 * de ces documents : chaque personne est alors invitée à accepter la nouvelle
 * version à sa prochaine connexion.
 */
export const LEGAL_TERMS_VERSION = "2026-09-17";

/** Conditions d'utilisation + politique de confidentialité, pour soi-même. */
export const CONSENT_TERMS = "TERMS";

/** Traitement des données d'un enfant mineur, donné par un parent rattaché. */
export const CONSENT_CHILD_DATA = "CHILD_DATA";
