#!/usr/bin/env bash
# ==============================================================================
# commit-remediation.sh
#
# Committe en sécurité l'état de remédiation EduPilot (rapport du 16/08/2026) :
#   1. Sauvegarde intégrale hors Git (protection avant toute manip)
#   2. Isole et committe séparément les suppressions de configs d'outils IA
#      (.tools .agent .claude .windsurf)
#   3. Committe le vrai code par lots thématiques (groupes calibrés sur
#      l'arborescence réelle — vérifiés via `git status --porcelain`)
#   4. Revalide le build sur l'état commité (tsc / eslint / vitest / next build)
#   5. Affiche le résumé — PUSH JAMAIS AUTOMATIQUE (réponse "o" requise)
#
# Usage (depuis la RACINE du dépôt EduPilot) :
#   chmod +x commit-remediation.sh
#   ./commit-remediation.sh              # exécution normale
#   ./commit-remediation.sh --dry-run    # simulation, rien n'est modifié
#   ./commit-remediation.sh --no-validate  # saute l'étape 4
#
# Sécurité :
#   - `git add` uniquement sur des chemins explicites (jamais `git add .`)
#   - Les fichiers non classés sont LISTÉS et laissés intacts (jamais commités)
#   - Le push exige une réponse explicite "o" (défaut : non, EOF => non)
# ==============================================================================

set -euo pipefail

# ---------- Configuration ------------------------------------------------------

BRANCHE_ATTENDUE="cursor/changelog-unreleased-roadmap"
DOSSIERS_OUTILS_IA=(".tools" ".agent" ".claude" ".windsurf")
BACKUP_DIR="../edupilot-backups"
DRY_RUN=false
SKIP_VALIDATE=false

# Préfixes de chemin (dans cet ORDRE, le premier match gagne) -> message de commit
declare -a PREFIXES=(
  "src/proxy.ts"
  "src/app/api"
  "src/app/(dashboard)"
  "src/app/(auth)"
  "src/app/ecoles"
  "src/app/ecole"
  "src/app/layout.tsx"
  "src/app/page.tsx"
  "src/lib"
  "src/components"
  "tests"
  "e2e"
  "prisma"
  "vitest.config.ts"
  "eslint.config.mjs"
  ".lighthouserc.js"
  "Dockerfile"
  "docker-compose.yml"
  ".github"
  "scripts"
  "commit-remediation.sh"
  "docs"
  "README.md"
  "CHANGELOG.md"
  "TECH_DEBT.md"
  "RAPPORT_ANALYSE.md"
  "RAPPORT_ETAT_2026-08-16.md"
  "EduPilot_Dossier_Produit.pdf"
  "EduPilot_Dossier_Technique.pdf"
  ".archive"
)

MESSAGE() {
  case "$1" in
    "src/proxy.ts")                 echo "fix(proxy): remédiation middleware edge (maintenance, rate-limit)" ;;
    "src/app/api")                  echo "fix(api): remédiation routes API (createApiHandler, communication)" ;;
    "src/app/(dashboard)")          echo "fix(dashboard): remédiation pages dashboard" ;;
    "src/app/(auth)")               echo "fix(auth): remédiation pages auth (mfa-setup)" ;;
    "src/app/ecoles"|"src/app/ecole") echo "fix(public): remédiation vitrine publique" ;;
    "src/app/layout.tsx"|"src/app/page.tsx") echo "fix(app): remédiation layout et page racine" ;;
    "src/lib")                      echo "fix(lib): remédiation lib (api-helpers, tenant-rls, communication)" ;;
    "src/components")               echo "fix(components): remédiation composants" ;;
    "tests")                        echo "test(remediation): tests API/lib (nouveaux + ajustés)" ;;
    "e2e")                          echo "test(e2e): ajustements specs Playwright" ;;
    "prisma")                       echo "chore(prisma): ajustement seeds" ;;
    "vitest.config.ts"|"eslint.config.mjs"|".lighthouserc.js"|"Dockerfile"|"docker-compose.yml")
                                    echo "chore(config): remédiation configuration" ;;
    ".github")                      echo "chore(ci): ajustement workflows" ;;
    "scripts")                      echo "chore(scripts): scripts génération dossiers + migration" ;;
    "commit-remediation.sh")        echo "chore(scripts): script de commit de remédiation" ;;
    "docs"|"README.md"|"CHANGELOG.md"|"TECH_DEBT.md"|"RAPPORT_ANALYSE.md"|"RAPPORT_ETAT_2026-08-16.md")
                                    echo "docs(remediation): dossiers et rapports" ;;
    "EduPilot_Dossier_Produit.pdf"|"EduPilot_Dossier_Technique.pdf")
                                    echo "docs(livrables): dossiers produit et technique" ;;
    ".archive")                     echo "chore: retrait d'archive obsolète" ;;
    *)                              echo "fix(remediation): $1" ;;
  esac
}

