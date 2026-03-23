/**
 * Types pour le système LMS (Learning Management System)
 */

export type LessonType = "TEXT" | "VIDEO" | "PDF" | "QUIZ" | "ASSIGNMENT";

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  type: LessonType;
  videoUrl: string | null;
  fileUrl: string | null;
  duration: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  classSubjectId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  isPublished: boolean;
  createdById: string;
  modules: CourseModule[];
  createdAt: string;
  updatedAt: string;
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  progress: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LessonCompletion {
  id: string;
  lessonId: string;
  studentId: string;
  completedAt: string;
}

export function getLessonTypeLabel(type: LessonType): string {
  const labels: Record<LessonType, string> = {
    TEXT: "Texte",
    VIDEO: "Vidéo",
    PDF: "Document PDF",
    QUIZ: "Quiz",
    ASSIGNMENT: "Devoir",
  };
  return labels[type];
}

export function getLessonTypeIcon(type: LessonType): string {
  const icons: Record<LessonType, string> = {
    TEXT: "📝",
    VIDEO: "🎥",
    PDF: "📄",
    QUIZ: "❓",
    ASSIGNMENT: "✍️",
  };
  return icons[type];
}
