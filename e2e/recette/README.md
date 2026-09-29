# Recette filmée EduPilot — cycle de vie complet depuis une base vide

Parcours de toute l'application **exclusivement par l'interface**, en conditions réelles :
base PostgreSQL neuve (aucun seed, aucun compte), serveur de production, rôle applicatif soumis à la RLS,
vrais courriels (captés par Mailpit) et vrais SMS (captés par une passerelle de test).

## Étapes (un dossier par étape dans `recette-videos/`)

| Étape | Contenu |
|---|---|
| 00-installation | Site public vierge, installation du super-admin, verrou de `/setup`, erreurs de connexion, mot de passe oublié (courriel réel) |
| 01-plateforme-super-admin | Formules et tarifs, déploiement de 5 établissements (réseau multi-sites, annexe, public, confessionnel, international), quotas, premières connexions, chaque écran de la console root |
| 02-configuration-etablissements | Identité et vitrine, cycles, modules, années, périodes, seuils du conseil, catégories, matières, types d'évaluation, niveaux, salles, options, rôles, conformité, préférences personnelles |
| 03-personnel | Direction, comptable, enseignants, premières connexions, RH (disponibilités, pointage, congés, paie) |
| 04-classes-et-emploi-du-temps | Classes, matières confiées, coefficients, emploi du temps et conflits |
| 05-frais-et-tarifs | Grille tarifaire, échéances, bourses, avis de paiement |
| 06-inscriptions-et-familles | Assistant d'inscription, doublons, fiches élèves, comptes parents, codes de liaison, rattachement |
| 07-vie-scolaire | Appel (collège, primaire), alertes SMS / courriel, justification, suivi, incident → sanction → clôture, infirmerie, contrôle d'accès, cellule d'écoute, rendez-vous |
| 08-pedagogie-et-notes | Devoirs, saisie des notes (plafonds, absences, barème, primaire), cahier de notes, consultation familles, statistiques, examens et cours en ligne |
| 09-finance | Avis de paiement, encaissements, reçus, paiement en ligne, impayés, relances, exports, rapprochement, comptabilité OHADA, cagnotte, finance consolidée |
| 10-communication-et-services | Annonces ciblées, cahier de liaison, messagerie, notifications, SMS, WhatsApp, vocal, événements, calendrier, cantine, transport, bibliothèque, clubs, alumni, orientation, IA, import CSV |
| 11-fin-de-periode | Conseils de classe, bulletins (collège, primaire), consultation par les familles |
| 12-parcours-complet-par-role | Chaque rôle ouvre chaque entrée de son menu |
| 13-configurations-transverses | Téléphone 375 px, thème sombre, anglais, module coupé, cycle retiré, maintenance, 2FA, verrouillage, hors ligne, établissement suspendu |
| 14-securite-et-droits | Chaque rôle × chaque page, accès croisés interdits, API sans droit |
| 15-fin-d-annee | Promotion, clôture de l'année, verrou, nouvelle année, RGPD, journal d'audit |

Dans chaque dossier de scénario : une vidéo par acteur (`<acteur>.mp4`) et **une capture numérotée par action**
(`<acteur>-NNN-<action>.png`, préfixe `ECHEC-` si l'action a échoué). `index.html` rassemble vidéos, albums
de captures et journal ; `RAPPORT.md` liste les échecs et les anomalies (erreurs console, API en erreur,
« NaN » à l'écran…).

## Rejouer depuis zéro

```bash
# 1. Base jetable vide (port ≠ 5432), migrations, rôle applicatif
QUALITY_PG_PORT=5434 node scripts/quality/disposable-pg.mjs edupilot_recette &
export DATABASE_URL="postgresql://edupilot:edupilot@127.0.0.1:5434/edupilot_recette?schema=public"
npx prisma migrate deploy
ADMIN_DATABASE_URL="$DATABASE_URL" APP_DB_PASSWORD=recette-app-role node scripts/db/setup-app-role.mjs

# 2. Courriels (Mailpit : SMTP 1026, interface 8026) et SMS de test (8027)
mailpit --listen 127.0.0.1:8026 --smtp 127.0.0.1:1026 --smtp-auth-accept-any --smtp-auth-allow-insecure &
node e2e/recette/sms-catcher.mjs 8027 &

# 3. Build et serveur de production branché dessus
npm run build
DATABASE_URL="postgresql://edupilot_app:recette-app-role@127.0.0.1:5434/edupilot_recette?schema=public" \
  AUTH_TRUST_HOST=true NEXTAUTH_URL=http://localhost:3100 ROOT_USER_EMAILS= SKIP_ENV_VALIDATION=true \
  UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= RATE_LIMIT_RELAXED=true \
  EMAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1026 SMTP_SECURE=false SMTP_USER=recette SMTP_PASS=recette \
  EMAIL_FROM="EduPilot <no-reply@recette.edupilot.test>" SMS_WEBHOOK_URL=http://127.0.0.1:8027/sms \
  npm run start -- -p 3100 &

# 4. Recette complète (plusieurs heures), puis rapport (vidéos converties en MP4)
rm -rf recette-videos
E2E_BASE_URL=http://localhost:3100 npx playwright test -c playwright.recette.config.ts
node e2e/recette/rapport.mjs
```

Une étape seule : `npx playwright test -c playwright.recette.config.ts 07-` (elle reprend l'état laissé
par les précédentes dans `recette-videos/.etat.json`).

Règle : un échec n'est jamais « corrigé » dans le test pour le faire passer. Le test décrit le comportement
attendu par l'utilisateur ; s'il échoue, c'est l'état réel de l'application.
