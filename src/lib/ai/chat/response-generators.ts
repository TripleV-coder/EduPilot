/**
 * Chat Response Generators — Pattern-matching fallback
 * Used when neither Ollama nor n8n is available.
 * Each function generates a context-aware response for a specific topic.
 */

// =====================
// Intent Detection
// =====================

export function detectIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    const intentPatterns: Record<string, string[]> = {
        greeting: ['bonjour', 'salut', 'bonsoir', 'hello', 'hi'],
        grades: ['note', 'moyenne', 'bulletin', 'évaluation', 'resultat'],
        attendance: ['présence', 'absence', 'retard', 'assiduité'],
        finance: ['paiement', 'frais', 'facture', 'scolarité', 'bourse'],
        schedule: ['emploi du temps', 'horaire', 'planning', 'cours'],
        predictions: ['prédiction', 'prédire', 'risque', 'analyse', 'prévoir'],
        orientation: ['orientation', 'série', 'bac', 'carrière', 'filière'],
        reports: ['rapport', 'générer', 'statistique', 'bilan'],
        help: ['aide', 'comment', 'utiliser', 'guide', 'help'],
    };

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
        if (patterns.some(pattern => lowerMessage.includes(pattern))) {
            return intent;
        }
    }

    return 'default';
}

// =====================
// Response Generators
// =====================

export function generateGreeting(role: string): string {
    const isPublic = role === 'PUBLIC';

    return `Bonjour! Je suis **EduPilot AI**, l'assistant intelligent de la plateforme de gestion scolaire.

${isPublic ? `
Je suis là pour vous aider à comprendre comment fonctionne EduPilot et répondre à vos questions sur la gestion scolaire.
` : `
Je peux vous aider avec de nombreuses tâches:

**Pour les enseignants:**
- Analyser les performances des élèves
- Suivre les présences
- Gérer les notes et évaluations
- Détecter les élèves à risque

**Pour les administrateurs:**
- Rapports financiers et académiques
- Analyse globale de l'école
- Optimisation des ressources
- Génération d'alertes automatiques

**Pour les parents:**
- Suivi des notes de leur enfant
- Consultation des présences
- Paiement des frais
- Communication avec l'école
`}

Que puis-je faire pour vous aujourd'hui?`;
}

export function generateGradeInfo(role: string): string {
    return `**Système de Notation EduPilot:**

L'échelle de notation est de 0 à 20:
- 18-20: Excellent
- 14-17: Très Bien à Bien
- 10-13: Assez Bien à Passable
- Moins de 10: Insuffisant

${role === 'TEACHER' || role === 'SCHOOL_ADMIN' || role === 'DIRECTOR' ?
            `**En tant qu'enseignant, vous pouvez:**
- Créer des évaluations et saisir des notes
- Calculer automatiquement les moyennes
- Suivre la progression des élèves
- Générer des bulletins` :
            role === 'PARENT' ?
                `**En tant que parent, vous pouvez:**
- Consulter les notes de votre enfant
- Recevoir des notifications pour chaque nouvelle note
- Comparer avec la moyenne de la classe` :
                `**Vos notes sont:**
- Enregistrées par vos enseignants
- Utilisées pour calculer votre moyenne
- Transmises à vos parents automatiquement`
        }

Avez-vous besoin d'aide pour une action spécifique?`;
}

export function generateAttendanceInfo(role: string): string {
    return `**Gestion des Présences:**

Le système de présence EduPilot permet:
- Enregistrement en temps réel
- Statuts: Présent, Absent, Retard, Justifié
- Notifications automatiques aux parents
- Calcul automatique du taux de présence

${role === 'TEACHER' ?
            `- Faire l'appel depuis "Mes Classes"
- Marquer les absences et retards
- Justifier les absences` :
            role === 'PARENT' ?
                `- Consulter les présences de votre enfant
- Justifier les absences en ligne
- Recevoir des alertes` :
                `- Vos présences sont enregistrées quotidiennement
- Les parents sont notifiés des absences
- Un taux < 80% déclenche une alerte`
        }

Voulez-vous plus d'informations sur les présences?`;
}

