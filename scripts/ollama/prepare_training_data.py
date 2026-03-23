#!/usr/bin/env python3
"""
EduPilot — Script de préparation des données d'entraînement pour Ollama.
Génère un fichier JSONL contenant des conversations Q&A scolaires
au format attendu par le fine-tuning Ollama/Hugging Face.

Usage:
    python3 prepare_training_data.py --output training_data.jsonl --samples 500
"""

import json
import argparse
import random
from pathlib import Path

SYSTEM_PROMPT = (
    "Tu es EduPilot AI, un assistant intelligent spécialisé dans la gestion scolaire "
    "au Bénin. Tu aides les directeurs, enseignants, parents et élèves avec les "
    "statistiques académiques, l'emploi du temps, la finance scolaire et l'orientation."
)

# ═══════════════════════════════════════════════════════════════
# Banque de questions/réponses par catégorie
# ═══════════════════════════════════════════════════════════════

TEMPLATES = {
    "statistiques": [
        {
            "user": "Quel est le taux de réussite de la classe de {classe} ?",
            "assistant": "Le taux de réussite de la classe de {classe} est de {taux}%. "
                         "Sur {total} élèves, {reussis} ont obtenu la moyenne (≥10/20). "
                         "Les matières les mieux réussies sont {matieres}.",
        },
        {
            "user": "Quelle est la moyenne générale de la {classe} ?",
            "assistant": "La moyenne générale de la {classe} est de {moyenne}/20. "
                         "C'est {tendance} par rapport au trimestre précédent. "
                         "La note la plus haute est {max}/20 et la plus basse est {min}/20.",
        },
        {
            "user": "Combien d'élèves sont en difficulté en {classe} ?",
            "assistant": "En {classe}, {nb_difficulte} élèves sur {total} ont une moyenne "
                         "inférieure à 10/20, soit {pct_difficulte}% de la classe. "
                         "Les matières qui posent le plus de problèmes sont {matieres_faibles}. "
                         "Je recommande un soutien ciblé dans ces disciplines.",
        },
    ],
    "emploi_du_temps": [
        {
            "user": "Quel est l'emploi du temps de la {classe} pour {jour} ?",
            "assistant": "Voici l'emploi du temps de la {classe} pour {jour} :\n"
                         "- {h1} : {matiere1} (Salle {salle1})\n"
                         "- {h2} : {matiere2} (Salle {salle2})\n"
                         "- {h3} : {matiere3} (Salle {salle3})\n"
                         "Total : {nb_heures} heures de cours.",
        },
    ],
    "finance": [
        {
            "user": "Quel est l'état du recouvrement des frais de scolarité ?",
            "assistant": "Le taux de recouvrement global est de {taux_recouvrement}%. "
                         "Sur {total_attendu} FCFA attendus, {total_recu} FCFA ont été "
                         "encaissés. Il reste {restant} FCFA à recouvrer. "
                         "{nb_retard} élèves ont des retards de paiement.",
        },
        {
            "user": "Quels élèves ont des retards de paiement ?",
            "assistant": "Voici les élèves avec les plus gros retards de paiement :\n"
                         "1. {eleve1} — {montant1} FCFA (Classe {classe1})\n"
                         "2. {eleve2} — {montant2} FCFA (Classe {classe2})\n"
                         "3. {eleve3} — {montant3} FCFA (Classe {classe3})\n"
                         "Je recommande d'envoyer des rappels aux parents concernés.",
        },
    ],
    "orientation": [
        {
            "user": "Quelle orientation recommandes-tu pour un élève avec {moyenne} de moyenne ?",
            "assistant": "Avec une moyenne de {moyenne}/20, voici mes recommandations :\n\n"
                         "**Profil dominant** : {profil}\n"
                         "**Séries recommandées** :\n"
                         "1. Série {serie1} — Score de compatibilité : {score1}%\n"
                         "2. Série {serie2} — Score de compatibilité : {score2}%\n\n"
                         "**Points forts** : {forces}\n"
                         "**Points à améliorer** : {faiblesses}\n\n"
                         "Cette recommandation est basée sur l'analyse des performances "
                         "par groupe de matières sur les 3 derniers trimestres.",
        },
    ],
    "pedagogique": [
        {
            "user": "Comment améliorer les résultats en {matiere} ?",
            "assistant": "Pour améliorer les résultats en {matiere}, voici mes suggestions :\n\n"
                         "1. **Diagnostic** : Identifier les lacunes spécifiques via les "
                         "évaluations diagnostiques\n"
                         "2. **Soutien ciblé** : Organiser des séances de {nb_seances} heures "
                         "par semaine pour les élèves en difficulté\n"
                         "3. **Méthode** : Utiliser {methode} pour rendre la matière plus "
                         "accessible\n"
                         "4. **Suivi** : Programmer une évaluation de contrôle dans {delai}\n\n"
                         "D'après les données, les élèves qui ont suivi un soutien similaire "
                         "ont amélioré leur moyenne de {amelioration} points en moyenne.",
        },
    ],
}

# ═══════════════════════════════════════════════════════════════
# Données de remplissage
# ═══════════════════════════════════════════════════════════════

CLASSES = ["6ème A", "6ème B", "5ème A", "5ème B", "4ème A", "4ème B",
           "3ème A", "3ème B", "2nde A", "2nde C", "1ère D", "Tle D"]
JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
MATIERES = ["Mathématiques", "Français", "Anglais", "SVT", "Physique-Chimie",
            "Histoire-Géographie", "Philosophie", "EPS", "PCT", "Informatique"]
