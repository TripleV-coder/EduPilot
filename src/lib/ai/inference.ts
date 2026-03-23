/**
 * Local AI Inference Engine
 * Experimental deterministic fallback used when no external model is available.
 */

import { logger } from "@/lib/utils/logger";
const ENABLE_LOCAL_RULE_ENGINE = process.env.ENABLE_LOCAL_RULE_ENGINE === "true";

// AI Configuration
export interface AIConfig {
  modelPath: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  batchSize: number;
}

export const aiConfig: AIConfig = {
  modelPath: process.env.AI_MODEL_PATH || "./models",
  maxTokens: 2048,
  temperature: 0.7,
  contextWindow: 8192,
  batchSize: 32,
};

// Knowledge Base for the AI
export interface KnowledgeEntry {
  id: string;
  category: string;
  content: string;
  embeddings: number[];
  metadata: Record<string, any>;
}

class LocalInferenceEngine {
  private knowledgeBase: Map<string, KnowledgeEntry> = new Map();
  private modelLoaded: boolean = false;
  private vocabSize: number = 50000;
  private embeddingDim: number = 384;

  constructor() {
    this.initializeKnowledgeBase();
  }

  /**
   * Initialize the knowledge base with school data
   */
  private initializeKnowledgeBase(): void {
    // Core educational knowledge
    const coreKnowledge: Omit<KnowledgeEntry, "embeddings">[] = [
      {
        id: "edu_system",
        category: "education",
        content: "EduPilot supports primary, secondary, and high school education management with classes, subjects, teachers, and students.",
        metadata: { priority: 10 },
      },
      {
        id: "grading_system",
        category: "academic",
        content: "Grading system supports 0-20 scale, with coefficients, averages calculated automatically per subject and period.",
        metadata: { priority: 10 },
      },
      {
        id: "attendance_tracking",
        category: "operations",
        content: "Attendance tracking supports real-time monitoring, justifications, and automated alerts for absences.",
        metadata: { priority: 9 },
      },
      {
        id: "schedule_management",
        category: "operations",
        content: "Schedule management includes automatic conflict detection, weekly views, and room assignment.",
        metadata: { priority: 8 },
      },
      {
        id: "financial_management",
        category: "finance",
        content: "Financial module handles fees, payments, payment plans, scholarships, and generates invoices.",
        metadata: { priority: 9 },
      },
      {
        id: "parent_communication",
        category: "communication",
        content: "Parents receive notifications about grades, attendance, payments, and school events.",
        metadata: { priority: 8 },
      },
      {
        id: "ai_predictions",
        category: "analytics",
        content: "AI predictions analyze student performance, detect at-risk students, and provide intervention recommendations.",
        metadata: { priority: 10 },
      },
      {
        id: "orientation_system",
        category: "guidance",
        content: "Orientation system recommends educational tracks based on student strengths, interests, and career goals.",
        metadata: { priority: 9 },
      },
      {
        id: "certificates",
        category: "documentation",
        content: "Certificate system generates enrollment certificates, attendance certificates, and completion certificates.",
        metadata: { priority: 7 },
      },
      {
        id: "incidents",
        category: "discipline",
        content: "Incident tracking records behavioral issues, assigns sanctions, and tracks student improvement.",
        metadata: { priority: 8 },
      },
    ];

    // Add knowledge entries with embeddings
    coreKnowledge.forEach((entry) => {
      this.knowledgeBase.set(entry.id, {
        ...entry,
        embeddings: this.generateMockEmbeddings(entry.content),
      });
    });

    logger.info(`Knowledge base initialized with ${this.knowledgeBase.size} entries`);
  }

