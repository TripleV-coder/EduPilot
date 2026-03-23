/**
 * Swagger/OpenAPI Documentation for EduPilot API
 */

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "EduPilot API",
    version: "1.0.0",
    description: "API complète pour la gestion scolaire - EduPilot",
    contact: {
      name: "EduPilot Support",
      email: "support@edupilot.com",
    },
    license: {
      name: "Proprietary",
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
      description: "Serveur principal",
    },
  ],
  tags: [
    { name: "Authentication", description: "Authentification et gestion des sessions" },
    { name: "Users", description: "Gestion des utilisateurs" },
    { name: "Schools", description: "Gestion des établissements" },
    { name: "Classes", description: "Gestion des classes et niveaux" },
    { name: "Subjects", description: "Gestion des matières" },
    { name: "Grades", description: "Gestion des notes et évaluations" },
    { name: "Attendance", description: "Gestion des présences/absences" },
    { name: "Homework", description: "Gestion des devoirs" },
    { name: "Courses (LMS)", description: "Système de gestion de l'apprentissage" },
    { name: "Exams", description: "Examens et QCM" },
    { name: "Payments", description: "Gestion financière" },
    { name: "Appointments", description: "Rendez-vous parents-professeurs" },
    { name: "Events", description: "Événements scolaires" },
    { name: "Messages", description: "Messagerie interne" },
    { name: "Notifications", description: "Notifications" },
    { name: "RGPD/Compliance", description: "Conformité RGPD" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "next-auth.session-token",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Message d'erreur",
          },
          details: {
            type: "object",
            description: "Détails supplémentaires de l'erreur",
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          role: {
            type: "string",
            enum: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"],
          },
          schoolId: { type: "string", nullable: true },
          isActive: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      School: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          code: { type: "string" },
          type: {
            type: "string",
            enum: ["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"],
          },
          address: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Class: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          levelId: { type: "string" },
          schoolId: { type: "string" },
          academicYearId: { type: "string" },
          maxStudents: { type: "integer", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Grade: {
        type: "object",
        properties: {
          id: { type: "string" },
          value: { type: "number" },
          studentId: { type: "string" },
          evaluationId: { type: "string" },
          comment: { type: "string", nullable: true },
          isAbsent: { type: "boolean" },
          isExcused: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Course: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          classSubjectId: { type: "string" },
          isPublished: { type: "boolean" },
          thumbnail: { type: "string", nullable: true },
          createdById: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      PaymentPlan: {
        type: "object",
        properties: {
          id: { type: "string" },
          studentId: { type: "string" },
          feeId: { type: "string" },
          totalAmount: { type: "number" },
          installments: { type: "integer" },
          paidAmount: { type: "number" },
          status: {
            type: "string",
            enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Appointment: {
        type: "object",
        properties: {
          id: { type: "string" },
          teacherId: { type: "string" },
          parentId: { type: "string" },
          studentId: { type: "string" },
          scheduledAt: { type: "string", format: "date-time" },
          duration: { type: "integer" },
          type: {
            type: "string",
            enum: ["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"],
          },
          status: {
            type: "string",
            enum: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"],
          },
          meetingLink: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Non authentifié",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      ForbiddenError: {
        description: "Accès refusé",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      NotFoundError: {
        description: "Ressource non trouvée",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      ValidationError: {
        description: "Données invalides",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      RateLimitError: {
        description: "Trop de requêtes",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                retryAfter: { type: "integer" },
              },
            },
          },
        },
      },
    },
  },
  security: [
    {
      cookieAuth: [],
    },
  ],
  paths: {
    // Users
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "Liste des utilisateurs",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "role",
            in: "query",
            schema: { type: "string" },
            description: "Filtrer par rôle",
          },
          {
            name: "schoolId",
            in: "query",
            schema: { type: "string" },
            description: "Filtrer par école",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50 },
          },
        ],
        responses: {
          200: {
            description: "Liste des utilisateurs",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/UnauthorizedError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
        },
      },
    },
    // Schools
    "/api/schools": {
      get: {
        tags: ["Schools"],
        summary: "Liste des établissements",
        security: [{ cookieAuth: [] }],
        responses: {
          200: {
            description: "Liste des établissements",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/School" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/UnauthorizedError" },
        },
      },
      post: {
        tags: ["Schools"],
        summary: "Créer un établissement",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "code", "type"],
                properties: {
                  name: { type: "string" },
                  code: { type: "string" },
                  type: {
                    type: "string",
                    enum: ["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"],
                  },
                  address: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Établissement créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/School" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/UnauthorizedError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
        },
      },
    },
    // Courses (LMS)
    "/api/courses": {
      get: {
        tags: ["Courses (LMS)"],
        summary: "Liste des cours",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "classSubjectId",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "isPublished",
            in: "query",
            schema: { type: "boolean" },
          },
        ],
        responses: {
          200: {
            description: "Liste des cours",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Course" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/UnauthorizedError" },
        },
      },
      post: {
        tags: ["Courses (LMS)"],
        summary: "Créer un cours",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["classSubjectId", "title", "modules"],
                properties: {
                  classSubjectId: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  thumbnail: { type: "string" },
                  isPublished: { type: "boolean" },
                  modules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        order: { type: "integer" },
                        lessons: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              content: { type: "string" },
                              type: {
                                type: "string",
                                enum: ["TEXT", "VIDEO", "PDF", "QUIZ", "ASSIGNMENT"],
                              },
                              videoUrl: { type: "string" },
                              fileUrl: { type: "string" },
                              duration: { type: "integer" },
                              order: { type: "integer" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Cours créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Course" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/UnauthorizedError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
        },
      },
    },
    // Payment Plans
    "/api/payment-plans": {
      get: {
        tags: ["Payments"],
        summary: "Liste des plans de paiement",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "studentId",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
            },
          },
        ],
        responses: {
          200: {
            description: "Liste des plans de paiement",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/PaymentPlan" },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/UnauthorizedError" },
        },
      },
      post: {
        tags: ["Payments"],
        summary: "Créer un plan de paiement",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "feeId", "installments", "startDate"],
                properties: {
                  studentId: { type: "string" },
                  feeId: { type: "string" },
                  installments: {
                    type: "integer",
                    minimum: 2,
                    maximum: 12,
                  },
                  startDate: {
                    type: "string",
                    format: "date-time",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Plan de paiement créé",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaymentPlan" },
              },
            },
          },
          400: { $ref: "#/components/responses/ValidationError" },
          401: { $ref: "#/components/responses/UnauthorizedError" },
          403: { $ref: "#/components/responses/ForbiddenError" },
        },
      },
    },
  },
};

export default swaggerDocument;
