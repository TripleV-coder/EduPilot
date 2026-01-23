import { ApogeeTone, Signal, SignalDomain, SignalMomentum, SignalSeverity } from "./model";

export const SIGNAL_SEVERITY_WEIGHT: Record<SignalSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  ELEVATED: 3,
  GUARDED: 2,
  CLEAR: 1,
};

export interface AttendanceSnapshot {
  readonly rate: number;
  readonly present: number;
  readonly absent: number;
}

export interface GradeSnapshot {
  readonly A: number;
  readonly B: number;
  readonly C: number;
  readonly D: number;
  readonly F: number;
}

export interface FinanceSnapshot {
  readonly total: number;
  readonly count: number;
  readonly perStudent: number;
}

export interface EngagementSnapshot {
  readonly streak: number;
  readonly todayCompleted: boolean;
  readonly longestStreak: number;
}

export interface LibrarySnapshot {
  readonly overdue: number;
}

const SEVERITY_TONE: Record<SignalSeverity, ApogeeTone> = {
  CRITICAL: "crimson",
  HIGH: "gold",
  ELEVATED: "cobalt",
  GUARDED: "emerald",
  CLEAR: "graphite",
};

const normalize = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildSignal = (
  domain: SignalDomain,
  label: string,
  severity: SignalSeverity,
  momentum: SignalMomentum,
  hint: string,
  scoreBoost: number = 0
): Signal => {
  const baseScore = SIGNAL_SEVERITY_WEIGHT[severity] * 18;
  const score = normalize(baseScore + scoreBoost, 8, 100);

  return {
    id: `signal:${domain.toLowerCase()}:${slugify(label)}`,
    domain,
    label,
    severity,
    score,
    momentum,
    hint,
    tone: SEVERITY_TONE[severity],
  };
};

export const evaluateAttendanceSignal = (snapshot: AttendanceSnapshot): Signal => {
  const total = snapshot.present + snapshot.absent;
  if (total === 0) {
    return buildSignal(
      "ATTENDANCE",
      "Présence non consolidée",
      "GUARDED",
      "STABLE",
      "Pointage en attente, verrouiller les alertes avant 10h."
    );
  }

  // Seuils alignés sur la charge opérationnelle : <80% déclenche supervision, <70% bascule en crise.
  if (snapshot.rate < 70) {
    return buildSignal(
      "ATTENDANCE",
      "Tension de présence",
      "CRITICAL",
      "DOWN",
      "Déclencher le protocole d'appel renforcé et audit des absences.",
      12
    );
  }

  if (snapshot.rate < 80) {
    return buildSignal(
      "ATTENDANCE",
      "Présence sous seuil",
      "HIGH",
      "DOWN",
      "Isoler les classes critiques avant midi pour correction ciblée.",
      8
    );
  }

  if (snapshot.rate < 88) {
    return buildSignal(
      "ATTENDANCE",
      "Présence stable",
      "ELEVATED",
      "STABLE",
      "Surveiller la dispersion des absences en fin de matinée.",
      4
    );
  }

  const absenceRatio = snapshot.absent / total;
  if (absenceRatio > 0.08) {
    return buildSignal(
      "ATTENDANCE",
      "Présence maîtrisée",
      "GUARDED",
      "STABLE",
      "Absences concentrées, valider les justifications en lot."
    );
  }

  return buildSignal(
    "ATTENDANCE",
    "Présence souveraine",
    "CLEAR",
    "UP",
    "Cadence maîtrisée, ouvrir les créneaux d'optimisation."
  );
};

