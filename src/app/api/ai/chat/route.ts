import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.enum(["general", "grades", "attendance", "behavior", "orientation", "schedule"]).optional(),
});

interface ChatContext {
  userRole: string;
  userName: string;
  schoolName?: string;
  studentData?: {
    grades?: Array<{ subject: string; average: number }>;
    attendance?: { present: number; absent: number; rate: number };
    incidents?: number;
  };
  childrenData?: Array<{
    name: string;
    grades?: Array<{ subject: string; average: number }>;
    attendance?: { rate: number };
  }>;
  teacherData?: {
    classes: string[];
    subjectsTaught: string[];
  };
}

/**
 * POST /api/ai/chat
 * AI Chatbot endpoint for EduPilot
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { message, context } = chatMessageSchema.parse(body);

    // Build user context based on role
    const userContext = await buildUserContext(session.user);

    // Generate AI response based on context and message
    const response = await generateAIResponse(message, context, userContext);

    // Log conversation for analytics
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "AI_CHAT",
        entity: "AIAssistant",
        entityId: "chat",
        oldValues: { message },
        newValues: { response: response.substring(0, 500) },
      },
    });

    return NextResponse.json({
      response,
      context: context || "general",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Message invalide", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" in AI chat:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de votre demande" },
      { status: 500 }
    );
  }
}

async function buildUserContext(user: {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  schoolId?: string | null;
}): Promise<ChatContext> {
  const context: ChatContext = {
    userRole: user.role,
    userName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
  };

  // Get school info
  if (user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    });
    context.schoolName = school?.name;
  }

  // Role-specific data
  if (user.role === "STUDENT") {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });

    if (studentProfile) {
      // Get grades for this student via evaluation
      const grades = await prisma.grade.findMany({
        where: { studentId: studentProfile.id },
        include: {
          evaluation: {
            include: {
              classSubject: {
                include: {
                  subject: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Calculate grades by subject
      const gradesBySubject: Record<string, number[]> = {};
      grades.forEach((g) => {
        if (g.value === null) return;
        const subjectName = g.evaluation.classSubject.subject.name;
        if (!gradesBySubject[subjectName]) {
          gradesBySubject[subjectName] = [];
        }
        gradesBySubject[subjectName].push(Number(g.value));
      });

      context.studentData = {
        grades: Object.entries(gradesBySubject).map(([subject, values]) => ({
          subject,
          average: values.reduce((a, b) => a + b, 0) / values.length,
        })),
      };

      // Get attendance
      const attendanceCount = await prisma.attendance.groupBy({
        by: ["status"],
        where: { studentId: studentProfile.id },
        _count: true,
      });

      const present = attendanceCount.find((a) => a.status === "PRESENT")?._count || 0;
      const absent = attendanceCount.find((a) => a.status === "ABSENT")?._count || 0;
      const total = attendanceCount.reduce((sum, a) => sum + a._count, 0);

      context.studentData.attendance = {
        present,
        absent,
        rate: total > 0 ? Math.round((present / total) * 100) : 100,
      };

      // Get incidents count
      const incidentCount = await prisma.behaviorIncident.count({
        where: { studentId: studentProfile.id },
      });
      context.studentData.incidents = incidentCount;
    }
  } else if (user.role === "PARENT") {
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: user.id },
      include: {
        children: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (parentProfile) {
      context.childrenData = await Promise.all(
        parentProfile.children.map(async (child) => {
          const studentName = `${child.student.user.firstName} ${child.student.user.lastName}`;

          const attendanceCount = await prisma.attendance.groupBy({
            by: ["status"],
            where: { studentId: child.studentId },
            _count: true,
          });

          const present = attendanceCount.find((a) => a.status === "PRESENT")?._count || 0;
          const total = attendanceCount.reduce((sum, a) => sum + a._count, 0);

          return {
            name: studentName,
            attendance: {
              rate: total > 0 ? Math.round((present / total) * 100) : 100,
            },
          };
        })
      );
    }
  } else if (user.role === "TEACHER") {
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      include: {
        classSubjects: {
          include: {
            class: { include: { classLevel: true } },
            subject: true,
          },
        },
      },
    });

    if (teacherProfile) {
      const classes = [...new Set(
        teacherProfile.classSubjects.map(
          (cs) => `${cs.class.classLevel.name} ${cs.class.name}`
        )
      )];
      const subjects = [...new Set(
        teacherProfile.classSubjects.map((cs) => cs.subject.name)
      )];

      context.teacherData = {
        classes,
        subjectsTaught: subjects,
      };
    }
  }

  return context;
}

async function generateAIResponse(
  message: string,
  context: string | undefined,
  userContext: ChatContext
): Promise<string> {
  const lowerMessage = message.toLowerCase();

  // Greeting patterns
  if (lowerMessage.match(/^(bonjour|salut|hello|coucou|bonsoir|hey)/)) {
    return generateGreeting(userContext);
  }

  // Help patterns
  if (lowerMessage.includes("aide") || lowerMessage.includes("help") || lowerMessage.includes("comment")) {
    return generateHelpResponse(userContext);
  }

  // Grade-related queries
  if (
    lowerMessage.includes("note") ||
    lowerMessage.includes("moyenne") ||
    lowerMessage.includes("résultat") ||
    context === "grades"
  ) {
    return generateGradeResponse(userContext);
  }

  // Attendance queries
  if (
    lowerMessage.includes("présence") ||
    lowerMessage.includes("absence") ||
    lowerMessage.includes("retard") ||
    context === "attendance"
  ) {
    return generateAttendanceResponse(userContext);
  }

  // Behavior/incident queries
  if (
    lowerMessage.includes("comportement") ||
    lowerMessage.includes("incident") ||
    lowerMessage.includes("discipline") ||
    context === "behavior"
  ) {
    return generateBehaviorResponse(userContext);
  }

  // Orientation queries
  if (
    lowerMessage.includes("orientation") ||
    lowerMessage.includes("filière") ||
    lowerMessage.includes("avenir") ||
    lowerMessage.includes("carrière") ||
    context === "orientation"
  ) {
    return generateOrientationResponse(userContext);
  }

  // Schedule queries
  if (
    lowerMessage.includes("emploi du temps") ||
    lowerMessage.includes("cours") ||
    lowerMessage.includes("planning") ||
    context === "schedule"
  ) {
    return generateScheduleResponse(userContext);
  }

  // Improvement suggestions
  if (
    lowerMessage.includes("améliorer") ||
    lowerMessage.includes("progresser") ||
    lowerMessage.includes("conseil")
  ) {
    return generateImprovementResponse(userContext);
  }

  // Default response
  return generateDefaultResponse(userContext);
}

function generateGreeting(ctx: ChatContext): string {
  const name = ctx.userName || "utilisateur";
  const roleGreeting = {
    STUDENT: `Bonjour ${name} ! Je suis l'assistant IA d'EduPilot. Je peux vous aider à consulter vos notes, suivre vos présences, et vous donner des conseils pour votre réussite scolaire. Que souhaitez-vous savoir ?`,
    TEACHER: `Bonjour ${name} ! Je suis votre assistant IA. Je peux vous aider à analyser les performances de vos classes, identifier les élèves à risque, et optimiser votre suivi pédagogique. Comment puis-je vous aider ?`,
    PARENT: `Bonjour ${name} ! Je suis l'assistant IA d'EduPilot. Je peux vous informer sur les résultats scolaires de vos enfants, leur assiduité, et vous conseiller sur leur accompagnement. Que souhaitez-vous savoir ?`,
    SCHOOL_ADMIN: `Bonjour ${name} ! Je suis à votre disposition pour analyser les données de l'établissement, générer des rapports et vous aider dans la gestion quotidienne. Comment puis-je vous assister ?`,
    DIRECTOR: `Bonjour ${name} ! En tant qu'assistant IA, je peux vous fournir des analyses globales sur l'établissement, les tendances de performance et les alertes importantes. Que souhaitez-vous consulter ?`,
  };

  return roleGreeting[ctx.userRole as keyof typeof roleGreeting] ||
    `Bonjour ${name} ! Je suis l'assistant IA d'EduPilot. Comment puis-je vous aider aujourd'hui ?`;
}

function generateHelpResponse(ctx: ChatContext): string {
  const baseHelp = `Voici ce que je peux faire pour vous :\n\n`;

  const features = {
    STUDENT: [
      "📊 Consulter vos notes et moyennes",
      "📅 Voir votre taux de présence",
      "📈 Analyser vos progrès",
      "🎯 Obtenir des conseils d'orientation",
      "💡 Recevoir des recommandations d'amélioration",
    ],
    TEACHER: [
      "📊 Analyser les performances de vos classes",
      "⚠️ Identifier les élèves à risque",
      "📈 Suivre les tendances de notes",
      "📅 Consulter les statistiques de présence",
      "💡 Obtenir des recommandations pédagogiques",
    ],
    PARENT: [
      "📊 Consulter les notes de vos enfants",
      "📅 Voir leur taux de présence",
      "⚠️ Recevoir des alertes importantes",
      "💡 Obtenir des conseils d'accompagnement",
      "📈 Suivre leur progression",
    ],
  };

  const roleFeatures = features[ctx.userRole as keyof typeof features] || features.STUDENT;
  return baseHelp + roleFeatures.join("\n") + "\n\nPosez-moi simplement votre question !";
}

function generateGradeResponse(ctx: ChatContext): string {
  if (ctx.userRole === "STUDENT" && ctx.studentData?.grades) {
    const grades = ctx.studentData.grades;
    if (grades.length === 0) {
      return "Je n'ai pas encore de notes enregistrées pour vous. Vos enseignants n'ont peut-être pas encore saisi les évaluations.";
    }

    const overall = grades.reduce((sum, g) => sum + g.average, 0) / grades.length;
    const best = grades.reduce((a, b) => (a.average > b.average ? a : b));
    const worst = grades.reduce((a, b) => (a.average < b.average ? a : b));

    let response = `📊 **Voici un résumé de vos notes :**\n\n`;
    response += `**Moyenne générale :** ${overall.toFixed(2)}/20\n\n`;
    response += `**Par matière :**\n`;
    grades.forEach((g) => {
      const emoji = g.average >= 14 ? "🟢" : g.average >= 10 ? "🟡" : "🔴";
      response += `${emoji} ${g.subject}: ${g.average.toFixed(2)}/20\n`;
    });
    response += `\n**Point fort :** ${best.subject} (${best.average.toFixed(2)}/20)\n`;

    if (worst.average < 10) {
      response += `**À améliorer :** ${worst.subject} (${worst.average.toFixed(2)}/20)\n`;
      response += `\n💡 Je vous conseille de consacrer plus de temps à ${worst.subject} et de demander de l'aide à votre enseignant si nécessaire.`;
    }

    return response;
  }

  if (ctx.userRole === "PARENT" && ctx.childrenData) {
    return `Pour consulter les notes détaillées de vos enfants, rendez-vous dans la section "Notes" de votre tableau de bord. Je peux vous aider à analyser leurs résultats si vous me donnez plus de détails.`;
  }

  if (ctx.userRole === "TEACHER" && ctx.teacherData) {
    return `En tant qu'enseignant de ${ctx.teacherData.subjectsTaught.join(", ")}, vous pouvez consulter les notes de vos classes dans la section "Saisie des notes". Souhaitez-vous une analyse des performances d'une classe en particulier ?`;
  }

  return "Pour consulter les notes, rendez-vous dans la section dédiée de votre tableau de bord.";
}

function generateAttendanceResponse(ctx: ChatContext): string {
  if (ctx.userRole === "STUDENT" && ctx.studentData?.attendance) {
    const att = ctx.studentData.attendance;
    const emoji = att.rate >= 90 ? "🟢" : att.rate >= 75 ? "🟡" : "🔴";

    let response = `📅 **Votre taux de présence : ${emoji} ${att.rate}%**\n\n`;
    response += `- Présences : ${att.present}\n`;
    response += `- Absences : ${att.absent}\n\n`;

    if (att.rate < 90) {
      response += `⚠️ Votre taux de présence est insuffisant. L'assiduité est essentielle pour votre réussite scolaire. Chaque absence vous fait manquer des cours importants.`;
    } else {
      response += `✨ Excellent ! Votre assiduité est très bonne. Continuez ainsi !`;
    }

    return response;
  }

  return "Pour consulter les présences, rendez-vous dans la section dédiée de votre tableau de bord.";
}

function generateBehaviorResponse(ctx: ChatContext): string {
  if (ctx.userRole === "STUDENT" && ctx.studentData?.incidents !== undefined) {
    const count = ctx.studentData.incidents;

    if (count === 0) {
      return "🌟 **Excellent !** Vous n'avez aucun incident de comportement enregistré. Continuez ainsi !";
    }

    return `📋 Vous avez ${count} incident(s) de comportement enregistré(s). Pour en savoir plus, consultez la section "Comportement" de votre tableau de bord. Un bon comportement contribue à un environnement d'apprentissage positif pour tous.`;
  }

  return "Les informations de comportement sont disponibles dans la section dédiée de votre tableau de bord.";
}

function generateOrientationResponse(ctx: ChatContext): string {
  if (ctx.userRole === "STUDENT") {
    let response = `🎯 **Conseils d'orientation**\n\n`;

    if (ctx.studentData?.grades) {
      const grades = ctx.studentData.grades;
      const scienceGrades = grades.filter((g) =>
        ["Mathématiques", "Physique", "SVT", "Sciences"].some((s) =>
          g.subject.toLowerCase().includes(s.toLowerCase())
        )
      );
      const literaryGrades = grades.filter((g) =>
        ["Français", "Histoire", "Philosophie", "Langues"].some((s) =>
          g.subject.toLowerCase().includes(s.toLowerCase())
        )
      );

      const scienceAvg = scienceGrades.length > 0
        ? scienceGrades.reduce((sum, g) => sum + g.average, 0) / scienceGrades.length
        : 0;
      const literaryAvg = literaryGrades.length > 0
        ? literaryGrades.reduce((sum, g) => sum + g.average, 0) / literaryGrades.length
        : 0;

      if (scienceAvg > literaryAvg && scienceAvg >= 12) {
        response += `📐 Vos résultats scientifiques sont prometteurs (${scienceAvg.toFixed(1)}/20). Les filières scientifiques ou techniques pourraient vous convenir.\n\n`;
      } else if (literaryAvg > scienceAvg && literaryAvg >= 12) {
        response += `📚 Vos résultats littéraires sont excellents (${literaryAvg.toFixed(1)}/20). Les filières littéraires, juridiques ou de communication pourraient vous intéresser.\n\n`;
      }
    }

    response += `Pour une analyse complète de votre profil et des recommandations personnalisées, consultez la section "Orientation" de votre tableau de bord.`;
    return response;
  }

  return "Les informations d'orientation sont disponibles dans la section dédiée.";
}

function generateScheduleResponse(ctx: ChatContext): string {
  if (ctx.userRole === "TEACHER" && ctx.teacherData) {
    return `📅 Vous enseignez actuellement dans les classes suivantes :\n${ctx.teacherData.classes.map((c) => `- ${c}`).join("\n")}\n\nPour voir votre emploi du temps détaillé, consultez la section "Mon emploi du temps".`;
  }

  return "Votre emploi du temps est disponible dans la section dédiée de votre tableau de bord.";
}

function generateImprovementResponse(ctx: ChatContext): string {
  if (ctx.userRole === "STUDENT" && ctx.studentData?.grades) {
    const grades = ctx.studentData.grades;
    const weakSubjects = grades.filter((g) => g.average < 10);

    let response = `💡 **Conseils pour progresser**\n\n`;

    if (weakSubjects.length > 0) {
      response += `**Matières à renforcer :**\n`;
      weakSubjects.forEach((s) => {
        response += `- ${s.subject} (${s.average.toFixed(1)}/20)\n`;
      });
      response += `\n**Recommandations :**\n`;
      response += `1. Consacrez 30 minutes de révision quotidienne à ces matières\n`;
      response += `2. N'hésitez pas à poser des questions à vos enseignants\n`;
      response += `3. Travaillez en groupe avec des camarades qui maîtrisent ces sujets\n`;
      response += `4. Utilisez les ressources pédagogiques disponibles sur EduPilot\n`;
    } else {
      response += `Vos résultats sont bons dans toutes les matières ! Pour maintenir ce niveau :\n`;
      response += `1. Continuez votre régularité dans le travail\n`;
      response += `2. Approfondissez les sujets qui vous passionnent\n`;
      response += `3. Aidez vos camarades, c'est aussi une façon d'apprendre\n`;
    }

    if (ctx.studentData.attendance && ctx.studentData.attendance.rate < 90) {
      response += `\n⚠️ **Important :** Améliorez votre assiduité (${ctx.studentData.attendance.rate}% actuellement). La présence en cours est fondamentale.`;
    }

    return response;
  }

  return "Pour des conseils personnalisés, je vous invite à consulter les analyses IA disponibles dans votre tableau de bord.";
}

function generateDefaultResponse(_ctx: ChatContext): string {
  return `Je ne suis pas sûr de comprendre votre demande. Voici ce que je peux faire pour vous :\n\n` +
    `- **"mes notes"** - Voir vos résultats scolaires\n` +
    `- **"mes présences"** - Consulter votre assiduité\n` +
    `- **"orientation"** - Obtenir des conseils d'orientation\n` +
    `- **"améliorer"** - Recevoir des recommandations\n` +
    `- **"aide"** - Voir toutes les fonctionnalités\n\n` +
    `N'hésitez pas à reformuler votre question !`;
}