# ---------- Utilitaires ---------------------------------------------------------

log()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }

# Exécute une commande, ou l'affiche en clair si --dry-run.
exec_cmd() {
  if $DRY_RUN; then
    printf '  [dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

# Question oui/non — défaut NON (EOF ou réponse vide => non).
ask_yes() {
  local rep
  read -rp "$1 (o/N) " rep || return 1
  [[ "$rep" =~ ^[oO]$ ]]
}

# ---------- Arguments -------------------------------------------------------------

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --no-validate) SKIP_VALIDATE=true ;;
    *) echo "Argument inconnu : $arg" >&2; exit 1 ;;
  esac
done

# ---------- Vérifications préalables ------------------------------------------------

log "Vérifications préalables"

git rev-parse --is-inside-work-tree > /dev/null 2>&1 || { echo "Pas un dépôt Git." >&2; exit 1; }

BRANCHE_ACTUELLE=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCHE_ACTUELLE" != "$BRANCHE_ATTENDUE" ]]; then
  warn "Branche actuelle : $BRANCHE_ACTUELLE (attendue : $BRANCHE_ATTENDUE)"
  ask_yes "Continuer quand même ?" || exit 1
fi
ok "Dépôt Git détecté sur la branche $BRANCHE_ACTUELLE"

# ---------- Étape 1 : sauvegarde intégrale hors Git ----------------------------------

log "Étape 1/5 — Sauvegarde intégrale hors Git"

mkdir -p "$BACKUP_DIR"
HORODATAGE=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$BACKUP_DIR/edupilot-backup-$HORODATAGE.tar.gz"

exec_cmd tar czf "$ARCHIVE" \
  --exclude=node_modules --exclude=.next \
  --exclude=coverage --exclude=test-results --exclude=playwright-report \
  --exclude=tsconfig.tsbuildinfo .

ok "Sauvegarde créée : $ARCHIVE"
echo "  Ne supprime pas ce fichier tant que tout n'est pas poussé et revérifié."

# ---------- Étape 2 : isoler et committer les suppressions d'outils IA ----------------

log "Étape 2/5 — Suppressions de configs d'outils IA (${DOSSIERS_OUTILS_IA[*]})"

EXISTANTS=()
for d in "${DOSSIERS_OUTILS_IA[@]}"; do
  if [[ -n "$(git status --porcelain -- "$d")" ]]; then
    EXISTANTS+=("$d")
  fi
done

