# 📚 Index de la Documentation EduPilot

Bienvenue dans la documentation complète d'EduPilot!

## 🚀 Démarrage Rapide

- **[DEMARRAGE_RAPIDE.md](../DEMARRAGE_RAPIDE.md)** - Guide pas à pas pour commencer
- **[INSTALLATION.md](../INSTALLATION.md)** - Installation détaillée
- **[ETAT_APPLICATION.md](../ETAT_APPLICATION.md)** - État actuel de l'application

## 📖 Documentation Technique

- **[VERIFICATION_LIENS.md](../VERIFICATION_LIENS.md)** - Vérification de tous les liens
- **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** - Index général
- **[AUTHENTICATION_SYSTEM_IMPLEMENTATION.md](../AUTHENTICATION_SYSTEM_IMPLEMENTATION.md)** - Système d'authentification
- **[SYSTEME_MDP_TEMPORAIRE_OPTIMISE.md](../SYSTEME_MDP_TEMPORAIRE_OPTIMISE.md)** - Système de mots de passe temporaires
- **[WELCOME_PAGE_IMPROVEMENTS.md](../WELCOME_PAGE_IMPROVEMENTS.md)** - Améliorations page d'accueil

## 🔧 Configuration

- **[src/config/app.config.ts](../src/config/app.config.ts)** - Configuration centralisée de l'application
  - Système éducatif béninois
  - Niveaux scolaires (CP1 à Terminale)
  - Notation, trimestres, matières
  - Messages en français

## 📝 Scripts Utiles

### Démarrage
```bash
./run.sh dev              # Lancer en développement
./run.sh prod             # Lancer en production
./run.sh pm2              # Lancer avec PM2
```

### Base de Données
```bash
npm run db:generate       # Générer le client Prisma
npm run db:push          # Appliquer le schéma
npm run db:reset         # Réinitialiser (⚠️ supprime tout)
npm run db:studio        # Interface visuelle
npm run db:seed:basic    # Charger données de base
npm run db:seed:reference # Charger données de référence
```

### Maintenance
```bash
npm run clean            # Nettoyer le cache
npm run clean:all        # Tout nettoyer et réinstaller
./scripts/test-links.sh  # Vérifier les liens
```

## 🎯 Structure du Projet

```
edupilot/
├── src/
│   ├── app/              # Pages et routes
│   │   ├── (auth)/       # Pages d'authentification
│   │   ├── (dashboard)/  # Pages du dashboard
│   │   └── api/          # Routes API (110 endpoints)
│   ├── components/       # Composants React
│   ├── config/           # Configuration
│   ├── lib/              # Bibliothèques et utilitaires
│   ├── hooks/            # React Hooks
│   └── types/            # Types TypeScript
├── prisma/               # Schéma et migrations
├── scripts/              # Scripts utilitaires
├── docs/                 # Documentation
└── public/               # Fichiers statiques
```

## 🔗 Liens Importants

### Navigation (Sidebar)
- `/dashboard` - Tableau de bord
- `/admin/*` - Administration (Super Admin)
- `/school/*` - Gestion école (Admin/Directeur)
- `/teacher/*` - Espace enseignant
- `/student/*` - Espace élève
- `/parent/*` - Espace parent

### Authentification
- `/` - Page d'accueil (redirige automatiquement)
- `/welcome` - Page de bienvenue
- `/login` - Connexion
- `/initial-setup` - Création Super Admin (première fois uniquement)
- `/first-login` - Changement mot de passe temporaire

## 📊 Fonctionnalités par Rôle

### Super Admin
- Gestion globale des établissements
- Gestion des utilisateurs
- Paramètres système
- Rapports globaux

### Admin d'École / Directeur
- Configuration de l'école
- Gestion classes, enseignants, élèves
- Emploi du temps
- Finances
- Rapports

### Enseignant
- Mes classes
- Saisie des notes
- Présences
- Emploi du temps
- Messagerie

### Élève
- Mes notes
- Mon emploi du temps
- Mes bulletins
- Devoirs

### Parent
- Notes des enfants
- Bulletins
- Paiements
- Messagerie

## 🇧🇯 Configuration Bénin

- **Pays**: Bénin
- **Devise**: FCFA
- **Timezone**: Africa/Porto-Novo
- **Langue**: Français
- **Format date**: dd/MM/yyyy
- **Système éducatif**: Primaire (CP1-CM2), Collège (6ème-3ème), Lycée (2nde-Tle)
- **Notation**: 0-20 (passage: 10/20)
- **Année scolaire**: Septembre à Juin (3 trimestres)

## ✅ État de l'Application

**Version**: 1.0.0
**Statut**: ✅ PRÊTE POUR UTILISATION

- ✅ 30+ pages créées
- ✅ 110 routes API fonctionnelles
- ✅ Navigation complète
- ✅ Tous liens vérifiés
- ✅ Base de données prête
- ✅ Documentation complète

## 🆘 Support

### Problèmes Courants

**Base de données ne se connecte pas**
```bash
# Vérifier PostgreSQL
sudo systemctl status postgresql

# Vérifier .env
cat .env | grep DATABASE_URL
```

**Port 3000 déjà utilisé**
```bash
# Trouver le processus
lsof -ti:3000

# Tuer le processus
kill -9 $(lsof -ti:3000)
```

**Cache corrompu**
```bash
npm run clean
```

## 📞 Contact

Pour toute question ou problème, consultez d'abord cette documentation.

---

**Dernière mise à jour**: 23 Décembre 2024
**Version documentation**: 1.0.0
