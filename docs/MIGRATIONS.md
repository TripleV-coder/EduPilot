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
   - les politiques RLS de `student_profiles`, `grades` et `payments` ;
   - le rattachement `teacher_school_assignments`.

   Enfin, il marque chaque migration comme appliquée et affiche `prisma migrate status`.
5. **Mises à jour suivantes** : `npx prisma migrate deploy`.

Pour revenir en arrière, restaurez la sauvegarde de l'étape 1 : `pg_restore --clean --if-exists -d "$DATABASE_URL" avant-baseline.dump`.