export function generateFinanceInfo(role: string): string {
    return `**Gestion Financière:**

Types de frais disponibles:
- Frais de scolarité (échelonnés possibles)
- Frais d'inscription
- Frais d'examen
- Frais d'activités

Modes de paiement:
- Paiement en ligne
- Mobile Money (MTN, Moov)
- Virement bancaire
- Espèces

${role === 'SCHOOL_ADMIN' || role === 'ACCOUNTANT' ?
            `**Gestion administrateur:**
- Créer et modifier les frais
- Suivre les paiements
- Générer des rappels automatiques
- Gérer les bourses et réductions` :
            role === 'PARENT' ?
                `**Espace parent:**
- Consulter les factures
- Effectuer un paiement
- Télécharger les reçus
- Demander une bourse` :
                `Les frais sont gérés par l'administration.
Contactez l'école pour les détails.`
        }

Avez-vous des questions sur les paiements?`;
}

export function generateScheduleInfo(role: string): string {
    return `**Emploi du Temps:**

Fonctionnalités disponibles:
- Vue journalière et hebdomadaire
- Détection automatique des conflits
- Attribution des salles
- Gestion des remplacements

${role === 'TEACHER' ?
            `- Consulter votre planning personnel
- Signaler une absence de cours
- Demander un remplacement` :
            role === 'STUDENT' || role === 'PARENT' ?
                `- Consulter l'emploi du temps
- Identifier les cours de la journée
- Préparer le matériel nécessaire` :
                `- Planification par classe
- Affectation des enseignants
- Optimisation des ressources`
        }

Voulez-vous voir un emploi du temps spécifique?`;
}

export function generatePredictionInfo(role: string): string {
    return `**Prédictions et Analyses IA:**

L'IA d'EduPilot analyse les données pour:

**1. Détection des risques d'échec:**
- Basé sur les notes, présences et comportement
- Niveaux: Faible, Modéré, Élevé, Critique
- Alertes automatiques aux enseignants

**2. Prédiction des notes:**
- Estimation de la prochaine moyenne
- Tendance: amélioration, stable, baisse
- Intervalle de confiance fourni

**3. Recommandations:**
- Interventions personnalisées
- Suggestions de tutorat
- Réunion parents-enseignants

${role === 'SCHOOL_ADMIN' || role === 'DIRECTOR' ?
            `**Dashboard administrateur:**
- Vue globale des risques
- Rapports par classe
- Statistiques de l'école` :
            role === 'TEACHER' ?
                `**Dashboard enseignant:**
- Élèves à risque dans vos classes
- Analyses par matière
- Recommandations d'intervention` :
                `Les prédictions sont basées sur:
- Votre historique de notes
- Votre assiduité
- Les tendances observées`
        }

Sur quel aspect souhaitez-vous des détails?`;
}

export function generateOrientationInfo(): string {
    return `**Orientation Scolaire - Système Béninois:**

**Séries du Baccalauréat:**

**Générales:**
- **Série A1**: Littéraire - Français, Langues, Philosophie
- **Série A2**: Sciences Humaines
- **Série C**: Mathématiques, Physique-Chimie
- **Série D**: Sciences Naturelles (SVT)

**Techniques:**
- **Série E**: Sciences et Techniques
- **Série F**: Techniques Industrielles
- **Série G**: Gestion, Comptabilité
- **Série TI**: Informatique

**Comment choisir?**
L'IA analyse:
- Vos meilleures matières
- Vos centres d'intérêt
- Les tendances de vos notes

**Recommandations personnalisées:**
Contactez l'orientation pour une analyse complète.

Voulez-vous des conseils pour choisir votre série?`;
}

export function generateReportInfo(role: string): string {
    return `**Génération de Rapports:**

Types de rapports disponibles:

