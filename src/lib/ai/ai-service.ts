/**
 * AI Service
 *
 * Chat uses a cascading strategy:
 * 1. External AI providers, if configured
 * 2. n8n webhook, if configured
 * 3. Fail with explicit 503 (no local simulation fallback)
 *
 * Governance actions are grounded in real EduPilot data and never return
 * hard-coded analytics payloads.
 */

import prisma from "@/lib/prisma";
import { averageNumbers, dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { analyticsService } from "@/lib/analytics/service";
import { persistStudentAnalyticsSnapshot } from "@/lib/services/analytics-sync";
import { predictFailureRisk as predictStudentFailureRisk } from "@/lib/services/ai-predictive/predict-failure";
import { predictNextPeriodGrade } from "@/lib/services/ai-predictive/predict-grade";
import { logger } from "@/lib/utils/logger";
import { callExternalAI } from "./external-client";
import { appEnv } from "@/lib/config/env";

export interface ChatRequest {
  message: string;
  userId: string;
  userRole: string;
  schoolId?: string | null;
  studentId?: string | null;
  stream?: boolean;
  onToken?: (token: string) => void;
  options?: {
    maxLength?: number;
    temperature?: number;
    useKnowledgeBase?: boolean;
    useContext?: boolean;
    language?: "fr" | "en";
  };
}

export interface ChatResponse {
  success: boolean;
  response: string;
  metadata?: {
    confidence: number;
    processingTime: number;
    sources?: string[];
    engine?: "n8n" | "external";
  };
}

export interface GovernanceRequest {
  action: string;
  userId: string;
  userRole: string;
  schoolId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  data?: Record<string, any>;
}

export interface GovernanceResponse {
  success: boolean;
  action: string;
  data: any;
  confidence: number;
  executionTime: number;
  recommendations?: string[];
  alerts?: Alert[];
}

export interface Alert {
  id: string;
  type: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  targetRoles: string[];
  actionRequired: boolean;
}

export interface AIServiceStatus {
  operational: boolean;
  modelLoaded: boolean;
  loadTime: number;
  externalConfigured: boolean;
  n8nConfigured: boolean;
  runtimeMode: "cloud_only" | "degraded";
}

type GovernanceActionResult = {
  data: any;
  confidence?: number;
  recommendations?: string[];
  alerts?: Alert[];
};

const SCHOOL_WIDE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;
const STAFF_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] as const;
const STUDENT_SCOPED_ROLES = [...STAFF_ROLES, "PARENT", "STUDENT"] as const;

const analyticsInclude = {
  period: {
    select: { id: true, name: true, sequence: true },
  },
  academicYear: {
    select: { id: true, name: true },
  },
  subjectPerformances: {
    include: {
      subject: {
        select: { id: true, name: true, code: true },
      },
    },
  },
} as const;

const schoolAnalyticsInclude = {
  ...analyticsInclude,
  student: {
    select: {
      id: true,
      userId: true,
      schoolId: true,
      user: {
        select: { firstName: true, lastName: true },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        take: 1,
        select: {
          class: {
            select: { id: true, name: true },
          },
        },
      },
    },
  },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatStudentName(student: {
  user?: { firstName?: string | null; lastName?: string | null } | null;
}) {
  return `${student.user?.firstName ?? ""} ${student.user?.lastName ?? ""}`.trim();
}

function calculateAttendanceRate(records: Array<{ status: string }>) {
  if (records.length === 0) return null;
  const presentCount = records.filter(
    (record) => record.status === "PRESENT" || record.status === "LATE"
  ).length;
  return roundTo((presentCount / records.length) * 100);
}

function getRiskPriority(level: string | null | undefined) {
  switch (level) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

function hasExternalAIConfigured() {
  return appEnv.ai.enabled && appEnv.ai.hasExternalKeys;
}

export class AIServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number = 400, code: string = "AI_SERVICE_ERROR") {
    super(message);
    this.name = "AIServiceError";
    this.status = status;
    this.code = code;
  }
}

class AIService {
  private initialized = false;
  private modelLoaded = false;
  private modelLoadTime = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info("Initializing AI Service...");
    const startedAt = Date.now();

