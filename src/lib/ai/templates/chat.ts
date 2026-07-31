/**
 * Réponses de secours pour le chat libre (couche 2).
 * Utilisé lorsque les providers cloud sont indisponibles.
 */

function detectIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  const intentPatterns: Record<string, string[]> = {
    greeting: ["bonjour", "salut", "bonsoir", "hello", "hi"],
    grades: ["note", "moyenne", "bulletin", "évaluation", "resultat"],
    attendance: ["présence", "absence", "retard", "assiduité"],
    finance: ["paiement", "frais", "facture", "scolarité", "bourse"],
    schedule: ["emploi du temps", "horaire", "planning", "cours"],
    predictions: ["prédiction", "prédire", "risque", "analyse", "prévoir"],
    orientation: ["orientation", "série", "bac", "carrière", "filière"],
    reports: ["rapport", "générer", "statistique", "bilan"],
    help: ["aide", "comment", "utiliser", "guide", "help"],
  };

  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some((pattern) => lowerMessage.includes(pattern))) {
      return intent;
    }
  }

  return "default";
}

function generateGreeting(role: string): string {
  const isPublic = role === "PUBLIC";

  return `Bonjour ! Je suis **EduPilot AI**, l'assistant de la plateforme de gestion scolaire.

${
  isPublic
    ? `Je peux vous expliquer les fonctionnalités d'EduPilot et répondre à vos questions sur la gestion scolaire.`
    : `Je peux vous aider avec les notes, les présences, les analyses de risque, l'orientation et bien plus — même sans connexion à un service cloud externe.`
}

Que puis-je faire pour vous aujourd'hui ?`;
}

function generateGradeInfo(role: string): string {
  return `**Système de notation EduPilot** (échelle 0-20) :

${
  role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "DIRECTOR"
    ? `- Saisie des évaluations et calcul automatique des moyennes
- Suivi de la progression par matière et par période
- Génération d'appréciations de bulletin en un clic`
    : role === "PARENT"
      ? `- Consultation des notes de votre enfant en temps réel
- Notifications à chaque nouvelle évaluation
- Comparaison avec la moyenne de classe`
      : `- Vos notes sont enregistrées par vos enseignants
- Elles alimentent votre moyenne et vos bulletins`
}

Souhaitez-vous une action précise ?`;
}

function generatePredictionInfo(role: string): string {
  return `**Prédictions et analyses (moteur local, sans abonnement)** :

- **Risque d'échec** : calculé à partir des notes, présences et comportement
- **Projection de moyenne** : estimation pour la prochaine période
- **Orientation** : recommandation de série selon le profil académique

${
  role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "DIRECTOR"
    ? `Accédez aux analyses depuis la fiche élève ou le tableau de bord IA.`
    : `Ces analyses s'appuient sur votre historique scolaire.`
}

Sur quel aspect souhaitez-vous des détails ?`;
}

function generateOrientationInfo(): string {
  return `**Orientation scolaire — système béninois** :

Séries principales : A1/A2 (littéraire), B (économique), C/D (scientifique), E (technique), F/G (professionnel).

EduPilot analyse vos matières fortes et votre moyenne générale pour proposer une orientation. Utilisez l'action « Proposer une orientation » sur la fiche élève pour une synthèse personnalisée.`;
}

function generateDefaultResponse(message: string, role: string): string {
  const excerpt = message.slice(0, 50);

  if (role === "PUBLIC") {
    return `Vous avez demandé : « ${excerpt}... »

EduPilot est une plateforme de gestion scolaire complète : notes, présences, finances, emplois du temps, analyses prédictives et orientation.

Je fonctionne en mode autonome — aucune clé API n'est requise pour les fonctionnalités essentielles. Que souhaitez-vous explorer ?`;
  }

  return `Concernant « ${excerpt}... », voici ce que je peux faire :

- **Académique** : notes, bulletins, appréciations
- **Suivi** : présences, risques, interventions
- **Orientation** : recommandations de série
- **Rapports** : synthèses et alertes

Précisez votre besoin pour une réponse ciblée.`;
}

/**
 * Génère une réponse de chat locale (jamais de 503).
 */
export function generateChatFallback(message: string, role: string): string {
  const intent = detectIntent(message);

  switch (intent) {
    case "greeting":
      return generateGreeting(role);
    case "grades":
      return generateGradeInfo(role);
    case "predictions":
      return generatePredictionInfo(role);
    case "orientation":
      return generateOrientationInfo();
    default:
      return generateDefaultResponse(message, role);
  }
}