  /**
   * Generate embeddings for text (simplified - in production use ONNX/BERT)
   */
  private generateMockEmbeddings(text: string): number[] {
    // Create deterministic embeddings based on text
    const embeddings: number[] = new Array(this.embeddingDim).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word, index) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash |= 0;
      }
      const normalizedHash = Math.abs(hash) / 2147483647;
      embeddings[index % this.embeddingDim] += normalizedHash * (1 / (index + 1));
    });

    // Normalize
    const norm = Math.sqrt(embeddings.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      embeddings.forEach((val, i) => (embeddings[i] = val / norm));
    }

    return embeddings;
  }

  /**
   * Load the local model
   */
  async loadModel(): Promise<boolean> {
    if (this.modelLoaded) return true;

    if (!ENABLE_LOCAL_RULE_ENGINE) {
      logger.warn("Local AI rule engine disabled (ENABLE_LOCAL_RULE_ENGINE=false)");
      return false;
    }

    try {
      logger.info("Loading local AI model...");
      // Keep loading synchronous and deterministic when enabled.
      this.modelLoaded = true;
      logger.info("Local AI model loaded successfully");
      return true;
    } catch (error) {
      logger.error("Failed to load local AI model:", error as Error);
      return false;
    }
  }

  /**
   * Generate text response using local model
   */
  async generate(
    prompt: string,
    context?: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<string> {
    const isReady = await this.loadModel();
    if (!isReady) {
      throw new Error("Local AI engine is disabled in production.");
    }

    const maxTokens = options?.maxTokens || aiConfig.maxTokens;
    const temperature = options?.temperature || aiConfig.temperature;

    // Build context from knowledge base
    const relevantKnowledge = this.getRelevantKnowledge(prompt);
    const fullContext = context
      ? `${context}\n\nRelevant Knowledge:\n${relevantKnowledge}`
      : relevantKnowledge;

    // Generate response using local inference
    return this.localInference(prompt, fullContext, maxTokens, temperature);
  }

  /**
   * Get relevant knowledge entries based on query
   */
  private getRelevantKnowledge(query: string): string {
    const queryEmbedding = this.generateMockEmbeddings(query);
    const similarities: { id: string; score: number; entry: KnowledgeEntry }[] = [];

    this.knowledgeBase.forEach((entry) => {
      const similarity = this.cosineSimilarity(queryEmbedding, entry.embeddings);
      similarities.push({ id: entry.id, score: similarity, entry });
    });

    // Sort by similarity and take top 5
    similarities.sort((a, b) => b.score - a.score);
    const topEntries = similarities.slice(0, 5);

    return topEntries
      .map((s) => `[${s.entry.category.toUpperCase()}] ${s.entry.content}`)
      .join("\n");
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Local inference (in production, this would call ONNX runtime)
   */
  private async localInference(
    prompt: string,
    context: string,
    _maxTokens: number,
    _temperature: number
  ): Promise<string> {
    // Simulate local inference
    // In production, this would use a local LLM (Llama, Mistral via llama.cpp)

    const lowerPrompt = prompt.toLowerCase();

    // Handle different query types
    if (lowerPrompt.includes("grade") || lowerPrompt.includes("note")) {
      return this.generateGradeResponse(prompt, context);
    }
    if (lowerPrompt.includes("attendance") || lowerPrompt.includes("absence")) {
      return this.generateAttendanceResponse(prompt, context);
    }
    if (lowerPrompt.includes("payment") || lowerPrompt.includes("fee")) {
      return this.generatePaymentResponse(prompt, context);
    }
    if (lowerPrompt.includes("schedule") || lowerPrompt.includes("timetable")) {
      return this.generateScheduleResponse(prompt, context);
    }
    if (lowerPrompt.includes("student") || lowerPrompt.includes("eleve")) {
      return this.generateStudentResponse(prompt, context);
    }
    if (lowerPrompt.includes("predict") || lowerPrompt.includes("risk")) {
      return this.generatePredictionResponse(prompt, context);
    }
    if (lowerPrompt.includes("orientation") || lowerPrompt.includes("career")) {
      return this.generateOrientationResponse(prompt, context);
    }

    // Default response
    return this.generateGeneralResponse(prompt, context);
  }

  private generateGradeResponse(query: string, context: string): string {
    return `Based on the available data, here's information about grades:

**Grade Management System:**
- Supports 0-20 grading scale
- Coefficients can be assigned per evaluation
- Averages are calculated automatically per subject, period, and student

**Key Features:**
- Real-time grade entry by teachers
- Automatic average calculation
- Parent notification of new grades
- Grade history tracking

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like me to analyze specific student grades or class performance?`;
  }

  private generateAttendanceResponse(query: string, context: string): string {
    return `**Attendance Tracking System:**

Features:
- Real-time attendance recording
- Automatic absence alerts to parents
- Justification management
- Statistical reports by class and period

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like to see attendance statistics or generate a report?`;
  }

  private generatePaymentResponse(query: string, context: string): string {
    return `**Financial Management System:**

Features:
- Fee configuration by class level
- Multiple payment methods
- Payment plans support
- Scholarship management
- Automated payment reminders
- Invoice generation

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like help with payment reports or fee configuration?`;
  }

  private generateScheduleResponse(query: string, context: string): string {
    return `**Schedule Management System:**

Features:
- Weekly timetable creation
- Automatic conflict detection
- Room assignment
- Multi-view (daily/weekly/monthly)
- Exam scheduling

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like to view or modify the schedule?`;
  }

  private generateStudentResponse(query: string, context: string): string {
    return `**Student Management:**

Features:
- Complete student profiles
- Academic history tracking
- Parent/guardian linking
- Medical records
- Incident history

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like me to provide a student analysis or find specific information?`;
  }

  private generatePredictionResponse(query: string, context: string): string {
    return `**AI Predictive Analytics:**

Features:
- Academic performance prediction
- At-risk student detection
- Intervention recommendations
- Trend analysis

The AI analyzes:
- Historical grades
- Attendance patterns
- Behavior incidents
- Assignment completion rates

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like predictions for a specific student or class?`;
  }

  private generateOrientationResponse(query: string, context: string): string {
    return `**Student Orientation System:**

Features:
- Interest assessment
- Strength analysis
- Career recommendations
- Educational track suggestions

Available tracks include:
- General (BAC)
- Science Series (C, D, E)
- Literary Series (A1, A2)
- Technical Series (F, G, TI)

${context ? `\n**Relevant Context:**\n${context}` : ""}

Would you like orientation recommendations for a specific student?`;
  }

  private generateGeneralResponse(query: string, context: string): string {
    return `I'm here to help you manage the EduPilot platform effectively.

**I can assist with:**
- Academic management (grades, evaluations, subjects)
- Student information and tracking
- Attendance and discipline
- Financial operations
- Schedule management
- AI predictions and analytics
- Orientation guidance

${context ? `\n**Based on your question:**\n${context}` : ""}

What would you like to know more about?`;
  }

  /**
   * Batch inference for multiple queries
   */
  async generateBatch(
    queries: string[],
    context?: string
  ): Promise<string[]> {
    await this.loadModel();
    return Promise.all(
      queries.map((query) => this.generate(query, context))
    );
  }

  /**
   * Analyze data and provide insights
   */
  async analyze(
    dataType: string,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    const isReady = await this.loadModel();
    if (!isReady) {
      throw new Error("Local AI engine is disabled in production.");
    }

    switch (dataType) {
      case "student":
        return this.analyzeStudent(data);
      case "class":
        return this.analyzeClass(data);
      case "financial":
        return this.analyzeFinancial(data);
      default:
        return { insight: "Analysis not available for this data type" };
    }
  }

  private analyzeStudent(data: Record<string, any>): Record<string, any> {
    const grades = data.grades || [];
    const attendance = data.attendance || [];

    const avgGrade =
      grades.length > 0
        ? grades.reduce((sum: number, g: any) => sum + g.value, 0) / grades.length
        : 0;

    const attendanceRate =
      attendance.length > 0
        ? (attendance.filter((a: any) => a.present).length / attendance.length) *
        100
        : 100;

    let riskLevel = "low";
    let recommendation = "";

    if (avgGrade < 10 || attendanceRate < 80) {
      riskLevel = "high";
      recommendation =
        "Student may need academic support. Consider tutoring and parent meeting.";
    } else if (avgGrade < 12 || attendanceRate < 90) {
      riskLevel = "medium";
      recommendation =
        "Student is doing okay but could improve. Monitor progress.";
    } else {
      riskLevel = "low";
      recommendation =
        "Student is performing well. Encourage continued effort.";
    }

    return {
      averageGrade: avgGrade.toFixed(2),
      attendanceRate: attendanceRate.toFixed(1) + "%",
      riskLevel,
      recommendation,
      analyzedAt: new Date().toISOString(),
    };
  }

  private analyzeClass(data: Record<string, any>): Record<string, any> {
    const students = data.students || [];

    const avgGrade =
      students.length > 0
        ? students.reduce(
          (sum: number,
            s: any) => sum + (s.averageGrade || 0),
          0
        ) / students.length
        : 0;

    const atRiskCount = students.filter(
      (s: any) => s.riskLevel === "high"
    ).length;

    return {
      totalStudents: students.length,
      classAverage: avgGrade.toFixed(2),
      atRiskStudents: atRiskCount,
      recommendation:
        atRiskCount > 0
          ? "Consider group tutoring sessions for at-risk students."
          : "Class is performing well. Maintain current teaching approach.",
      analyzedAt: new Date().toISOString(),
    };
  }

  private analyzeFinancial(data: Record<string, any>): Record<string, any> {
    const payments = data.payments || [];
    const fees = data.fees || [];

    const totalFees = fees.reduce((sum: number, f: any) => sum + f.amount, 0);
    const collected = payments
      .filter((p: any) => p.status === "PAID")
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const collectionRate =
      totalFees > 0 ? (collected / totalFees) * 100 : 100;

    return {
      totalFees,
      collected,
      outstanding: totalFees - collected,
      collectionRate: collectionRate.toFixed(1) + "%",
      recommendation:
        collectionRate < 80
          ? "Consider sending payment reminders or offering payment plans."
          : "Financial status is healthy.",
      analyzedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const localAI = new LocalInferenceEngine();

// Helper functions
export async function askAI(
  prompt: string,
  context?: string
): Promise<string> {
  return localAI.generate(prompt, context);
}

export async function analyzeData(
  dataType: string,
  data: Record<string, any>
): Promise<Record<string, any>> {
  return localAI.analyze(dataType, data);
}

export async function loadAIModel(): Promise<boolean> {
  return localAI.loadModel();
}
