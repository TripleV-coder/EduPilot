# ADR-0008 : Multi-tenant — row-level scoping applicatif (V1), RLS Postgres (V2)

**Statut** : Accepté (V1) ; V2 planifiée
**Date** : 2025-03-10

## Contexte
EduPilot sert plusieurs établissements ("écoles") dans la même base de données, avec parfois des organisations regroupant plusieurs écoles. Isolation = obligation contractuelle + RGPD.

## Options évaluées

| Modèle | Pros | Cons | Score |
|--------|------|------|-------|
| **Row-level scoping applicatif (V1)** | Simple à implémenter, queries Prisma standards | Si un dev oublie le filtre `schoolId`, fuite possible | **8/10** (court terme) |
| **Postgres RLS (V2)** | Isolation au niveau DB, défense en profondeur | Impose un mode de connexion spécial (`SET app.tenant_id`) | **9/10** (cible) |
| Schema-per-tenant | Isolation forte | Migration painful, ~1000 schemas pour 1000 écoles | 5/10 |
| DB-per-tenant | Isolation maximale | Coût et complexité multipliés, pas envisageable au stade V1 | 3/10 |

## Décision V1 (en place)
**Scoping applicatif** :
- Chaque entité scoped contient `schoolId`
- `createApiHandler` injecte le contrôle via `getActiveSchoolId(session)` et `canAccessSchool(session, schoolId)`
- Les services Prisma reçoivent `schoolId` en paramètre obligatoire dans leurs filtres

## Décision V2 (prévue)
Activer Postgres **Row-Level Security** :

```sql
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_tenant_isolation ON "Student"
  USING ("schoolId" = current_setting('app.current_tenant_id')::text);
```

Le pool de connexions Prisma sera étendu pour exécuter `SET app.current_tenant_id = '<schoolId>'` au début de chaque transaction. Cela rend l'isolation applicable même en cas de bug applicatif.

## Conséquences positives (V1)
- Implémentation rapide, ROI immédiat
- Performance optimale (filtres natifs Prisma)

## Conséquences négatives (V1)
- Dépendance à la rigueur du dev : un oubli de filtre = fuite
- Mitigation : tests d'isolation systématiques (`tests/lib/school-access.test.ts`, `e2e/security-tenant.spec.ts`)
- Audit log surveillé pour pattern d'accès cross-tenant

## Règles
- **Aucune** query Prisma sur une entité scoped sans clause `where: { schoolId }` (ou équivalent dérivé via relation)
- L'audit log capture l'`activeSchoolId` à chaque mutation pour traçabilité
- Les tests E2E `security-tenant.spec.ts` doivent valider qu'un user de l'école A ne peut **rien** lire de l'école B (200 OK → 403 Forbidden attendu)
- Les routes de l'admin (`SUPER_ADMIN`) sont exemptées de cette isolation mais auditées

## Évolution prévue
1. **Q2 2026** : prototyper RLS sur 3 tables critiques (`Grade`, `Payment`, `Student`)
2. **Q3 2026** : migration progressive table par table avec feature flag
3. **Q4 2026** : RLS sur **toutes** les tables scoped → ce document sera supersedé par un ADR-0011
