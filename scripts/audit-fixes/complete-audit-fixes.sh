#!/bin/bash

# Script de correction automatique des routes API
# Ce script applique les corrections aux routes API restantes

echo "=== Correction automatique des routes API EduPilot ==="

# Fichiers à corriger
FILES=(
  "src/app/api/students/route.ts"
  "src/app/api/teachers/route.ts"
  "src/app/api/grades/route.ts"
  "src/app/api/payments/route.ts"
  "src/app/api/classes/route.ts"
  "src/app/api/subjects/route.ts"
  "src/app/api/announcements/route.ts"
  "src/app/api/attendance/route.ts"
  "src/app/api/evaluations/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Traitement de $file..."

    # Remplacer console.error par logger.error
    sed -i 's/console\.error("Error\(.*\)", error)/logger.error("Error\1", error as Error)/g' "$file"

    # Remplacer console.log par logger.info
    sed -i 's/console\.log("Info\(.*\)")/logger.info("Info\1")/g' "$file"

    # Ajouter les codes d'erreur
    sed -i 's/{ error: "Non authentifié" }/{ error: "Non authentifié", code: "UNAUTHORIZED" }/g' "$file"
    sed -i 's/{ error: "Non autorisé" }/{ error: "Non autorisé", code: "FORBIDDEN" }/g' "$file"
    sed -i 's/{ error: "Non trouvé" }/{ error: "Non trouvé", code: "NOT_FOUND" }/g' "$file"

    echo "  -> Corrigé"
  fi
done

echo ""
echo "=== Corrections appliquées avec succès ==="
echo ""
echo "Actions manuelles restantes:"
echo "1. Valider les IDs de path dans les routes [id]/route.ts avec validateId()"
echo "2. Ajouter sanitizeRequestBody() aux POST/PATCH"
echo "3. Standardiser la pagination avec createPaginatedResponse()"
echo "4. Exécuter: npx prisma generate && npx prisma db push"
