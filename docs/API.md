# 📚 Documentation API - EduPilot

## Table des matières

- [Introduction](#introduction)
- [Authentification](#authentification)
- [Endpoints par Module](#endpoints-par-module)
- [Codes de statut](#codes-de-statut)
- [Rate Limiting](#rate-limiting)
- [Erreurs](#erreurs)

---

## Introduction

L'API EduPilot est une API REST qui permet de gérer tous les aspects d'un établissement scolaire. Cette API est conçue pour être utilisée par différents types d'utilisateurs (administrateurs, professeurs, élèves, parents) avec des permissions granulaires basées sur les rôles (RBAC).

**Base URL**: `https://votre-domaine.com/api`

**Version**: 1.0.0

---

## Authentification

### NextAuth.js Session-Based

EduPilot utilise NextAuth.js pour l'authentification. Toutes les requêtes authentifiées nécessitent une session valide.

#### Login

```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@school.com",
  "password": "votre-mot-de-passe"
}
```

**Réponse**:
```json
{
  "user": {
    "id": "cuid123",
    "email": "user@school.com",
    "firstName": "Jean",
    "lastName": "Dupont",
    "role": "TEACHER",
    "schoolId": "school123"
  }
}
```

#### Logout

```http
POST /api/auth/signout
```

---

## Endpoints par Module

### 👤 Utilisateurs

#### GET `/api/users`

Récupérer la liste des utilisateurs.

**Permissions**: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `DIRECTOR`

**Query Parameters**:
- `schoolId` (string, optionnel): Filtrer par école
- `role` (string, optionnel): Filtrer par rôle
- `page` (number, défaut: 1): Page de pagination
- `pageSize` (number, défaut: 20): Taille de page

**Réponse**:
```json
{
  "data": [
    {
      "id": "user123",
      "email": "prof@school.com",
      "firstName": "Marie",
      "lastName": "Martin",
      "role": "TEACHER",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### GET `/api/users/[id]`

Récupérer un utilisateur spécifique.

**Permissions**: Tous les utilisateurs authentifiés (propre profil), `ADMIN` roles (tous les profils)

**Réponse**:
```json
{
  "id": "user123",
  "email": "prof@school.com",
  "firstName": "Marie",
  "lastName": "Martin",
  "role": "TEACHER",
  "phone": "+33612345678",
  "avatar": "https://...",
  "schoolId": "school123",
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "teacherProfile": {
    "matricule": "T001",
    "specialization": "Mathématiques"
  }
}
```

#### POST `/api/users`

Créer un nouvel utilisateur.

**Permissions**: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `DIRECTOR`

**Body**:
```json
{
  "email": "nouveau@school.com",
  "firstName": "Pierre",
  "lastName": "Durand",
  "role": "TEACHER",
  "schoolId": "school123",
  "phone": "+33612345678"
}
```

**Réponse**: `201 Created`
```json
{
  "id": "newuser123",
  "email": "nouveau@school.com",
  "firstName": "Pierre",
  "lastName": "Durand",
  "role": "TEACHER",
  "firstLoginToken": "token123"
}
```

#### PATCH `/api/users/[id]`

Mettre à jour un utilisateur.

**Permissions**: Propriétaire ou `ADMIN` roles

**Body**:
```json
{
  "firstName": "Pierre",
  "phone": "+33698765432"
}
```

#### DELETE `/api/users/[id]`

Supprimer un utilisateur (soft delete).

**Permissions**: `SUPER_ADMIN`, `SCHOOL_ADMIN`

**Réponse**: `204 No Content`

---

### 🏫 Écoles

#### GET `/api/schools`

Liste des écoles (SUPER_ADMIN uniquement).

#### GET `/api/schools/[id]`

Détails d'une école.

#### POST `/api/schools`

Créer une nouvelle école (SUPER_ADMIN uniquement).

---

### 👨‍🎓 Élèves

#### GET `/api/students`

Liste des élèves.

**Query Parameters**:
- `schoolId` (string, requis sauf SUPER_ADMIN)
- `classId` (string, optionnel)
- `academicYearId` (string, optionnel)
- `search` (string, optionnel): Recherche par nom ou matricule

**Réponse**:
```json
{
  "data": [
    {
      "id": "student123",
      "userId": "user123",
      "matricule": "E2024001",
      "dateOfBirth": "2010-05-15",
      "gender": "MALE",
      "user": {
        "firstName": "Thomas",
        "lastName": "Bernard",
        "email": "thomas.bernard@school.com"
      },
      "currentClass": {
        "id": "class123",
        "name": "6ème A"
      }
    }
  ]
}
```

#### GET `/api/students/[id]`

Détails d'un élève avec toutes ses informations.

#### POST `/api/students`

Inscrire un nouvel élève.

---

### 📚 Notes & Évaluations

#### GET `/api/grades`

Liste des notes.

**Query Parameters**:
- `studentId` (string, optionnel)
- `classId` (string, optionnel)
- `subjectId` (string, optionnel)
- `periodId` (string, optionnel)

**Réponse**:
```json
{
  "data": [
    {
      "id": "grade123",
      "value": 15.5,
      "coefficient": 2,
      "evaluation": {
        "title": "Contrôle Chapitre 1",
        "date": "2024-03-15",
        "maxGrade": 20,
        "subject": {
          "name": "Mathématiques"
        }
      },
      "student": {
        "firstName": "Thomas",
        "lastName": "Bernard"
      }
    }
  ]
}
```

#### POST `/api/grades`

Enregistrer une note.

**Permissions**: `TEACHER`, `ADMIN`

**Body**:
```json
{
  "evaluationId": "eval123",
  "studentId": "student123",
  "value": 16,
  "comment": "Très bon travail"
}
```

#### PATCH `/api/grades/[id]`

Modifier une note existante.

#### DELETE `/api/grades/[id]`

Supprimer une note (soft delete avec audit).

---

### 💰 Finance & Paiements

#### GET `/api/finance/payments`

Liste des paiements.

**Query Parameters**:
- `studentId` (string, optionnel)
- `status` (string, optionnel): `PENDING`, `VERIFIED`, `RECONCILED`
- `startDate` (date, optionnel)
- `endDate` (date, optionnel)

#### POST `/api/finance/payments`

Enregistrer un paiement.

**Body**:
```json
{
  "studentId": "student123",
  "feeId": "fee123",
  "amount": 150000,
  "method": "MOBILE_MONEY_MTN",
  "reference": "TXN123456",
  "paidAt": "2024-03-20T10:30:00Z"
}
```

#### GET `/api/finance/dashboard`

Tableau de bord financier (statistiques).

**Réponse**:
```json
{
  "totalRevenue": 15000000,
  "pendingPayments": 2500000,
  "paidStudents": 450,
  "totalStudents": 500,
  "recentPayments": [...],
  "monthlyRevenue": [...]
}
```

---

### 📊 Présences

#### GET `/api/attendance`

Liste des présences.

#### POST `/api/attendance`

Enregistrer les présences d'une classe.

**Body**:
```json
{
  "classId": "class123",
  "date": "2024-03-20",
  "attendances": [
    {
      "studentId": "student123",
      "status": "PRESENT"
    },
    {
      "studentId": "student456",
      "status": "ABSENT",
      "reason": "Maladie"
    }
  ]
}
```

---

### 📝 Devoirs

#### GET `/api/homework`

Liste des devoirs.

#### POST `/api/homework`

Créer un devoir.

#### POST `/api/homework/[id]/submit`

Soumettre un devoir (élève).

---

### 💬 Messages

#### GET `/api/messages`

Liste des messages de l'utilisateur.

#### POST `/api/messages`

Envoyer un message.

**Body**:
```json
{
  "recipientId": "user456",
  "subject": "Réunion parents-professeurs",
  "content": "Bonjour, je souhaiterais organiser une réunion..."
}
```

---

### 🔔 Notifications

#### GET `/api/notifications`

Liste des notifications de l'utilisateur.

#### PATCH `/api/notifications/[id]/read`

Marquer comme lue.

#### POST `/api/notifications/read-all`

Marquer toutes les notifications comme lues.

---

### 📈 Analytiques

#### GET `/api/analytics/student/[id]`

Analytiques d'un élève (moyennes, progression, etc.).

#### GET `/api/analytics/class/[id]`

Analytiques d'une classe.

#### GET `/api/analytics/school`

Analytiques globales de l'école.

---

## Codes de statut

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 204 | Succès sans contenu |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource non trouvée |
| 422 | Entité non traitable (validation échouée) |
| 429 | Trop de requêtes (rate limit) |
| 500 | Erreur serveur |

---

## Rate Limiting

EduPilot implémente un rate limiting pour protéger l'API :

- **API générale**: 100 requêtes / minute / IP
- **Authentification**: 5 essais / 15 minutes / IP
- **Endpoints sensibles**: 20 requêtes / minute / IP
- **Upload**: 10 fichiers / minute / utilisateur

Les headers de réponse incluent :
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1647856800
```

---

## Erreurs

Format standard des erreurs :

```json
{
  "error": "Validation failed",
  "message": "Email is required",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "rule": "required"
  }
}
```

### Codes d'erreur courants

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Données invalides |
| `UNAUTHORIZED` | Session expirée ou invalide |
| `FORBIDDEN` | Permissions insuffisantes |
| `NOT_FOUND` | Ressource introuvable |
| `CONFLICT` | Conflit (ex: email déjà utilisé) |
| `RATE_LIMIT_EXCEEDED` | Trop de requêtes |
| `INTERNAL_ERROR` | Erreur serveur |

---

## Support

Pour toute question ou problème, contactez l'équipe technique :
- Email: support@edupilot.bj
- Documentation complète: https://docs.edupilot.bj
