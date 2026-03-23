#!/usr/bin/env python3
"""
EduPilot — Script de génération du Modelfile pour Ollama.
Crée un fichier de configuration Ollama optimisé pour un assistant scolaire.

Usage:
    python3 create_modelfile.py --base-model mistral:7b-instruct --output Modelfile.edupilot
"""

import argparse
from pathlib import Path

SYSTEM_PROMPT = """Tu es EduPilot AI, l'assistant intelligent de la plateforme de gestion scolaire EduPilot, conçu pour les établissements scolaires du Bénin.

Tu es spécialisé dans les domaines suivants :
- **Analyse académique** : moyennes, taux de réussite, classements, tendances, identification des élèves en difficulté
- **Orientation scolaire** : recommandation de séries (A, B, C, D, E, F, G) basée sur les performances par groupe de matières
- **Finance scolaire** : suivi des frais de scolarité, recouvrement, plans de paiement échelonnés, bourses
- **Emploi du temps** : planning des cours, disponibilités des enseignants, gestion des salles
- **Communication** : messages, annonces, convocations parents, bulletins
- **Réglementation** : système éducatif béninois, BEPC, BAC, programmes officiels du MESFTPRIJ

Règles de conduite :
1. Tu réponds TOUJOURS en français
2. Tu es précis, bienveillant et professionnel
3. Tu utilises les données de la plateforme quand elles sont disponibles
4. Quand tu ne sais pas, tu le dis clairement et tu proposes des alternatives
5. Tu respectes la confidentialité des données des élèves
6. Tu formattes tes réponses avec des titres, listes et tableaux quand c'est pertinent"""


def create_modelfile(
    base_model: str,
    output_path: str,
    temperature: float = 0.7,
    top_p: float = 0.9,
    top_k: int = 40,
    num_ctx: int = 4096,
    adapter_path: str | None = None,
) -> None:
    """Génère un Modelfile Ollama."""
    lines = [
        f"FROM {base_model}",
        "",
    ]

    if adapter_path:
        lines.append(f"ADAPTER {adapter_path}")
        lines.append("")

    lines.extend([
        f"PARAMETER temperature {temperature}",
        f"PARAMETER top_p {top_p}",
        f"PARAMETER top_k {top_k}",
        f"PARAMETER num_ctx {num_ctx}",
        f'PARAMETER stop "<|im_end|>"',
        f'PARAMETER stop "</s>"',
        "",
        f'SYSTEM """{SYSTEM_PROMPT}"""',
    ])

    content = "\n".join(lines) + "\n"

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")

    print(f"✅ Modelfile généré : {output_path}")
    print(f"   Modèle de base : {base_model}")
    print(f"   Température : {temperature}")
    print(f"   Contexte : {num_ctx} tokens")
    if adapter_path:
        print(f"   Adaptateur LoRA : {adapter_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Générer un Modelfile Ollama pour EduPilot")
    parser.add_argument("--base-model", default="mistral:7b-instruct", help="Modèle Ollama de base")
    parser.add_argument("--output", default="Modelfile.edupilot", help="Fichier de sortie")
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--top-p", type=float, default=0.9)
    parser.add_argument("--top-k", type=int, default=40)
    parser.add_argument("--num-ctx", type=int, default=4096)
    parser.add_argument("--adapter", default=None, help="Chemin vers un adaptateur LoRA (GGUF)")
    args = parser.parse_args()

    create_modelfile(
        base_model=args.base_model,
        output_path=args.output,
        temperature=args.temperature,
        top_p=args.top_p,
        top_k=args.top_k,
        num_ctx=args.num_ctx,
        adapter_path=args.adapter,
    )