export const evaluateGradeSignal = (snapshot: GradeSnapshot): Signal => {
  const total = snapshot.A + snapshot.B + snapshot.C + snapshot.D + snapshot.F;
  if (total === 0) {
    return buildSignal(
      "ACADEMICS",
      "Spectre académique en attente",
      "GUARDED",
      "STABLE",
      "Importer le dernier lot de notes avant analyse avancée."
    );
  }

  const weakShare = (snapshot.D + snapshot.F) / total;
  const strongShare = (snapshot.A + snapshot.B) / total;

  if (weakShare > 0.35) {
    return buildSignal(
      "ACADEMICS",
      "Risque académique élevé",
      "CRITICAL",
      "DOWN",
      "Déployer un plan de rattrapage multi-niveaux."
    );
  }

  if (weakShare > 0.25) {
    return buildSignal(
      "ACADEMICS",
      "Risque académique mesuré",
      "HIGH",
      "DOWN",
      "Renforcer les remédiations ciblées sur les classes concernées."
    );
  }

  if (weakShare > 0.18) {
    return buildSignal(
      "ACADEMICS",
      "Zone de vigilance",
      "ELEVATED",
      "STABLE",
      "Prioriser les points d'ancrage avant le prochain cycle."
    );
  }

  if (strongShare < 0.35) {
    return buildSignal(
      "ACADEMICS",
      "Projection moyenne",
      "GUARDED",
      "STABLE",
      "Activer les ateliers d'excellence pour relever le plafond."
    );
  }

  return buildSignal(
    "ACADEMICS",
    "Spectre académique souverain",
    "CLEAR",
    "UP",
    "Stabiliser la dynamique et ouvrir les défis avancés."
  );
};

export const evaluateFinanceSignal = (snapshot: FinanceSnapshot): Signal => {
  if (snapshot.total <= 0 || snapshot.count <= 0) {
    return buildSignal(
      "FINANCE",
      "Flux financier interrompu",
      "CRITICAL",
      "DOWN",
      "Réconcilier immédiatement les paiements et relancer les canaux."
    );
  }

  if (snapshot.perStudent < 3500) {
    return buildSignal(
      "FINANCE",
      "Flux financier sous tension",
      "HIGH",
      "DOWN",
      "Prioriser les plans de paiement et la relance proactive.",
      10
    );
  }

  if (snapshot.perStudent < 6500) {
    return buildSignal(
      "FINANCE",
      "Flux financier contrôlé",
      "ELEVATED",
      "STABLE",
      "Surveiller les pics d'encaissement en fin de semaine."
    );
  }

  return buildSignal(
    "FINANCE",
    "Flux financier souverain",
    "CLEAR",
    "UP",
    "Capitaliser sur la stabilité pour planifier les investissements."
  );
};

export const evaluateEngagementSignal = (snapshot: EngagementSnapshot): Signal => {
  if (!snapshot.todayCompleted && snapshot.streak === 0) {
    return buildSignal(
      "ENGAGEMENT",
      "Engagement en rupture",
      "ELEVATED",
      "DOWN",
      "Réactiver les rituels quotidiens avant 16h."
    );
  }

  if (snapshot.streak < 3) {
    return buildSignal(
      "ENGAGEMENT",
      "Engagement fragile",
      "GUARDED",
      "STABLE",
      "Solidifier la cadence par micro-objectifs."
    );
  }

  if (snapshot.streak >= 7 && snapshot.todayCompleted) {
    return buildSignal(
      "ENGAGEMENT",
      "Engagement stabilisé",
      "CLEAR",
      "UP",
      "Maintenir la cadence, activer les défis avancés."
    );
  }

  return buildSignal(
    "ENGAGEMENT",
    "Engagement en progression",
    "GUARDED",
    "UP",
    "Renforcer la continuité avec des jalons hebdomadaires."
  );
};

export const evaluateLibrarySignal = (snapshot: LibrarySnapshot): Signal => {
  if (snapshot.overdue > 15) {
    return buildSignal(
      "LIBRARY",
      "Retards critiques",
      "HIGH",
      "DOWN",
      "Déclencher la relance prioritaire et suspension ciblée."
    );
  }

  if (snapshot.overdue > 0) {
    return buildSignal(
      "LIBRARY",
      "Retards sous contrôle",
      "ELEVATED",
      "STABLE",
      "Organiser un rappel collectif avant le prochain inventaire."
    );
  }

  return buildSignal(
    "LIBRARY",
    "Bibliothèque souveraine",
    "CLEAR",
    "UP",
    "Exploiter la disponibilité pour renforcer la rotation."
  );
};
