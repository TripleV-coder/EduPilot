# EduPilot — Sécurité et isolation multi-écoles

> 2026-11-24. **[M]** mesuré · **[C]** lu dans le code · **[D]** audit antérieur non re-vérifié.

## 1. Défenses en place

| Couche | Mécanisme | Preuve |
|---|---|---|
| Accès aux routes | 333 / 336 routes via `createApiHandler` : session, rôle, école active, garde `?schoolId`, mode maintenance | [M] |
| Base de données | RLS forcée (18 instructions `FORCE ROW LEVEL SECURITY`), contexte par requête, rôle `edupilot_app` sans contournement | [M] / [D] ADR-0010 |
| Finance | Garde-fou en base contre les paiements et échéanciers entre écoles (trigger) ; SUPER_ADMIN compris | [C] / tests `payment-school-guard` |
| Ressources par identifiant | `assertModelAccess` (ex. bourses) ; balayage IDOR de 70 routes `[id]` en octobre | [C] / [D] |
| Cache | `Cache-Control: private, no-store` imposé sur toute réponse privée ; service worker limité au statique, purgé à la déconnexion | [C] `api-helpers.ts:365`, `cache-policy.ts` |
| Sessions | JWT, révocation effective (MS-01 corrigé), TOTP natif, « rester connecté 30 j » optionnel | [D] |
| Secrets | Secrets marchands chiffrés AES-256-GCM ; artefact de build vérifié sans secret | [M] build |
| Entrées | Zod sur les routes ; montants en FCFA entiers ; injection CSV neutralisée | [C] / [D] |
| IA | Aucun LLM externe (ADR-0012) ; routes IA sans écriture directe en base | [C] |
| Dépendances | 0 vulnérabilité en production (`npm audit --omit=dev`) | [M] |

## 2. Risques ouverts

| ID | Risque | Priorité |
|---|---|---|
| SEC-01 | 6 vulnérabilités élevées dans les **outils de développement** (CLI Prisma, `@serwist/build`), rien n'est livré | P3 |
| SEC-02 | Escalade **latente** en cumul de rôles STAFF + TEACHER (aucune écriture multi-rôles aujourd'hui) [D] | P2, à traiter avant tout cumul de rôles |
| SEC-03 | ✅ **Corrigé le 2026-11-24** : 20 routes `[id]` apparues depuis octobre n'étaient pas balayées (frais, remboursement, vérification fournisseur, comptes marchands, clubs, examens, corrections de notes, invitations…). Elles le sont toutes : 98 routes, 0 fuite. Un test de complétude fait désormais échouer la suite si une nouvelle route `[id]` n'est ni balayée ni exclue avec un motif | — |
| SEC-04 | ✅ Journal des événements fournisseur en place (FIN-02, 2026-11-24) | — |
| SEC-05 | `DEF-014` (`sharp`, `source-map-js`) sans correctif amont | P3 |
| SEC-06 | La suppression d'une bourse est **définitive** (ligne effacée). Le journal d'audit et le recalcul tracent l'effet, pas le contenu | P3 : proposer une désactivation à la place |

## 3. Données des mineurs et conformité

- Dossier APDP présent (`docs/conformite/APDP_DOSSIER.md`), **non relu dans cette mission**.
- Avant l'envoi au LLM et à n8n, les données personnelles étaient remplacées par des alias.
  Depuis, l'IA est 100 % locale.
- WhatsApp : modèles Meta, dont le texte de l'école est l'unique paramètre. Une **vérification du
  contenu des modèles** (pas de note ni de montant nominatif hors besoin) reste à faire en P2.

## 4. Changements de ce lot

Aucun affaiblissement. La nouvelle route de bourses vérifie que chaque frais visé appartient à
l'école de l'élève (testé avec le frais d'une autre école : 400, aucune écriture).
