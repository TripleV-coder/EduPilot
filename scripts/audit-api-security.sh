#!/bin/bash

# Script d'audit de sécurité des routes API EduPilot
# Vérifie que toutes les routes sont authentifiées et sécurisées

echo "=========================================="
echo "Audit de Sécurité des Routes API EduPilot"
echo "=========================================="
echo ""

API_DIR="/home/triple-v/Documents/WEB/edupilot/src/app/api"
TOTAL_ROUTES=0
SECURED_ROUTES=0
UNSECURED_ROUTES=0
MISSING_SCHOOL_FILTER=0

echo "Analyse des routes API..."
echo ""

# Routes publiques qui ne nécessitent pas d'auth
PUBLIC_ROUTES=(
  "auth"
  "health"
  "initial-setup"
)

is_public_route() {
  local route="$1"
  for public in "${PUBLIC_ROUTES[@]}"; do
    if [[ "$route" == *"/$public/"* ]]; then
      return 0
    fi
  done
  return 1
}

# Parcourir tous les fichiers route.ts
while IFS= read -r file; do
  ((TOTAL_ROUTES++))
  
  # Extraire le chemin relatif
  rel_path="${file#$API_DIR/}"
  
  # Vérifier si c'est une route publique
  if is_public_route "$rel_path"; then
    echo "✓ [PUBLIC] $rel_path"
    ((SECURED_ROUTES++))
    continue
  fi
  
  # Vérifier l'authentification
  has_auth=$(grep -l "await auth()" "$file" || grep -l "authenticateRequest" "$file" || echo "")
  
  if [ -n "$has_auth" ]; then
    # Vérifier l'isolation multi-tenant (schoolId filter)
    has_school_filter=$(grep -l "schoolId" "$file" || echo "")
    
    if [ -n "$has_school_filter" ]; then
      echo "✓ [SECURED] $rel_path"
      ((SECURED_ROUTES++))
    else
      echo "⚠ [SECURED BUT NO SCHOOL FILTER] $rel_path"
      ((SECURED_ROUTES++))
      ((MISSING_SCHOOL_FILTER++))
    fi
  else
    echo "✗ [UNSECURED] $rel_path"
    ((UNSECURED_ROUTES++))
  fi
done < <(find "$API_DIR" -name "route.ts" -type f)

echo ""
echo "=========================================="
echo "Résultats de l'Audit"
echo "=========================================="
echo "Total routes API: $TOTAL_ROUTES"
echo "Routes sécurisées: $SECURED_ROUTES"
echo "Routes non sécurisées: $UNSECURED_ROUTES"
echo "Routes sans filtre schoolId: $MISSING_SCHOOL_FILTER"
echo ""

if [ $UNSECURED_ROUTES -eq 0 ]; then
  echo "✓ SUCCÈS: Toutes les routes sont sécurisées!"
else
  echo "✗ ATTENTION: $UNSECURED_ROUTES routes nécessitent une sécurisation!"
  exit 1
fi

if [ $MISSING_SCHOOL_FILTER -gt 0 ]; then
  echo "⚠ AVERTISSEMENT: $MISSING_SCHOOL_FILTER routes n'ont pas de filtre multi-tenant"
fi
