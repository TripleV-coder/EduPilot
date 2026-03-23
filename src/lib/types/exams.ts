/**
 * Types pour le système d'examens QCM
 */

export type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY" | "FILL_BLANK";

export interface Question {
  id: string;
  examTemplateId: string;
  type: QuestionType;
  question: string;
  points: number;
  order: number;
  options: string[];
  correctAnswer: string | null;
  explanation: string | null;
}

export interface ExamTemplate {
  id: string;
  classSubjectId: string;
  title: string;
  description: string | null;
  duration: number;
  totalPoints: number;
  passingScore: number;
  isPublished: boolean;
  questions: Question[];
  createdAt: string;
}

export interface ExamSession {
  id: string;
  examTemplateId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  timeSpent: number | null;
  score: number | null;
  totalPoints: number;
  isPassed: boolean | null;
}

export interface ExamAnswer {
  id: string;
  examSessionId: string;
  questionId: string;
  answer: string | null;
  isCorrect: boolean | null;
  pointsEarned: number;
}

export function getQuestionTypeLabel(type: QuestionType): string {
  const labels: Record<QuestionType, string> = {
    MCQ: "Choix Multiple",
    TRUE_FALSE: "Vrai/Faux",
    SHORT_ANSWER: "Réponse Courte",
    ESSAY: "Dissertation",
    FILL_BLANK: "Remplir les Blancs",
  };
  return labels[type];
}
