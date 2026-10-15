# Validation numérique — 2026-10-14

Le détail du moteur à formules est dans `calculation-engine-audit.md`. Ce document récapitule les calculs
contrôlés, les références et les écarts mesurés.

## 1. Calculs recensés [S]

| Calcul | Implémentation | Représentation |
|---|---|---|
| Moyenne de matière (formule) | `formula.ts`, `average-engine.ts` | fractions BigInt exactes |
| Moyenne générale pondérée par coefficients | `average-engine.ts` | fractions exactes |
| Moyenne annuelle (formule annuelle) | `average-engine.ts` | fractions exactes |
| Arrondi d'affichage au centième | `Rational.toCents` / `toDisplay` | entiers |
| Rang olympique | `competitionRank` | centièmes affichés |
| Statistiques agrégées de notes | `grade-statistics.ts` (SQL `float8`) | **flottant** |
| Montants FCFA, échéanciers | `src/lib/finance/money.ts` | entiers (FCFA sans centimes) |
| Prévision de risque | `src/lib/services/ai-predictive/*` | flottant (estimation statistique) |

## 2. Contrôles exécutés

| Calcul | Référence | Entrées | Écart absolu | Tolérance | Verdict | Preuve |
|---|---|---|---|---|---|---|
| Moyenne de matière officielle | oracle fractions BigInt indépendant | 2 000 cas générés (graine 20261014) | 0 (fractions égales) | exacte | PASS | test O-1 |
| Arrondi au centième | arrondi demi-haut réimplémenté | 2 000 cas | 0 centième | exacte | PASS | O-2 |
| Bornes [min ; max] | propriété | 1 000 cas | — | — | PASS | O-3 |
| Cas manuels | calcul à la main : 1,005→1,01 ; 2/3→0,67 ; 41/3→13,67 ; 12,345 tronqué→12,34 | 4 | 0 | exacte | PASS | O-5 |
| Moyennes servies par le serveur | oracle recalculé depuis les notes brutes de l'API | 33 + 33 moyennes | 0 | exacte | PASS | `evidence/37`, `71` |
| Moyennes stockées vs recalcul | moteur en direct | 2 985 moyennes générales | 0 | exacte | PASS | `evidence/65`, `72` |
| Interface vs API | API | moyenne générale, Anglais | 0 | exacte | PASS | navigateur |
| Moyenne annuelle hors bornes | contrat « jamais hors [0;20] » | formule construite, élève à 10 | **résultat publié 30** | — | **FAIL avant**, PASS après | `evidence/10`, `50` |
| Bancs existants du projet | oracle exact du projet (`tests/precision/oracle.ts`) | routes bulletins, PDF, conseils, orientation, 6 configurations | 0 | exacte | PASS | suite unitaire |

Écart relatif : non calculé — toutes les comparaisons sont des égalités exactes (fractions ou centièmes) ;
un écart relatif n'apporte rien quand l'écart absolu est nul et que le contrat est l'égalité exacte.

## 3. Précision et représentation

- Moyennes : aucune virgule flottante dans la chaîne de calcul ; `0.1 + 0.2 = 3/10` exactement [E].
- Division par zéro : « vide », jamais `Infinity`/`NaN` [E].
- Statistiques agrégées (`grade-statistics.ts`) : calculées en `float8` côté SQL puis arrondies ; non
  comparées à un oracle pendant l'audit (le test d'intégration `grade-statistics.test.ts` les vérifie avec
  des valeurs calculées à la main) [E via suite d'intégration].
- Finances : FCFA entiers, répartition des échéances exacte (`splitInstallments`) [S] ; non retesté ici
  au-delà de la suite existante.

## 4. Prédictions (IA statistique)

Non validées dans cet audit : ce sont des estimations probabilistes (prévision lissée, risque). Les mesures
annoncées dans la documentation du projet (MAE 1,10, couverture 94,3 %) n'ont **pas** été reproduites.

## 5. Limites

Conformité réglementaire des formules officielles non certifiée (référence = documentation interne) ;
aucune comparaison avec un bulletin officiel réel.