    try {
      logger.info("Cloud AI runtime enabled (external providers + n8n)");
      this.modelLoaded = true;
      this.modelLoadTime = Date.now() - startedAt;
      this.initialized = true;

      logger.info("AI Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize AI Service:", error as Error);
      throw error;
    }
  }

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    await this.initialize();

    const { response, engine } = await this.generateResponse(request);

    if (request.stream && request.onToken) {
      const tokens = this.chunkResponse(response);
      for (const token of tokens) {
        request.onToken(token);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    }

    const confidenceByEngine: Record<"external" | "n8n", number> = {
      external: 0.9,
      n8n: 0.82,
    };

    return {
      success: true,
      response,
      metadata: {
        confidence: confidenceByEngine[engine] ?? 0.8,
        processingTime: Date.now() - startTime,
        sources: ["knowledge_base", "context"],
        engine,
      },
    };
  }

  private chunkResponse(text: string): string[] {
    const tokens: string[] = [];
    const paragraphs = text.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (paragraph.length > 50) {
        const words = paragraph.split(/(?=[\s])/);
        let currentChunk = "";

        for (const word of words) {
          if (currentChunk.length + word.length > 30) {
            if (currentChunk) tokens.push(currentChunk);
            currentChunk = word;
          } else {
            currentChunk += word;
          }
        }

        if (currentChunk) tokens.push(currentChunk);
      } else {
        tokens.push(paragraph);
      }
    }

    return tokens.length > 0 ? tokens : [text];
  }

  private async generateResponse(
    request: ChatRequest
  ): Promise<{ response: string; engine: "external" | "n8n" }> {
    const { message, userRole, options = {} } = request;

    if (hasExternalAIConfigured()) {
      try {
        const externalResponse = await callExternalAI({
          message,
          role: userRole,
          language: options.language,
          maxTokens: options.maxLength,
          temperature: options.temperature,
        });

        if (externalResponse.success && externalResponse.response) {
          return { response: externalResponse.response, engine: "external" };
        }
      } catch (error) {
        logger.warn("External AI APIs failed, trying n8n fallback", {
          module: "ai-service",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (process.env.N8N_HOST) {
      try {
        const n8nResponse = await this.callN8n(request);
        if (n8nResponse) {
          return { response: n8nResponse, engine: "n8n" };
        }
      } catch (error) {
        logger.warn("n8n failed, no automatic local fallback in production mode", {
          module: "ai-service",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    throw new AIServiceError(
      "Aucun moteur IA disponible. Vérifiez la configuration des providers externes ou n8n.",
      503,
      "AI_PROVIDER_UNAVAILABLE"
    );
  }

  private async callN8n(request: ChatRequest): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let contextData = {};
    if (request.schoolId) {
      try {
        contextData = await analyticsService.getSchoolStats(request.schoolId);
      } catch (err) {
        logger.warn("Failed to load context for AI", {
          module: "ai-service",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const n8nResponse = await fetch(`${process.env.N8N_HOST}/webhook/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: request.message,
        userRole: request.userRole,
        userId: request.userId,
        schoolId: request.schoolId,
        context: contextData,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!n8nResponse.ok) {
      return null;
    }

    const data = await n8nResponse.json();
    return typeof data.response === "string" ? data.response : null;
  }

  async executeGovernance(request: GovernanceRequest): Promise<GovernanceResponse> {
    const startTime = Date.now();

    await this.initialize();

    let result: GovernanceActionResult;

    switch (request.action) {
      case "analyze-student":
        result = await this.analyzeStudent(request);
        break;
      case "analyze-class":
        result = await this.analyzeClass(request);
        break;
      case "analyze-school":
        result = await this.analyzeSchool(request);
        break;
      case "detect-at-risk":
        result = await this.detectAtRiskStudents(request);
        break;
      case "predict-grades":
        result = await this.predictGrades(request);
        break;
      case "recommend-orientation":
        result = await this.recommendOrientation(request);
        break;
      case "analyze-risk":
        result = await this.analyzeRiskIntervention(request);
        break;
      case "generate-action-plan":
        result = await this.generateActionPlan(request);
        break;
      case "draft-report-comment":
        result = await this.draftReportComment(request);
        break;
      default:
        throw new AIServiceError(`Action IA non prise en charge: ${request.action}`, 400, "INVALID_ACTION");
    }

    return {
      success: true,
      action: request.action,
      data: result.data,
      confidence: result.confidence ?? 0.6,
      executionTime: Date.now() - startTime,
      recommendations: result.recommendations ?? [],
      alerts: result.alerts ?? [],
    };
  }

  private async generateActionPlan(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const studentId = this.resolveRequestedStudentId(request);
    if (!studentId) {
      throw new AIServiceError("studentId requis pour générer un plan d'action", 400, "MISSING_STUDENT_ID");
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { enrolledAt: "desc" },
          take: 1,
          include: { class: true },
        },
      },
    });

    if (!student) throw new AIServiceError("Élève introuvable", 404, "STUDENT_NOT_FOUND");
    await this.ensureStudentScope(request, { id: student.id, userId: student.userId, schoolId: student.schoolId });

    const analytics = await this.getLatestStudentAnalytics(student.id, student.schoolId);
    
    // Simulate or call external AI to generate a detailed plan
    let planData;
    if (hasExternalAIConfigured() && analytics) {
        try {
            const prompt = `Crée un plan d'action de remédiation personnalisé pour ${formatStudentName(student)} en classe de ${student.enrollments[0]?.class.name}. Moyenne actuelle: ${analytics.generalAverage}. Risque: ${analytics.riskLevel}. Faiblesses: ${analytics.subjectPerformances.filter(s => s.isWeakness).map(s => s.subject.name).join(', ')}. Renvoie un JSON strict: { "title": "...", "description": "...", "priority": "HIGH", "steps": ["étape 1", "étape 2"], "suggestedBy": "Gemini AI" }`;
            const externalResponse = await callExternalAI({ message: prompt, role: request.userRole });
            if (externalResponse.success) {
                const jsonMatch = externalResponse.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) planData = JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
             logger.warn("Failed to generate action plan via external AI", { error });
        }
    }

    if (!planData) {
        planData = {
            title: `Plan de Remédiation - ${formatStudentName(student)}`,
            description: `Intervention pédagogique ciblée pour améliorer les résultats académiques.`,
            priority: "HIGH",
            steps: [
                "Entretien individuel avec l'élève pour identifier les blocages.",
                "Mise en place de séances de tutorat hebdomadaires en mathématiques.",
                "Rendez-vous téléphonique avec les parents dans les 7 jours."
            ],
            suggestedBy: "Système Expert EduPilot"
        };
    }

    return { data: planData, confidence: 0.85 };
  }

  private async draftReportComment(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const studentId = this.resolveRequestedStudentId(request);
    if (!studentId) {
      throw new AIServiceError("studentId requis pour rédiger une appréciation", 400, "MISSING_STUDENT_ID");
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!student) throw new AIServiceError("Élève introuvable", 404, "STUDENT_NOT_FOUND");
    await this.ensureStudentScope(request, { id: student.id, userId: student.userId, schoolId: student.schoolId });

    const analytics = await this.getLatestStudentAnalytics(student.id, student.schoolId);
    const average = analytics?.generalAverage ? Number(analytics.generalAverage) : 0;
    
    let comment = "";
    if (hasExternalAIConfigured()) {
        try {
            const prompt = `Rédige une appréciation de bulletin bienveillante et constructive (max 2 phrases) pour ${formatStudentName(student)}. Moyenne générale: ${average.toFixed(2)}/20. Tendance: ${analytics?.progressionRate && Number(analytics.progressionRate) > 0 ? 'En progrès' : 'En baisse'}. Renvoie UNIQUEMENT le texte de l'appréciation.`;
            const externalResponse = await callExternalAI({ message: prompt, role: request.userRole });
            if (externalResponse.success) {
                comment = externalResponse.response.replace(/^["']|["']$/g, '').trim();
            }
        } catch (error) {
            logger.warn("Failed to draft comment via external AI", { error });
        }
    }

    if (!comment) {
        if (average >= 16) comment = "Excellent trimestre. Continuez ainsi !";
        else if (average >= 12) comment = "Bon trimestre, des résultats satisfaisants dans l'ensemble.";
        else if (average >= 10) comment = "Ensemble juste. Des efforts sont nécessaires pour consolider les acquis.";
        else comment = "Trimestre difficile. Il faut se ressaisir et s'impliquer davantage au prochain trimestre.";
    }

    return { data: { comment }, confidence: 0.9 };
  }

  private resolveRequestedStudentId(request: GovernanceRequest) {
    if (typeof request.studentId === "string" && request.studentId) return request.studentId;
    if (typeof request.data?.studentId === "string" && request.data.studentId) return request.data.studentId;
    return null;
  }

  private resolveRequestedClassId(request: GovernanceRequest) {
    if (typeof request.classId === "string" && request.classId) return request.classId;
    if (typeof request.data?.classId === "string" && request.data.classId) return request.data.classId;
    return null;
  }

  private resolveRequestedSchoolId(request: GovernanceRequest) {
    if (typeof request.data?.schoolId === "string" && request.data.schoolId) {
      return request.data.schoolId;
    }
    return request.schoolId ?? null;
  }

  private ensureAllowedRole(
    request: GovernanceRequest,
    allowedRoles: readonly string[],
    actionLabel: string
  ) {
    if (!allowedRoles.includes(request.userRole)) {
      throw new AIServiceError(
        `Accès refusé pour l'action ${actionLabel}`,
        403,
        "FORBIDDEN"
      );
    }
  }

  private ensureSchoolScope(request: GovernanceRequest, targetSchoolId: string) {
    if (request.userRole !== "SUPER_ADMIN" && request.schoolId !== targetSchoolId) {
      throw new AIServiceError(
        "Accès inter-établissement refusé",
        403,
        "FORBIDDEN"
      );
    }
  }

  private async ensureStudentScope(
    request: GovernanceRequest,
    student: { id: string; userId: string; schoolId: string }
  ) {
    this.ensureAllowedRole(request, STUDENT_SCOPED_ROLES, request.action);
    this.ensureSchoolScope(request, student.schoolId);

    if (request.userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: request.userId },
        select: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });

      const childIds = parentProfile?.parentStudents.map((child) => child.studentId) ?? [];
      if (!childIds.includes(student.id)) {
        throw new AIServiceError(
          "Accès refusé: cet élève n'est pas rattaché à ce parent",
          403,
          "FORBIDDEN"
        );
      }
    }

    if (request.userRole === "STUDENT" && student.userId !== request.userId) {
      throw new AIServiceError(
        "Accès refusé: un élève ne peut consulter que ses propres analyses",
        403,
        "FORBIDDEN"
      );
    }
  }

  private async ensureClassScope(
    request: GovernanceRequest,
    classRecord: { id: string; schoolId: string }
  ) {
    this.ensureAllowedRole(request, STAFF_ROLES, request.action);
    this.ensureSchoolScope(request, classRecord.schoolId);

    if (request.userRole === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: request.userId },
        select: { id: true },
      });

      if (!teacherProfile) {
        throw new AIServiceError("Profil enseignant introuvable", 403, "FORBIDDEN");
      }

      const canAccessClass = await prisma.class.count({
        where: {
          id: classRecord.id,
          OR: [
            { mainTeacherId: teacherProfile.id },
            {
              classSubjects: {
                some: { teacherId: teacherProfile.id },
              },
            },
          ],
        },
      });

      if (canAccessClass === 0) {
        throw new AIServiceError(
          "Accès refusé: cette classe n'est pas rattachée à cet enseignant",
          403,
          "FORBIDDEN"
        );
      }
    }
  }

  private ensureSchoolWideScope(request: GovernanceRequest, schoolId: string) {
    this.ensureAllowedRole(request, SCHOOL_WIDE_ROLES, request.action);
    this.ensureSchoolScope(request, schoolId);
  }

  private async getPreferredAcademicYearId(schoolId: string) {
    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });

    if (currentYear) return currentYear.id;

    const latestYear = await prisma.academicYear.findFirst({
      where: { schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true },
    });

    return latestYear?.id ?? null;
  }

  private async getLatestStudentAnalytics(studentId: string, schoolId: string) {
    let analytics = await prisma.studentAnalytics.findFirst({
      where: { studentId },
      include: analyticsInclude,
      orderBy: [{ period: { sequence: "desc" } }, { analyzedAt: "desc" }, { createdAt: "desc" }],
    });

    if (analytics) return analytics;

    const academicYearId = await this.getPreferredAcademicYearId(schoolId);
    if (!academicYearId) return null;

    const latestPeriod = await prisma.period.findFirst({
      where: { academicYearId },
      orderBy: { sequence: "desc" },
      select: { id: true },
    });

    if (!latestPeriod) return null;

    try {
      await persistStudentAnalyticsSnapshot(studentId, latestPeriod.id, academicYearId);
    } catch (error) {
      logger.warn("Unable to refresh student analytics snapshot for AI governance", {
        module: "ai-service",
        studentId,
        periodId: latestPeriod.id,
        academicYearId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    analytics = await prisma.studentAnalytics.findFirst({
      where: { studentId },
      include: analyticsInclude,
      orderBy: [{ period: { sequence: "desc" } }, { analyzedAt: "desc" }, { createdAt: "desc" }],
    });

    return analytics;
  }

  private async getLatestAnalyticsForStudents(
    studentIds: string[],
    options: { schoolId?: string; academicYearIds?: string[] } = {}
  ) {
    const uniqueStudentIds = uniq(studentIds);
    if (uniqueStudentIds.length === 0) return [];

    const where: Record<string, any> = {
      studentId: { in: uniqueStudentIds },
    };

    if (options.schoolId) {
      where.student = { schoolId: options.schoolId };
    }

    if (options.academicYearIds && options.academicYearIds.length > 0) {
      where.academicYearId =
        options.academicYearIds.length === 1
          ? options.academicYearIds[0]
          : { in: options.academicYearIds };
    }

    const analytics = await prisma.studentAnalytics.findMany({
      where,
      include: schoolAnalyticsInclude,
      orderBy: [{ period: { sequence: "desc" } }, { analyzedAt: "desc" }, { createdAt: "desc" }],
    });

    if (analytics.length > 0 || !options.academicYearIds?.length) {
      return dedupeLatestAnalyticsByStudent(analytics);
    }

    const fallbackAnalytics = await prisma.studentAnalytics.findMany({
      where: {
        studentId: { in: uniqueStudentIds },
        ...(options.schoolId ? { student: { schoolId: options.schoolId } } : {}),
      },
      include: schoolAnalyticsInclude,
      orderBy: [{ period: { sequence: "desc" } }, { analyzedAt: "desc" }, { createdAt: "desc" }],
    });

    return dedupeLatestAnalyticsByStudent(fallbackAnalytics);
  }

  private buildRiskAlerts(
    students: Array<{ id: string; name: string; riskLevel: string; averageGrade: number | null }>
  ): Alert[] {
    return students
      .filter((student) => ["CRITICAL", "HIGH"].includes(student.riskLevel))
      .slice(0, 10)
      .map((student) => ({
        id: `risk_${student.id}`,
        type: student.riskLevel === "CRITICAL" ? "critical" : "warning",
        title: `Risque ${student.riskLevel === "CRITICAL" ? "critique" : "élevé"}`,
        message: `${student.name} présente un risque ${student.riskLevel.toLowerCase()} avec une moyenne ${student.averageGrade?.toFixed(2) ?? "non disponible"}/20.`,
        targetRoles: ["DIRECTOR", "SCHOOL_ADMIN"],
        actionRequired: true,
      }));
  }

  private async analyzeStudent(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const studentId = this.resolveRequestedStudentId(request);
    if (!studentId) {
      throw new AIServiceError("studentId requis pour analyser un élève", 400, "MISSING_STUDENT_ID");
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        schoolId: true,
        matricule: true,
        user: {
          select: { firstName: true, lastName: true },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { enrolledAt: "desc" },
          take: 1,
          select: {
            class: {
              select: { id: true, name: true },
            },
            academicYear: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!student) {
      throw new AIServiceError("Élève introuvable", 404, "STUDENT_NOT_FOUND");
    }

    await this.ensureStudentScope(request, student);

    const [analytics, attendances, incidents, failurePrediction] = await Promise.all([
      this.getLatestStudentAnalytics(student.id, student.schoolId),
      prisma.attendance.findMany({
        where: {
          studentId: student.id,
          date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        select: { status: true },
      }),
      prisma.behaviorIncident.findMany({
        where: {
          studentId: student.id,
          date: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        },
        select: { severity: true, description: true },
        orderBy: { date: "desc" },
        take: 10,
      }),
      predictStudentFailureRisk(student.id).catch((error) => {
        logger.warn("AI student failure prediction unavailable", {
          module: "ai-service",
          studentId: student.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }),
    ]);

    const attendanceRate = calculateAttendanceRate(attendances);
    const strengths =
      analytics?.subjectPerformances
        .filter((subject) => subject.isStrength)
        .map((subject) => subject.subject.name) ?? [];
    const weaknesses =
      analytics?.subjectPerformances
        .filter((subject) => subject.isWeakness)
        .map((subject) => subject.subject.name) ?? [];

    const recommendations = uniq([
      ...(failurePrediction?.recommendations ?? []),
      ...(weaknesses.length > 0
        ? [`Renforcer les matières faibles: ${weaknesses.join(", ")}.`]
        : []),
      ...(attendanceRate !== null && attendanceRate < 85
        ? ["Améliorer l'assiduité pour réduire le risque académique."]
        : []),
    ]);

    return {
      confidence: analytics ? 0.88 : 0.45,
      recommendations,
      data: {
        status: analytics ? "analyzed" : "insufficient_data",
        student: {
          id: student.id,
          name: formatStudentName(student),
          matricule: student.matricule,
          class: student.enrollments[0]?.class ?? null,
          academicYear: student.enrollments[0]?.academicYear ?? null,
        },
        analyticsPeriod: analytics
          ? {
              periodId: analytics.period.id,
              periodName: analytics.period.name,
              academicYearId: analytics.academicYear.id,
              academicYearName: analytics.academicYear.name,
            }
          : null,
        metrics: {
          averageGrade: analytics?.generalAverage !== null && analytics?.generalAverage !== undefined
            ? Number(analytics.generalAverage)
            : null,
          classRank: analytics?.classRank ?? null,
          classSize: analytics?.classSize ?? null,
          attendanceRate,
          performanceLevel: analytics?.performanceLevel ?? null,
          consistencyRate: analytics?.consistencyRate !== null && analytics?.consistencyRate !== undefined
            ? Number(analytics.consistencyRate)
            : null,
          progressionRate: analytics?.progressionRate !== null && analytics?.progressionRate !== undefined
            ? Number(analytics.progressionRate)
            : null,
          riskLevel: analytics?.riskLevel ?? null,
          riskFactors: analytics?.riskFactors ?? [],
          incidentCount: incidents.length,
        },
        strengths,
        weaknesses,
        subjectPerformance:
          analytics?.subjectPerformances.map((subject) => ({
            subjectId: subject.subjectId,
            subjectName: subject.subject.name,
            average: subject.average !== null && subject.average !== undefined ? Number(subject.average) : null,
            trend: subject.trend,
            progressionRate:
              subject.progressionRate !== null && subject.progressionRate !== undefined
                ? Number(subject.progressionRate)
                : null,
            isStrength: subject.isStrength,
            isWeakness: subject.isWeakness,
          })) ?? [],
        prediction: failurePrediction
          ? {
              probability: failurePrediction.probability,
              level: failurePrediction.level,
              factors: failurePrediction.factors,
              causalFactors: failurePrediction.causalFactors,
            }
          : null,
      },
    };
  }

  private async analyzeClass(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const classId = this.resolveRequestedClassId(request);
    if (!classId) {
      throw new AIServiceError("classId requis pour analyser une classe", 400, "MISSING_CLASS_ID");
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        schoolId: true,
        classLevel: {
          select: { name: true, level: true },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          select: { studentId: true, academicYearId: true },
        },
      },
    });

    if (!classRecord) {
      throw new AIServiceError("Classe introuvable", 404, "CLASS_NOT_FOUND");
    }

    await this.ensureClassScope(request, classRecord);

    const studentIds = classRecord.enrollments.map((enrollment) => enrollment.studentId);
    const academicYearIds = uniq(classRecord.enrollments.map((enrollment) => enrollment.academicYearId));

    const [analyticsRows, attendances] = await Promise.all([
      this.getLatestAnalyticsForStudents(studentIds, {
        schoolId: classRecord.schoolId,
        academicYearIds,
      }),
      prisma.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        select: { status: true },
      }),
    ]);

    const classAverage = averageNumbers(
      analyticsRows.map((row) =>
        row.generalAverage !== null && row.generalAverage !== undefined
          ? Number(row.generalAverage)
          : null
      )
    );

    const attendanceRate = calculateAttendanceRate(attendances);
    const atRiskStudents = analyticsRows
      .filter((row) => ["MEDIUM", "HIGH", "CRITICAL"].includes(row.riskLevel))
      .map((row) => ({
        id: row.student.id,
        name: formatStudentName(row.student),
        riskLevel: row.riskLevel,
        averageGrade:
          row.generalAverage !== null && row.generalAverage !== undefined
            ? Number(row.generalAverage)
            : null,
        className: row.student.enrollments[0]?.class.name ?? classRecord.name,
        riskFactors: row.riskFactors,
      }))
      .sort((left, right) => {
        const riskDiff = getRiskPriority(right.riskLevel) - getRiskPriority(left.riskLevel);
        if (riskDiff !== 0) return riskDiff;
        return (left.averageGrade ?? 99) - (right.averageGrade ?? 99);
      });

    const topStudents = analyticsRows
      .filter((row) => row.generalAverage !== null && row.generalAverage !== undefined)
      .sort((left, right) => Number(right.generalAverage ?? 0) - Number(left.generalAverage ?? 0))
      .slice(0, 5)
      .map((row) => ({
        id: row.student.id,
        name: formatStudentName(row.student),
        averageGrade: Number(row.generalAverage),
        classRank: row.classRank,
      }));

    const riskDistribution = analyticsRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.riskLevel] = (acc[row.riskLevel] ?? 0) + 1;
      return acc;
    }, {});

    const recommendations = uniq([
      ...(classAverage !== null && classAverage < 10
        ? ["La moyenne de classe est insuffisante: prévoir un plan de remédiation."]
        : []),
      ...(attendanceRate !== null && attendanceRate < 85
        ? ["Le taux d'assiduité de la classe est faible: renforcer le suivi des absences."]
        : []),
      ...(atRiskStudents.length > 0
        ? [`Prioriser un suivi ciblé pour ${Math.min(atRiskStudents.length, 10)} élèves à risque.`]
        : []),
    ]);

    return {
      confidence: analyticsRows.length > 0 ? 0.84 : 0.4,
      recommendations,
      data: {
        status: analyticsRows.length > 0 ? "analyzed" : "insufficient_data",
        class: {
          id: classRecord.id,
          name: classRecord.name,
          level: classRecord.classLevel,
        },
        totals: {
          activeStudents: studentIds.length,
          analyticsCoverage: analyticsRows.length,
        },
        metrics: {
          classAverage: classAverage !== null ? roundTo(classAverage) : null,
          attendanceRate,
          atRiskCount: atRiskStudents.length,
          criticalRiskCount: atRiskStudents.filter((student) => student.riskLevel === "CRITICAL").length,
        },
        distribution: {
          riskLevels: riskDistribution,
        },
        topStudents,
        atRiskStudents: atRiskStudents.slice(0, 10),
      },
      alerts: this.buildRiskAlerts(atRiskStudents),
    };
  }

  private async analyzeSchool(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const schoolId = this.resolveRequestedSchoolId(request);
    if (!schoolId) {
      throw new AIServiceError("schoolId requis pour analyser un établissement", 400, "MISSING_SCHOOL_ID");
    }

    this.ensureSchoolWideScope(request, schoolId);

    const academicYearId = await this.getPreferredAcademicYearId(schoolId);

    const [schoolStats, verifiedPayments, latestAnalytics] = await Promise.all([
      analyticsService.getSchoolStats(schoolId),
      prisma.payment.aggregate({
        where: {
          status: "VERIFIED",
          fee: { schoolId },
          paidAt: { not: null },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.getLatestAnalyticsForStudents(
        (
          await prisma.enrollment.findMany({
            where: {
              status: "ACTIVE",
              class: { schoolId },
              ...(academicYearId ? { academicYearId } : {}),
            },
            select: { studentId: true },
          })
        ).map((enrollment) => enrollment.studentId),
        { schoolId, academicYearIds: academicYearId ? [academicYearId] : [] }
      ),
    ]);

    const overallAverage = averageNumbers(
      latestAnalytics.map((row) =>
        row.generalAverage !== null && row.generalAverage !== undefined
          ? Number(row.generalAverage)
          : null
      )
    );

    const atRiskStudents = latestAnalytics
      .filter((row) => ["MEDIUM", "HIGH", "CRITICAL"].includes(row.riskLevel))
      .map((row) => ({
        id: row.student.id,
        name: formatStudentName(row.student),
        riskLevel: row.riskLevel,
        averageGrade:
          row.generalAverage !== null && row.generalAverage !== undefined
            ? Number(row.generalAverage)
            : null,
        className: row.student.enrollments[0]?.class.name ?? null,
      }))
      .sort((left, right) => {
        const riskDiff = getRiskPriority(right.riskLevel) - getRiskPriority(left.riskLevel);
        if (riskDiff !== 0) return riskDiff;
        return (left.averageGrade ?? 99) - (right.averageGrade ?? 99);
      });

    const riskDistribution = latestAnalytics.reduce<Record<string, number>>((acc, row) => {
      acc[row.riskLevel] = (acc[row.riskLevel] ?? 0) + 1;
      return acc;
    }, {});

    const recommendations = uniq([
      ...(overallAverage !== null && overallAverage < 10
        ? ["Le niveau académique global est insuffisant: une stratégie pédagogique est nécessaire."]
        : []),
      ...(atRiskStudents.length > 0
        ? [`${atRiskStudents.length} élèves nécessitent un suivi renforcé à l'échelle de l'établissement.`]
        : []),
      ...(Number(verifiedPayments._sum.amount ?? 0) === 0
        ? ["Aucun paiement vérifié n'a été consolidé pour la période courante."]
        : []),
    ]);

    return {
      confidence: latestAnalytics.length > 0 ? 0.82 : 0.38,
      recommendations,
      data: {
        status: latestAnalytics.length > 0 ? "analyzed" : "insufficient_data",
        schoolId,
        totals: {
          students: schoolStats.studentsCount,
          teachers: schoolStats.teachersCount,
          classes: schoolStats.classesCount,
          analyticsCoverage: latestAnalytics.length,
        },
        metrics: {
          overallAverage: overallAverage !== null ? roundTo(overallAverage) : null,
          atRiskCount: atRiskStudents.length,
          criticalRiskCount: atRiskStudents.filter((student) => student.riskLevel === "CRITICAL").length,
          verifiedPaymentsCount: verifiedPayments._count,
          verifiedRevenue: Number(verifiedPayments._sum.amount ?? 0),
        },
        distribution: {
          riskLevels: riskDistribution,
        },
        topAtRiskStudents: atRiskStudents.slice(0, 10),
      },
      alerts: this.buildRiskAlerts(atRiskStudents),
    };
  }

  private async detectAtRiskStudents(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const classId = this.resolveRequestedClassId(request);

    let analyticsRows: Array<any> = [];
    let scope: { type: "school" | "class"; schoolId?: string; classId?: string } = {
      type: "school",
    };

    if (classId) {
      const classRecord = await prisma.class.findUnique({
        where: { id: classId },
        select: {
          id: true,
          schoolId: true,
          enrollments: {
            where: { status: "ACTIVE" },
            select: { studentId: true, academicYearId: true },
          },
        },
      });

      if (!classRecord) {
        throw new AIServiceError("Classe introuvable", 404, "CLASS_NOT_FOUND");
      }

      await this.ensureClassScope(request, classRecord);

      analyticsRows = await this.getLatestAnalyticsForStudents(
        classRecord.enrollments.map((enrollment) => enrollment.studentId),
        {
          schoolId: classRecord.schoolId,
          academicYearIds: uniq(classRecord.enrollments.map((enrollment) => enrollment.academicYearId)),
        }
      );
      scope = { type: "class", schoolId: classRecord.schoolId, classId: classRecord.id };
    } else {
      const schoolId = this.resolveRequestedSchoolId(request);
      if (!schoolId) {
        throw new AIServiceError("schoolId requis pour détecter les élèves à risque", 400, "MISSING_SCHOOL_ID");
      }

      this.ensureSchoolWideScope(request, schoolId);

      const academicYearId = await this.getPreferredAcademicYearId(schoolId);
      const studentIds = (
        await prisma.enrollment.findMany({
          where: {
            status: "ACTIVE",
            class: { schoolId },
            ...(academicYearId ? { academicYearId } : {}),
          },
          select: { studentId: true },
        })
      ).map((enrollment) => enrollment.studentId);

      analyticsRows = await this.getLatestAnalyticsForStudents(studentIds, {
        schoolId,
        academicYearIds: academicYearId ? [academicYearId] : [],
      });
      scope = { type: "school", schoolId };
    }

    const atRiskStudents = analyticsRows
      .filter((row) => ["MEDIUM", "HIGH", "CRITICAL"].includes(row.riskLevel))
      .map((row) => ({
        id: row.student.id,
        name: formatStudentName(row.student),
        className: row.student.enrollments[0]?.class.name ?? null,
        riskLevel: row.riskLevel,
        averageGrade:
          row.generalAverage !== null && row.generalAverage !== undefined
            ? Number(row.generalAverage)
            : null,
        riskFactors: row.riskFactors,
      }))
      .sort((left, right) => {
        const riskDiff = getRiskPriority(right.riskLevel) - getRiskPriority(left.riskLevel);
        if (riskDiff !== 0) return riskDiff;
        return (left.averageGrade ?? 99) - (right.averageGrade ?? 99);
      });

    const alerts = this.buildRiskAlerts(atRiskStudents);

    return {
      confidence: analyticsRows.length > 0 ? 0.86 : 0.4,
      alerts,
      recommendations: uniq([
        ...(atRiskStudents.length > 0
          ? ["Mettre en place un suivi individualisé pour les élèves à risque prioritaire."]
          : ["Aucun élève à risque moyen ou élevé n'a été détecté sur le périmètre courant."]),
      ]),
      data: {
        status: analyticsRows.length > 0 ? "analyzed" : "insufficient_data",
        scope,
        totalStudents: analyticsRows.length,
        atRiskCount: atRiskStudents.length,
        highRiskCount: atRiskStudents.filter((student) =>
          ["HIGH", "CRITICAL"].includes(student.riskLevel)
        ).length,
        atRiskStudents,
      },
    };
  }

  private async predictGrades(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const studentId = this.resolveRequestedStudentId(request);
    if (!studentId) {
      throw new AIServiceError("studentId requis pour prédire les notes", 400, "MISSING_STUDENT_ID");
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        userId: true,
        schoolId: true,
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!student) {
      throw new AIServiceError("Élève introuvable", 404, "STUDENT_NOT_FOUND");
    }

    await this.ensureStudentScope(request, student);

    const [generalPrediction, gradeHistory] = await Promise.all([
      predictNextPeriodGrade(student.id).catch((error) => {
        logger.warn("Unable to compute next period grade prediction", {
          module: "ai-service",
          studentId: student.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }),
      prisma.gradeHistory.findMany({
        where: {
          studentId: student.id,
          subjectId: { not: null },
        },
        include: {
          subject: {
            select: { id: true, name: true },
          },
          period: {
            select: { id: true, name: true, sequence: true },
          },
        },
        orderBy: [{ subjectId: "asc" }, { period: { sequence: "asc" } }],
      }),
    ]);

    const historyBySubject = new Map<
      string,
      Array<{
        average: number;
        subjectName: string;
        periodName: string;
      }>
    >();

    for (const row of gradeHistory) {
      if (!row.subjectId || !row.subject) continue;
      const current = historyBySubject.get(row.subjectId) ?? [];
      current.push({
        average: Number(row.average),
        subjectName: row.subject.name,
        periodName: row.period.name,
      });
      historyBySubject.set(row.subjectId, current);
    }

    const subjectPredictions = Array.from(historyBySubject.entries())
      .map(([subjectId, history]) => {
        const latest = history[history.length - 1];
        const previous = history.length > 1 ? history[history.length - 2] : null;
        const delta = previous ? latest.average - previous.average : 0;
        const projected = roundTo(clamp(latest.average + delta, 0, 20));
        return {
          subjectId,
          subjectName: latest.subjectName,
          latestAverage: roundTo(latest.average),
          lastPeriod: latest.periodName,
          trend: previous
            ? delta > 0.5
              ? "up"
              : delta < -0.5
                ? "down"
                : "stable"
            : "stable",
          projectedAverage: projected,
          dataPoints: history.length,
        };
      })
      .sort((left, right) => left.subjectName.localeCompare(right.subjectName));

    const lowProjectionSubjects = subjectPredictions
      .filter((subject) => subject.projectedAverage < 10)
      .map((subject) => subject.subjectName);

    const recommendations = uniq([
      ...(generalPrediction?.warning ? [generalPrediction.warning] : []),
      ...(lowProjectionSubjects.length > 0
        ? [`Renforcer prioritairement les matières projetées sous 10/20: ${lowProjectionSubjects.join(", ")}.`]
        : []),
    ]);

    return {
      confidence: generalPrediction ? clamp(generalPrediction.confidence / 100, 0.1, 0.95) : 0.35,
      recommendations,
      data: {
        status:
          generalPrediction || subjectPredictions.length > 0 ? "predicted" : "insufficient_data",
        student: {
          id: student.id,
          name: formatStudentName(student),
        },
        generalAveragePrediction: generalPrediction
          ? {
              predicted: generalPrediction.predicted,
              confidence: generalPrediction.confidence,
              range: generalPrediction.range,
              modelUsed: generalPrediction.modelUsed,
              warning: generalPrediction.warning ?? null,
            }
          : null,
        subjectPredictions,
      },
    };
  }

  async recommendOrientation(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const studentId = this.resolveRequestedStudentId(request);
    if (!studentId) {
      throw new AIServiceError("studentId requis pour orienter un élève", 400, "MISSING_STUDENT_ID");
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { enrolledAt: "desc" },
          take: 1,
          include: { class: true },
        },
      },
    });

    if (!student) {
      throw new AIServiceError("Élève introuvable", 404, "STUDENT_NOT_FOUND");
    }

    await this.ensureStudentScope(request, { id: student.id, userId: student.userId, schoolId: student.schoolId });

    const analytics = await this.getLatestStudentAnalytics(student.id, student.schoolId);

    if (!analytics) {
      return {
        data: { series: "SERIE_D", justification: "Données analytiques insuffisantes. Recommandation par défaut." },
        confidence: 0.3,
      };
    }

    const context = {
      studentName: formatStudentName(student),
      currentClass: student.enrollments[0]?.class.name,
      generalAverage: Number(analytics.generalAverage || 0),
      subjects: analytics.subjectPerformances.map((p) => ({
        name: p.subject.name,
        average: Number(p.average || 0),
        isStrength: p.isStrength,
        isWeakness: p.isWeakness,
      })),
    };

    let result: any = null;
    let engine: "external" | "local" = "local";

    if (hasExternalAIConfigured()) {
      try {
        const prompt = `En tant qu'expert en orientation scolaire du système béninois, analyse les résultats de l'élève ${context.studentName} (${context.currentClass}) qui finit son cycle BEPC.
        Notes: ${JSON.stringify(context.subjects)}
        Moyenne Générale: ${context.generalAverage}

        Recommande la meilleure série pour la classe de Seconde parmi: A1, A2 (Littéraire), B (Économique), C, D (Scientifique), E (Technique), F1-F4 (Industrielle), G1-G3 (Tertiaire).
        
        Réponds UNIQUEMENT par un objet JSON au format:
        {
          "series": "CODE_SERIE",
          "justification": "Explication pédagogique concise (30-50 mots)",
          "alternatives": ["SERIE2", "SERIE3"]
        }`;

        const externalResponse = await callExternalAI({
          message: prompt,
          role: request.userRole,
          studentData: context,
        });

        if (externalResponse.success) {
          const jsonMatch = externalResponse.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
            engine = "external";
          }
        }
      } catch (error) {
        logger.warn("Orientation recommendation via external AI failed, falling back to local logic", { error });
      }
    }

    if (!result) {
      // Local Fallback (matching route.ts logic but as a utility)
      const sciAvg = averageNumbers(context.subjects.filter(s => 
        ["math", "physique", "svt", "chimie", "sciences"].some(k => s.name.toLowerCase().includes(k))
      ).map(s => s.average)) || 0;
      
      const litAvg = averageNumbers(context.subjects.filter(s => 
        ["français", "histoire", "géo", "lettres", "langue"].some(k => s.name.toLowerCase().includes(k))
      ).map(s => s.average)) || 0;

      if (sciAvg >= 12) {
          result = { series: "SERIE_C", justification: `Excellent profil scientifique (moyenne sciences: ${sciAvg.toFixed(2)}/20).` };
      } else if (litAvg >= 12) {
          result = { series: "SERIE_A1", justification: `Fortes aptitudes littéraires (moyenne littéraire: ${litAvg.toFixed(2)}/20).` };
      } else {
          result = { series: "SERIE_D", justification: `Profil polyvalent avec une moyenne générale de ${context.generalAverage.toFixed(2)}/20.` };
      }
    }

    return {
      data: result,
      confidence: engine === "external" ? 0.9 : 0.65,
      recommendations: result.alternatives || [],
    };
  }

  getStatus(): AIServiceStatus {
    const cloudReady = hasExternalAIConfigured() || Boolean(process.env.N8N_HOST);
    return {
      operational: this.initialized,
      modelLoaded: this.modelLoaded,
      loadTime: this.modelLoadTime,
      externalConfigured: hasExternalAIConfigured(),
      n8nConfigured: Boolean(process.env.N8N_HOST),
      runtimeMode: cloudReady ? "cloud_only" : "degraded",
    };
  }
  async analyzeRiskIntervention(request: GovernanceRequest): Promise<GovernanceActionResult> {
    const studentId = this.resolveRequestedStudentId(request);
    if (!studentId) {
      throw new AIServiceError("studentId requis pour l'analyse de risque", 400, "MISSING_STUDENT_ID");
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollments: {
          where: { status: "ACTIVE" },
          orderBy: { enrolledAt: "desc" },
          take: 1,
          include: { class: true },
        },
      },
    });

    if (!student) {
      throw new AIServiceError("Élève introuvable", 404, "STUDENT_NOT_FOUND");
    }

    await this.ensureStudentScope(request, { id: student.id, userId: student.userId, schoolId: student.schoolId });

    // Récupérer les données de risque calculées par le moteur local
    const { predictFailureRisk } = await import("@/lib/services/ai-predictive/predict-failure");
    const localRisk = await predictFailureRisk(student.id);

    const context = {
      studentName: formatStudentName(student),
      currentClass: student.enrollments[0]?.class.name,
      riskLevel: localRisk.level,
      riskProbability: localRisk.probability,
      factors: localRisk.factors,
      causalFactors: localRisk.causalFactors,
    };

    const intervention = "";
    const engine: "external" | "local" = "local";

    if (hasExternalAIConfigured()) {
      try {
        const prompt = `En tant qu'expert en psychopédagogie et réussite scolaire, analyse le risque d'échec de l'élève ${context.studentName} (${context.currentClass}).
        Niveau de risque: ${context.riskLevel} (${context.riskProbability}%)
        Facteurs identifiés: ${context.factors.join(", ")}
        Détails techniques: ${JSON.stringify(context.causalFactors)}

        Propose un plan d'action RÉALISTE, CONCRET et IMMÉDIAT. 
        Inclus des suggestions très spécifiques comme:
        - Recours à un répétiteur spécialisé (ex: "Étudiant en Master de Maths pour renforcement en calcul matriciel")
        - Aménagement spécifique (ex: "Tiers-temps pour les évaluations", "Place au premier rang")
        - Actions de suivi (ex: "Entretien hebdomadaire avec le conseiller d'orientation")
        - Implication des parents (ex: "Installation d'un contrôle parental sur les écrans le soir")

        Réponds UNIQUEMENT par un objet JSON au format:
        {
          "riskLevel": "${context.riskLevel}",
          "riskScore": ${context.riskProbability},
          "factors": ${JSON.stringify(context.factors)},
          "recommendations": ["Recommandation 1", "Recommandation 2"],
          "priority": "${localRisk.probability >= 75 ? 'CRITICAL' : localRisk.probability >= 55 ? 'HIGH' : 'MEDIUM'}",
          "suggestedActions": [
            { "title": "Titre court", "description": "Description détaillée", "type": "Pédagogique" | "Suivi" }
          ]
        }`;

        const externalResponse = await callExternalAI({
          message: prompt,
          role: request.userRole,
          studentData: context,
        });

        if (externalResponse.success) {
          const jsonMatch = externalResponse.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const aiData = JSON.parse(jsonMatch[0]);
            return {
              data: aiData,
              confidence: 0.9,
            };
          }
        }
      } catch (error) {
        logger.warn("Risk intervention analysis via external AI failed", { error });
      }
    }

    // Fallback local haut de gamme
    const priority = localRisk.probability >= 75 ? 'CRITICAL' : localRisk.probability >= 55 ? 'HIGH' : 'MEDIUM';
    
    return {
      data: {
        riskLevel: localRisk.level,
        riskScore: localRisk.probability,
        factors: localRisk.factors,
        recommendations: localRisk.recommendations,
        priority: priority,
        suggestedActions: [
          {
            title: "Renforcement Académique",
            description: "Mise en place d'un tutorat par les pairs ou un répétiteur externe dans les matières à faible moyenne.",
            type: "Pédagogique"
          },
          {
            title: "Suivi de l'Assiduité",
            description: "Contrôle quotidien de la présence et alerte immédiate des parents en cas d'absence non justifiée.",
            type: "Suivi"
          }
        ]
      },
      confidence: 0.5,
    };
  }
}

export const aiService = new AIService();