if [[ ${#EXISTANTS[@]} -eq 0 ]]; then
  warn "Aucune suppression détectée sous ces dossiers — étape sautée."
else
  # Snapshot des fichiers déjà stagés AVANT cette étape (ex : rename en cours)
  STAGES_AVANT=$(git diff --cached --name-only)

  exec_cmd git add -- "${EXISTANTS[@]}"

  echo "  Contenu stagé pour ce commit :"
  git diff --cached --stat -- "${EXISTANTS[@]}" | tail -n 20

  # Garde-fou : les NOUVEAUX fichiers stagés par cette étape doivent tous
  # être sous les dossiers d'outils IA (les fichiers déjà stagés avant sont
  # ignorés)
  HORS_PERIMETRE=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    grep -qxF "$f" <<< "$STAGES_AVANT" && continue
    dans_perimetre=false
    for d in "${EXISTANTS[@]}"; do
      [[ "$f" == "$d"* ]] && dans_perimetre=true && break
    done
    $dans_perimetre || HORS_PERIMETRE=1
  done < <(git diff --cached --name-only)

  if [[ "$HORS_PERIMETRE" -eq 1 ]]; then
    warn "Des fichiers hors des dossiers d'outils IA sont stagés — annulation."
    exec_cmd git restore --staged .
    exit 1
  fi

  exec_cmd git commit -m "chore: retrait des configs d'outils IA commitées par erreur"
  ok "Commit de nettoyage créé"
fi

# ---------- Étape 3 : committer le vrai code par lots thématiques ---------------------

log "Étape 3/5 — Code applicatif par lots thématiques"

# Les dossiers d'outils IA sont traités à l'étape 2 — exclus ici
mapfile -t FICHIERS < <(git status --porcelain --untracked-files=all --no-renames | cut -c4- | grep -v -E "^\.(tools|agent|claude|windsurf)/" || true)

declare -A ASSIGNE=()

for prefix in "${PREFIXES[@]}"; do
  MATCHES=()
  for f in "${FICHIERS[@]}"; do
    [[ -n "${ASSIGNE[$f]:-}" ]] && continue
    if [[ "$f" == "$prefix"* ]]; then
      MATCHES+=("$f")
      ASSIGNE["$f"]=1
    fi
  done

  [[ ${#MATCHES[@]} -eq 0 ]] && continue

  echo "  Lot '${prefix#src/}' (${#MATCHES[@]} fichiers) :"
  printf '    %s\n' "${MATCHES[@]}" | head -n 8 || true
  [[ ${#MATCHES[@]} -gt 8 ]] && echo "    … et $(( ${#MATCHES[@]} - 8 )) autres"

  exec_cmd git add -- "${MATCHES[@]}"
  exec_cmd git commit -m "$(MESSAGE "$prefix")"
  ok "Commit '${prefix#src/}' créé"
done

# Fichiers restants non classés — jamais commités automatiquement
RESTANTS=()
for f in "${FICHIERS[@]}"; do
  [[ -z "${ASSIGNE[$f]:-}" ]] && RESTANTS+=("$f")
done

if [[ ${#RESTANTS[@]} -gt 0 ]]; then
  warn "Fichiers non couverts par un lot (${#RESTANTS[@]}) — laissés intacts :"
  printf '    %s\n' "${RESTANTS[@]}"
else
  ok "Tous les fichiers ont été classés dans un lot thématique"
fi

# ---------- Étape 4 : revalider le build sur l'état commité ---------------------------

if ! $SKIP_VALIDATE; then
  log "Étape 4/5 — Revalidation (tsc, eslint, vitest, next build)"

  if [[ -n "$(git status --porcelain)" ]]; then
    warn "Il reste des changements non commités — la revalidation ne portera pas sur un état 100% commité."
  fi

  exec_cmd npx tsc --noEmit
  exec_cmd npx eslint src
  exec_cmd npx vitest run
  exec_cmd npx next build

  ok "Revalidation terminée"
else
  warn "Revalidation sautée (--no-validate)"
fi

# ---------- Étape 5 : résumé ------------------------------------------------------------

log "Étape 5/5 — Résumé"

echo "  Commits créés :"
git log --oneline -15 || true
echo

if ask_yes "Pousser '$BRANCHE_ACTUELLE' vers origin ?"; then
  exec_cmd git push origin "$BRANCHE_ACTUELLE"
  ok "Poussé sur origin/$BRANCHE_ACTUELLE"
else
  echo "  Rien poussé. Vérifie l'historique avec 'git log' avant de pousser manuellement."
fi

ok "Terminé. Sauvegarde conservée dans $ARCHIVE — à supprimer seulement une fois tout vérifié."