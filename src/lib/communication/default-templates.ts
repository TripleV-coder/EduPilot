/**
 * Catalogue de démarrage des modèles de communication (SMS / multi-canal).
 * Persisté via CommunicationTemplate à la première ouverture de l'école.
 */

export type DefaultCommunicationTemplate = {
  /** Clé stable stockée dans `subject` (préfixe slug) pour retrouver le modèle. */
  slug: string;
  name: string;
  category: string;
  body: string;
  isActive: boolean;
  autoTrigger?: string;
};

export const DEFAULT_COMMUNICATION_TEMPLATES: DefaultCommunicationTemplate[] = [
  {
    slug: "bulletin-ready",
    name: "Bulletin disponible",
    category: "Pédagogie",
    body: "Bonjour {parent.prenom}, le bulletin de {eleve.prenom} ({eleve.classe}) pour {periode} est disponible sur EduPilot : {lien.bulletin} — {ecole.nom}.",
    isActive: true,
    autoTrigger: "Auto-déclenché à la clôture du conseil",
  },
  {
    slug: "council-invite",
    name: "Conseil de classe",
    category: "Pédagogie",
    body: "Conseil de classe de {eleve.classe} prévu le {conseil.date} à {conseil.heure}. Présence souhaitée — {ecole.nom}.",
    isActive: true,
  },
  {
    slug: "brevet-convocation",
    name: "Convocation Brevet",
    category: "Pédagogie",
    body: "Convocation BEPC {bepc.session} : {eleve.prenom} {eleve.nom} · centre {bepc.centre} · {bepc.date}. Pièce d'identité obligatoire.",
    isActive: true,
  },
  {
    slug: "school-trip",
    name: "Sortie pédagogique",
    category: "Pédagogie",
    body: "Sortie pédagogique {sortie.lieu} le {sortie.date}. Autorisation parentale à signer avant {sortie.deadline}.",
    isActive: true,
  },
  {
    slug: "absence-unjustified",
    name: "Absence non justifiée",
    category: "Vie scolaire",
    body: "Bonjour {parent.prenom}, {eleve.prenom} était absent(e) le {absence.date}. Merci de justifier sous 48h — {ecole.nom}.",
    isActive: true,
    autoTrigger: "Auto-déclenché 24h après une absence non justifiée",
  },
  {
    slug: "late-repeat",
    name: "Retards répétés",
    category: "Vie scolaire",
    body: "Bonjour {parent.prenom}, {eleve.prenom} cumule {retards.count} retards ce trimestre. Un entretien est conseillé — {ecole.nom}.",
    isActive: true,
  },
  {
    slug: "medical-incident",
    name: "Incident médical",
    category: "Vie scolaire",
    body: "Bonjour {parent.prenom}, {eleve.prenom} a été pris(e) en charge à l'infirmerie ({incident.motif}). Aucun antidouleur administré sans votre accord. — {ecole.nom}.",
    isActive: true,
  },
  {
    slug: "fee-reminder-t2",
    name: "Rappel échéance T2",
    category: "Finance",
    body: "Bonjour {parent.prenom}, le paiement de scolarité de {eleve.prenom} arrive à échéance le {echeance.date} ({montant} FCFA). Payez en ligne : {lien.paiement} — {ecole.nom}.",
    isActive: true,
    autoTrigger: "Auto-déclenché 7j avant échéance",
  },
  {
    slug: "fee-confirm",
    name: "Confirmation paiement",
    category: "Finance",
    body: "Paiement reçu pour {eleve.prenom} : {montant} FCFA. Reçu n° {paiement.recu}. Merci ! — {ecole.nom}.",
    isActive: true,
    autoTrigger: "Auto-déclenché à la réception d'un paiement",
  },
  {
    slug: "fee-plan",
    name: "Échéancier proposé",
    category: "Finance",
    body: "Bonjour {parent.prenom}, un échéancier en {plan.tranches} tranches est proposé pour {eleve.prenom}. Détail : {lien.echeancier} — {ecole.nom}.",
    isActive: false,
  },
  {
    slug: "enrollment-confirmed",
    name: "Inscription validée",
    category: "Administration",
    body: "Bonjour {parent.prenom}, l'inscription de {eleve.prenom} en {eleve.classe} pour {annee.scolaire} est validée. Bienvenue à {ecole.nom} !",
    isActive: true,
  },
  {
    slug: "missing-documents",
    name: "Documents manquants",
    category: "Administration",
    body: "Bonjour {parent.prenom}, des pièces sont manquantes au dossier de {eleve.prenom} : {documents.liste}. Merci de les fournir avant {deadline}.",
    isActive: true,
  },
];

/** Encode catégorie (+ déclencheur optionnel) dans le champ `subject` Prisma. */
export function encodeTemplateSubject(category: string, autoTrigger?: string): string {
  if (!autoTrigger) return category;
  return `${category}||${autoTrigger}`;
}

export function decodeTemplateSubject(subject: string | null | undefined): {
  category: string;
  autoTrigger?: string;
} {
  if (!subject) return { category: "Administration" };
  const [category, autoTrigger] = subject.split("||");
  return {
    category: category || "Administration",
    autoTrigger: autoTrigger || undefined,
  };
}

/** Préfixe slug dans le contenu pour idempotence au seed (invisible UI). */
export const SLUG_PREFIX = "<!--slug:";
export const SLUG_SUFFIX = "-->";

export function embedSlug(body: string, slug: string): string {
  if (body.includes(`${SLUG_PREFIX}${slug}${SLUG_SUFFIX}`)) return body;
  return `${SLUG_PREFIX}${slug}${SLUG_SUFFIX}\n${body}`;
}

export function extractSlug(content: string): string | null {
  const match = content.match(/<!--slug:([a-z0-9-]+)-->/);
  return match?.[1] ?? null;
}

export function stripSlugMarker(content: string): string {
  return content.replace(/<!--slug:[a-z0-9-]+-->\n?/, "").trimStart();
}
