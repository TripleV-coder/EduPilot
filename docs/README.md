# Documentation EduPilot

Index de la documentation technique. Organisée par audience cible.

---

## Pour démarrer
- [README projet](../README.md) — installation locale, premier `npm run dev`
- [DEVELOPMENT.md](../DEVELOPMENT.md) — workflow dev quotidien
- [CONTRIBUTING.md](./CONTRIBUTING.md) — comment proposer un changement
- [Configuration](../.env.example) — toutes les variables d'env documentées

## Architecture
- [ARCHITECTURE.md](./ARCHITECTURE.md) — vue d'ensemble du système
- [API.md](./API.md) — référence des endpoints REST
- [adr/](./adr/) — décisions architecturales (10 ADRs)
- [PHASE1-CARTOGRAPHY.md](./PHASE1-CARTOGRAPHY.md) — cartographie complète des modules
- [PHASE1-VERIFIED-AUDIT.md](./PHASE1-VERIFIED-AUDIT.md) — audit phase 1 vérifié

## Sécurité
- [SECURITY.md](./SECURITY.md) — threat model, OWASP, RGPD
- [SECURITY policy](../.github/SECURITY.md) — comment signaler une vulnérabilité (canal privé GitHub)

## Opérations
- [OPERATIONS.md](./OPERATIONS.md) — déploiement, monitoring, mise à l'échelle, coûts
- [MONITORING.md](./MONITORING.md) — Sentry, alertes, KPIs, dashboards
- [RUNBOOK.md](./RUNBOOK.md) — procédures pour 8 types d'incidents
- [DEPLOYMENT.md](./DEPLOYMENT.md) — détails du déploiement
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) — checklist avant mise en prod

## Qualité
- [TESTING.md](./TESTING.md) — stratégie, conventions, mocks, coverage
- [UI_IMPROVEMENTS.md](./UI_IMPROVEMENTS.md) — backlog UI/UX
- [FRONTEND-SYNC-REPORT.md](./FRONTEND-SYNC-REPORT.md) — synchro frontend ↔ backend
- [SWISS_ENTERPRISE_DESIGN_SYSTEM.md](./SWISS_ENTERPRISE_DESIGN_SYSTEM.md) — design system
- [SWISS_COMPONENTS_GUIDE.md](./SWISS_COMPONENTS_GUIDE.md) — guide des composants

---

## Convention de documentation

Toute évolution **majeure** (changement de stack, ajout de provider, refonte sécurité, nouvelle dépendance critique) doit :
1. Ouvrir un PR qui modifie le code **ET** la doc correspondante (refus de merge sinon)
2. Si décision architecturale → ajouter un ADR (`docs/adr/00XX-titre.md`)
3. Si nouveau type d'incident possible → ajouter un runbook dans `RUNBOOK.md`
4. Si nouvelle API → mettre à jour `API.md`

Les fichiers de doc sont considérés comme du code : ils sont relus, versionnés, testés (orthographe + cohérence) en CI.

---

## Public visé par fichier

| Fichier | Audience |
|---------|----------|
| `README.md` | Tout contributeur, première découverte |
| `DEVELOPMENT.md` | Développeurs au quotidien |
| `ARCHITECTURE.md` | Architectes, nouveaux arrivants |
| `SECURITY.md` | Auditeurs, équipe sécurité, contributeurs |
| `OPERATIONS.md` | SRE, DevOps |
| `RUNBOOK.md` | Oncall |
| `MONITORING.md` | SRE, Tech Lead |
| `TESTING.md` | Tout contributeur ajoutant du code |
| `API.md` | Intégrateurs, équipe mobile |
| `adr/*` | Tech Lead, architectes, code reviewers |
| `PRODUCTION_CHECKLIST.md` | Release manager |
