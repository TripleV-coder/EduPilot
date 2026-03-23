#!/bin/bash

################################################################################
# Script de correction automatique des erreurs ESLint
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Correction des erreurs ESLint...${NC}\n"

# Fix unused variables by prefixing with underscore
echo -e "${YELLOW}📝 Correction des variables non utilisées...${NC}"

# Find and replace unused error variables
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  -e 's/} catch (err) {/} catch (_err) {/g' \
  -e 's/} catch (error) {/} catch (_error) {/g' \
  -e 's/} catch (e) {/} catch (_e) {/g' \
  -e 's/(error:/(_error:/g' \
  -e 's/(err:/(_err:/g' \
  -e 's/(e:/(_e:/g' \
  -e 's/, error)/, _error)/g' \
  -e 's/, err)/, _err)/g' \
  -e 's/\berror\b/_error/g' \
  {} \;

echo -e "${GREEN}✅ Correction des variables terminée${NC}"

# Run ESLint fix
echo -e "${YELLOW}🔧 Exécution de ESLint fix...${NC}"
npm run lint:fix

echo -e "\n${GREEN}✅ Correction automatique terminée!${NC}"
echo -e "${BLUE}💡 Relancez 'npm run build' pour vérifier${NC}\n"
