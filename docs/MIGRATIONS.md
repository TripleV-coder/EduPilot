# Migrations de base de données

Le schéma est décrit par `prisma/schema.prisma`. Son historique est l'ensemble des migrations versionnées dans `prisma/migrations/`. Depuis la version 1.3.0 (audit C1), ces migrations sont suivies par git (`.gitignore` : `!prisma/migrations/**/*.sql`). L'exclusion générale des `*.sql` protège toujours les dumps.

## Règles

- En production, la base évolue **uniquement** par `npx prisma migrate deploy`. N'utilisez jamais `prisma db push` sur une base réelle.
- Chaque modification de `schema.prisma` est accompagnée, dans le même commit, de la migration correspondante.
- La CI (`.github/workflows/ci.yml`, job `integration-tests`) applique toutes les migrations sur une base vide puis exécute `prisma migrate diff --exit-code`. Toute dérive entre les migrations et le schéma bloque la fusion. Le test `tests/integration-db/migrations.test.ts` fait le même contrôle en local (`npm run test:integration`).

## Créer une migration

Sur une base **jetable** uniquement :

```bash
DATABASE_URL=postgresql://…/edupilot_dev_test npx prisma migrate dev --name description_courte
```

Relisez le SQL généré avant de le commiter. Une migration qui supprime une colonne ou une table détruit des données : prévoyez la reprise des données dans la même migration, ou en deux temps.

## Base neuve (installation)

```bash
DATABASE_URL=… npx prisma migrate deploy
```

La base est alors complète. Aucun seed n'est nécessaire : le premier super-administrateur se crée depuis l'interface (`/setup`).

Créez ensuite le rôle applicatif (section suivante) et utilisez-le dans le `DATABASE_URL` de l'application.

## Sécurité par ligne (RLS) et rôles PostgreSQL

Depuis la version 1.3.0 (audit M2, [ADR-0010](adr/0010-rls-effective.md)), la base isole elle-même les établissements sur les données sensibles : élèves, notes, paiements, présences, incidents et sanctions, dossiers médicaux, allergies, vaccinations, contacts d'urgence, évaluations. Les tables sont sous `FORCE ROW LEVEL SECURITY` : sans contexte d'établissement, elles apparaissent vides.

Deux rôles sont nécessaires :

| Rôle | Usage | Attributs |
|---|---|---|
| propriétaire (ex. `edupilot`) | `migrate deploy`, sauvegardes (`pg_dump`), seeds de démonstration, scripts de maintenance | propriétaire des tables, `BYPASSRLS` |
| applicatif (`edupilot_app`) | `DATABASE_URL` de l'application | ni superutilisateur ni `BYPASSRLS`, lecture/écriture des données, aucun droit sur `_prisma_migrations` |

Création ou mise à jour, **par vous**, après chaque `migrate deploy` (idempotent) :

```bash
ADMIN_DATABASE_URL=postgresql://postgres:…@hôte:5432/edupilot \
APP_DB_PASSWORD='<secret de 16 caractères ou plus>' \
node scripts/db/setup-app-role.mjs
```

- `ADMIN_DATABASE_URL` : connexion superutilisateur (création de rôle, attribut `BYPASSRLS` du propriétaire).
- Le mot de passe est lu dans l'environnement, jamais en argument.
- `--owner-role` : propriétaire des tables ; par défaut, celui de la table `users`.

L'application refuse de démarrer en production si son rôle est superutilisateur ou `BYPASSRLS` (le message indique la marche à suivre). Si la base est injoignable au démarrage, le contrôle est journalisé et le démarrage continue.

Une migration qui **modifie des données** d'une table couverte doit s'exécuter avec le rôle propriétaire (`BYPASSRLS`), ce qui est le cas de `migrate deploy`.

## Base existante créée par `db push` (baseline)

Les bases créées avant la version 1.3.0 n'ont pas de table `_prisma_migrations`. Sur une telle base, `migrate deploy` échoue avec l'erreur P3005 (« The database schema is not empty »). La procédure suivante la fait passer sous Prisma Migrate sans toucher aux données métier. **C'est vous qui l'exécutez**, sur la machine qui héberge la base.

1. **Sauvegarde** : `pg_dump -Fc "$DATABASE_URL" > avant-baseline.dump`
2. **Mettre le code à la version cible**, `npm ci` compris.
3. **Aligner le schéma de la base sur celui de cette version**, si ce n'est pas déjà le cas. Le script vous le dira. Pour une base qui suivait `main` avant la 1.3.0, la seule différence attendue est la colonne `schools.offeredLevels`, qui existe déjà si la base a été créée par `db push` après l'ajout des cycles par école.
4. **Baseline** :

   ```bash
   DATABASE_URL=… scripts/db/baseline-migrations.sh
   ```

   Le script vérifie que la base n'est pas déjà gérée par Migrate, puis que son schéma est identique à `schema.prisma`. S'il y a une différence, il s'arrête sans rien modifier et affiche le SQL manquant. Il demande ensuite de taper `BASELINE`. Il rejoue alors les deux opérations que `db push` ne crée pas, toutes deux idempotentes :
   - les politiques RLS : celles de la V1 (`student_profiles`, `grades`, `payments`), puis celles de la RLS effective sur les onze tables sensibles, sous `FORCE ROW LEVEL SECURITY` (audit M2) ;
   - le rattachement `teacher_school_assignments`.

   Enfin, il marque chaque migration comme appliquée et affiche `prisma migrate status`.
5. **Rôle applicatif** : `node scripts/db/setup-app-role.mjs` (section « Sécurité par ligne »), puis `DATABASE_URL` de l'application sur ce rôle.
6. **Mises à jour suivantes** : `npx prisma migrate deploy`, puis de nouveau `setup-app-role.mjs`.

Pour revenir en arrière, restaurez la sauvegarde de l'étape 1 : `pg_restore --clean --if-exists -d "$DATABASE_URL" avant-baseline.dump`.