SERIES = ["A", "B", "C", "D", "E", "F1", "G1", "G2"]
PROFILS = ["Littéraire", "Scientifique", "Économique", "Technique"]
METHODES = ["des exercices pratiques et des TP", "la pédagogie différenciée",
            "des supports visuels et interactifs", "le travail en binôme"]
PRENOMS = ["Kossi", "Aïcha", "Jean", "Fatou", "Boris", "Amina", "Patrick",
           "Rachida", "Hervé", "Blessing", "Codjo", "Nafissatou"]
NOMS = ["Houngbédji", "Dossou", "Adjakou", "Sanni", "Agbossou", "Yessoufou",
        "Ahouandjinou", "Gbaguidi", "Tossou", "Adjibadé"]


def fill_template(template: dict) -> dict:
    """Remplit un template avec des valeurs aléatoires réalistes."""
    classe = random.choice(CLASSES)
    matiere = random.choice(MATIERES)
    total = random.randint(30, 55)
    moyenne = round(random.uniform(8.5, 15.5), 2)
    taux = round(random.uniform(55, 92), 1)
    reussis = int(total * taux / 100)

    replacements = {
        "{classe}": classe,
        "{jour}": random.choice(JOURS),
        "{taux}": str(taux),
        "{total}": str(total),
        "{reussis}": str(reussis),
        "{moyenne}": str(moyenne),
        "{max}": str(round(random.uniform(16, 19.5), 2)),
        "{min}": str(round(random.uniform(2, 7), 2)),
        "{tendance}": random.choice(["en hausse", "stable", "en légère baisse"]),
        "{matieres}": ", ".join(random.sample(MATIERES, 2)),
        "{matieres_faibles}": ", ".join(random.sample(MATIERES, 2)),
        "{nb_difficulte}": str(total - reussis),
        "{pct_difficulte}": str(round(100 - taux, 1)),
        "{matiere}": matiere,
        "{matiere1}": random.choice(MATIERES),
        "{matiere2}": random.choice(MATIERES),
        "{matiere3}": random.choice(MATIERES),
        "{salle1}": str(random.randint(1, 20)),
        "{salle2}": str(random.randint(1, 20)),
        "{salle3}": str(random.randint(1, 20)),
        "{h1}": f"{random.randint(7, 9)}h00-{random.randint(9, 11)}h00",
        "{h2}": f"{random.randint(10, 12)}h00-{random.randint(12, 13)}h00",
        "{h3}": f"{random.randint(14, 15)}h00-{random.randint(16, 17)}h00",
        "{nb_heures}": str(random.randint(5, 8)),
        "{taux_recouvrement}": str(round(random.uniform(60, 90), 1)),
        "{total_attendu}": f"{random.randint(5, 50) * 100_000:,}".replace(",", " "),
        "{total_recu}": f"{random.randint(3, 40) * 100_000:,}".replace(",", " "),
        "{restant}": f"{random.randint(1, 15) * 100_000:,}".replace(",", " "),
        "{nb_retard}": str(random.randint(5, 30)),
        "{eleve1}": f"{random.choice(PRENOMS)} {random.choice(NOMS)}",
        "{eleve2}": f"{random.choice(PRENOMS)} {random.choice(NOMS)}",
        "{eleve3}": f"{random.choice(PRENOMS)} {random.choice(NOMS)}",
        "{montant1}": f"{random.randint(50, 300) * 1000:,}".replace(",", " "),
        "{montant2}": f"{random.randint(30, 200) * 1000:,}".replace(",", " "),
        "{montant3}": f"{random.randint(20, 150) * 1000:,}".replace(",", " "),
        "{classe1}": random.choice(CLASSES),
        "{classe2}": random.choice(CLASSES),
        "{classe3}": random.choice(CLASSES),
        "{profil}": random.choice(PROFILS),
        "{serie1}": random.choice(SERIES),
        "{serie2}": random.choice(SERIES),
        "{score1}": str(random.randint(75, 95)),
        "{score2}": str(random.randint(60, 80)),
        "{forces}": ", ".join(random.sample(MATIERES, 2)),
        "{faiblesses}": ", ".join(random.sample(MATIERES, 2)),
        "{nb_seances}": str(random.randint(2, 4)),
        "{methode}": random.choice(METHODES),
        "{delai}": random.choice(["2 semaines", "1 mois", "3 semaines"]),
        "{amelioration}": str(round(random.uniform(1, 3.5), 1)),
    }

    user_msg = template["user"]
    assistant_msg = template["assistant"]
    for key, val in replacements.items():
        user_msg = user_msg.replace(key, val)
        assistant_msg = assistant_msg.replace(key, val)

    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
            {"role": "assistant", "content": assistant_msg},
        ]
    }


def generate_dataset(output_path: str, num_samples: int) -> None:
    """Génère un fichier JSONL avec des échantillons d'entraînement."""
    all_templates = []
    for category, templates in TEMPLATES.items():
        for t in templates:
            all_templates.append((category, t))

    samples = []
    for _ in range(num_samples):
        category, template = random.choice(all_templates)
        samples.append(fill_template(template))

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    print(f"✅ {num_samples} échantillons générés dans {output_path}")
    print(f"   Catégories couvertes : {', '.join(TEMPLATES.keys())}")
    print(f"   Taille : {output.stat().st_size / 1024:.1f} Ko")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Préparer les données de fine-tuning EduPilot")
    parser.add_argument("--output", default="training_data.jsonl", help="Fichier de sortie JSONL")
    parser.add_argument("--samples", type=int, default=500, help="Nombre d'échantillons")
    parser.add_argument("--seed", type=int, default=42, help="Seed aléatoire")
    args = parser.parse_args()

    random.seed(args.seed)
    generate_dataset(args.output, args.samples)