${role === 'SCHOOL_ADMIN' || role === 'DIRECTOR' ?
            `- **Rapport académique**: Performance globale
- **Rapport financier**: Recouvrements et impayés
- **Rapport de présence**: Statistiques par classe
- **Rapport de risque**: Élèves à surveiller
- **Rapport annuel**: Bilan complet` :
            role === 'TEACHER' ?
                `- **Rapport de classe**: Performances de vos classes
- **Rapport individuel**: Élève spécifique
- **Rapport de présence**: Statistiques
- **Bilan trimestriel**: À utiliser pour les conseils` :
                `- **Bulletin**: Vos résultats scolaires
- **Relevé de notes**: Historique complet
- **Certificat de présence**: Pour les administrations`
        }

Quel type de rapport souhaitez-vous générer?`;
}

export function generateHelpInfo(role: string): string {
    return `**Guide d'Utilisation EduPilot:**

**Connexion:**
- Utilisez votre email et mot de passe
- Mot de passe oublié: utilisez "Mot de passe oublié"

**Navigation:**
- Menu latéral pour accéder aux sections
- Notifications en haut à droite
- Barre de recherche globale

**Actions principales:**

${role === 'STUDENT' ?
            `- **Mes Notes**: Consulter vos résultats
- **Devoirs**: Travail à faire
- **Présences**: Votre assiduité
- **Orientation**: Conseils pour votre parcours` :
            role === 'PARENT' ?
                `- **Suivi enfant**: Vue d'ensemble
- **Paiements**: Gérer les frais
- **Messages**: Communication école
- **Rendez-vous**: Prendre RDV enseignants` :
                role === 'TEACHER' ?
                    `- **Mes Classes**: Gérer vos classes
- **Notes**: Saisir les évaluations
- **Présences**: Faire l'appel
- **Devoirs**: Créer des devoirs` :
                    `- **Dashboard**: Vue d'ensemble
- **Paramètres**: Configuration
- **Utilisateurs**: Gestion des accès
- **Rapports**: Analyses globales`
        }

Que souhaitez-vous apprendre à faire?`;
}

export function generateDefaultResponse(message: string, role: string): string {
    const isPublic = role === 'PUBLIC';

    if (isPublic) {
        return `Je vois que vous souhaitez en savoir plus sur **"${message.slice(0, 50)}..."**.

Je suis l'assistant d'EduPilot, une plateforme de gestion scolaire complète. Voici ce que je peux vous expliquer:

**Fonctionnalités principales:**
- Gestion des notes et bulletins scolaires
- Suivi des présences et absences
- Paiement des frais scolaires
- Gestion des emplois du temps
- Analyses et prédictions IA
- Orientation scolaire (séries du Bac)
- Communication entre école et parents

Que souhaitez-vous explorer en détail?`;
    }

    return `Je comprends que vous avez une question sur "${message.slice(0, 50)}...".

**Je peux vous aider avec:**

📊 **Académique:** Notes, évaluations, moyennes
📈 **Suivi:** Présences, comportement, progression
💰 **Financier:** Frais, paiements, bourses
📅 **Organisation:** Emplois du temps, calendrier
🔮 **IA & Prédictions:** Risques, prédictions, recommandations
🎯 **Orientation:** Séries, parcours, carrières

Pourriez-vous préciser votre question?`;
}

/**
 * Generate a local response based on intent detection
 */
export function generateLocalResponse(message: string, role: string): string {
    const intent = detectIntent(message);

    switch (intent) {
        case 'greeting': return generateGreeting(role);
        case 'grades': return generateGradeInfo(role);
        case 'attendance': return generateAttendanceInfo(role);
        case 'finance': return generateFinanceInfo(role);
        case 'schedule': return generateScheduleInfo(role);
        case 'predictions': return generatePredictionInfo(role);
        case 'orientation': return generateOrientationInfo();
        case 'reports': return generateReportInfo(role);
        case 'help': return generateHelpInfo(role);
        default: return generateDefaultResponse(message, role);
    }
}
