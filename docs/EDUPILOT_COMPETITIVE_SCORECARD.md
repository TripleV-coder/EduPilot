# EduPilot — Tableau comparatif mesurable (phase 2)

> Établi le 2026-11-24. Sources, dates et limites : [`EDUPILOT_COMPETITIVE_INTELLIGENCE.md`](EDUPILOT_COMPETITIVE_INTELLIGENCE.md).
> Côté concurrents, rien n'a été **testé**.
>
> Codes : ✅ confirmé (code et tests pour EduPilot ; documentation pour les autres) · 🟡 déclaré
> par l'éditeur · ◐ partiel · ❌ absent (EduPilot seulement : vérifié dans le code) · ? non documenté.

| Critère | **EduPilot** | Geschoul | GestEcole | Eduvate | Scolaria | Logesco | ShuleSoft | EDUCTIVE |
|---|---|---|---|---|---|---|---|---|
| Notes, bulletins, moyennes | ✅ moteur béninois configurable | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | ? |
| Paiement Mobile Money en ligne | ✅ FedaPay (MTN, Moov, Celtiis) | 🟡 | ? | ? | ? | 🟡 | 🟡 | ? |
| Paiement partiel / montant libre | ✅ | ? | ? | ? | ? | ? | ? | ? |
| Tranches (échéancier) | ✅ (imputation chronologique) | ? | ? | ? | ? | ? | ? | ? |
| Solde calculé par le serveur, attentes réservées | ✅ testé en concurrence | ? | ? | ? | ? | ? | ? | ? |
| Bourses et réductions | ◐ **défaut FIN-01** | ? | ? | ? | ? | ? | ? | ? |
| Remboursements tracés | ✅ extourne | ? | ? | ? | ? | ? | ? | ? |
| Fonds sur le compte de l'école | ✅ | ? | ? | ? | ? | ? | ? | ? |
| Paiement de plusieurs enfants en une fois | ❌ | ? | ? | ? | ? | ? | ? | ? |
| Reçus vérifiables (QR) | ❌ (QR seulement sur la carte scolaire) | ? | ? | ? | ? | ? | ? | 🟡 |
| WhatsApp (API officielle) | ✅ Meta Cloud, SMS de secours | ? | ? | ? | ? | ? | 🟡 reçu WhatsApp | ? |
| Hors connexion | ❌ | ? | ? | ? | ? | ? | ? | 🟡 appel |
| Passerelle EducMaster | ❌ | ? | ? | — | ? | ? | — | — |
| IA | ✅ locale (lente sur processeur) | ? | ? | 🟡 assistant en lecture seule | ? | ? | ? | ? |
| Multi-écoles, groupes scolaires | ✅ réseau, isolation RLS | ? | ? | ? | ? | ? | ? | ? |
| Comptabilité OHADA | ◐ paie et cagnottes, **pas la scolarité** | ? | ? | ? | ? | ? | 🟡 | ? |
| API documentée | ◐ `docs/openapi.json`, pas publique | ? | ? | ? | ? | ? | ? | ? |
| 2FA et révocation de session | ✅ | ? | ? | ? | ? | ? | ? | ? |
| Export et portabilité | ✅ CSV/PDF, finance, comptabilité | ? | ? | ? | ? | ? | ? | ? |
| **Prix publié** | ❌ aucune grille arrêtée | ✅ 19 900 F/mois ≤ 500 élèves | ✅ 500 F/élève/an | ✅ 9 000 F/mois ≤ 50 élèves | ? | sur devis | ? | ? |
| **Essai gratuit** | ❌ | ? | installation gratuite | ✅ 30 jours | ? | ? | ? | ? |
| **Écoles clientes publiées** | ❌ 0 pilote | ? | ? | ? | ? | « 200+ » non vérifié | ? | ? |

## Prix rapportés à une école de 300 élèves (un an)

| Offre | Calcul | Total |
|---|---|---|
| GestEcole | 300 × 500 F | **150 000 F** |
| Geschoul | forfait annuel ≤ 500 élèves | **199 000 F** |
| Kolonell (estimation de marché Abidjan) | 300 × 1 000 à 2 500 F | 300 000 à 750 000 F |
| Eduvate | palier > 50 élèves non publié | ? |
| EduPilot | à définir (phase 3) | — |

**Lecture** : le marché béninois **affiché** se situe entre 150 000 et 200 000 F par an pour une
école moyenne. EduPilot ne gagnera pas en dessous de ce prix. Il doit justifier un écart par des
gains démontrables :

- recouvrement des frais ;
- fin des conflits sur les montants ;
- temps de secrétariat économisé ;
- souveraineté des fonds.

C'est l'objet de la phase 3.
