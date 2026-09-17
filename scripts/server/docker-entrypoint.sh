#!/bin/sh
#
# Démarrage du conteneur de production (Lot 7).
#
# 1. Applique les migrations en attente. Une image qui démarre sur une base
#    d'un schéma plus ancien sert des erreurs 500 : mieux vaut refuser de
#    démarrer. `migrate deploy` n'applique que des migrations déjà écrites,
#    ne génère rien et ne supprime rien.
# 2. Lance le serveur standalone AVEC les deux préchargements : adresse client
#    fiable (audit H3) et arrêt propre sur SIGTERM (Lot 7).
#
# `exec` est indispensable : le serveur devient PID 1 et reçoit lui-même le
# SIGTERM de `docker stop`. Sans lui, le shell l'intercepterait et les requêtes
# en cours seraient coupées net.
#
# Variables :
#   DATABASE_URL          — connexion de l'application (rôle non propriétaire
#                           `edupilot_app` lorsque la RLS est en place)
#   MIGRATE_DATABASE_URL  — connexion PROPRIÉTAIRE pour les migrations. Le rôle
#                           applicatif n'a pas le droit de modifier le schéma :
#                           sans cette variable, `migrate deploy` échouerait.
#                           À défaut, DATABASE_URL est utilisée.
#   SKIP_MIGRATIONS=true  — démarre sans migrer (reprise après incident, quand
#                           l'exploitant veut migrer à la main).
set -e

MIGRATION_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}"

if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
  echo "[edupilot] SKIP_MIGRATIONS=true — migrations non appliquées."
elif [ -z "$MIGRATION_URL" ]; then
  echo "[edupilot] ERREUR : ni MIGRATE_DATABASE_URL ni DATABASE_URL ne sont définies." >&2
  exit 1
else
  echo "[edupilot] Application des migrations en attente…"
  DATABASE_URL="$MIGRATION_URL" node node_modules/prisma/build/index.js migrate deploy
  echo "[edupilot] Migrations à jour."
fi

echo "[edupilot] Démarrage du serveur sur le port ${PORT:-3000}."
exec node --require ./client-ip-preload.cjs --require ./graceful-shutdown.cjs server.js
