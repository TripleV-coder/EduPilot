#!/bin/bash

# Script de correction en masse de toutes les routes API
# Applique: logger, codes d'erreur, sanitization, pagination

set -e

echo "=== Correction de toutes les routes API ==="

# Importations à ajouter après les imports existants
IMPORTS_TO_ADD='import { logger } from "@/lib/utils/logger";
import { sanitizeRequestBody, sanitizePlainText } from "@/lib/sanitize";
import { createPaginatedResponse, getPaginationParams } from "@/lib/api/api-helpers";'

#赵正所有 les fichiers API
find src/app/api -name "route.ts" -type f | while read -r file; do
    echo "Traitement: $file"

    # 1. Ajouter les imports après le dernier import de zod
    if ! grep -q 'import { logger } from "@/lib/utils/logger"' "$file"; then
        # Trouver la dernière ligne avec "import" et ajouter après
        sed -i '/^import { z } from "zod";$/a\
'"$IMPORTS_TO_ADD"'' "$file"
    fi

    # 2. Remplacer console.error par logger.error
    sed -i 's/console\.error("Error\(.*\)", error)/logger.error("\1", error as Error)/g' "$file"
    sed -i 's/console\.error("Error\(.*\)")/logger.error("\1")/g' "$file"

    # 3. Remplacer console.log par logger.info (pour les messages de succès)
    sed -i 's/console\.log("Info\(.*\)")/logger.info("\1")/g' "$file"
    sed -i 's/console\.log("User\(.*\)")/logger.info("\1")/g' "$file"

    # 4. Standardiser les codes d'erreur
    sed -i 's/{ error: "Non authentifié" }/{ error: "Non authentifié", code: "UNAUTHORIZED" }/g' "$file"
    sed -i 's/{ error: "Non autorisé" }/{ error: "Non autorisé", code: "FORBIDDEN" }/g' "$file"
    sed -i 's/{ error: "Accès non autorisé" }/{ error: "Accès non autorisé", code: "FORBIDDEN" }/g' "$file"
    sed -i 's/{ error: "Non trouvé" }/{ error: "Non trouvé", code: "NOT_FOUND" }/g' "$file"
    sed -i 's/{ error: "Non trouvé".*}/{ error: "Non trouvé", code: "NOT_FOUND" }, { status: 404 }/g' "$file"
    sed -i 's/{ error: "Données invalides" }/{ error: "Données invalides", code: "VALIDATION_ERROR" }/g' "$file"
    sed -i 's/{ error: "Erreur".*}/{ error: "Erreur serveur", code: "SERVER_ERROR" }, { status: 500 }/g' "$file"

    # 5. Ajouter pagination aux réponses sans pagination
    if grep -q 'return NextResponse.json(courses)' "$file"; then
        sed -i 's/return NextResponse.json(courses);/const [data, total] = await Promise.all([prisma\..*findMany, prisma\..*count]);\n    return createPaginatedResponse(data, page, limit, total);/g' "$file"
    fi

    # 6. Ajouter sanitization aux body parsing
    if grep -q 'const body = await request.json();' "$file"; then
        if ! grep -q 'sanitizeRequestBody' "$file"; then
            sed -i '/const body = await request.json();/a\    const sanitizedBody = sanitizeRequestBody(body);' "$file"
            sed -i 's/const validatedData = \(.*\)(\(body\|sanitizedBody\))/const validatedData = \1(sanitizedBody)/g' "$file"
        fi
    fi

    echo "  -> OK"
done

echo ""
echo "=== Corrections terminées ==="
echo ""
echo "Fichiers nécessitant une attention manuelle:"
echo "- src/app/api/grades/route.ts: Vérifier la pagination"
echo "- src/app/api/teachers/route.ts: Vérifier la pagination"
