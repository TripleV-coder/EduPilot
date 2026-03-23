/**
 * Types pour les ressources pédagogiques
 */

export type ResourceType =
  | "LESSON"
  | "EXERCISE"
  | "EXAM"
  | "CORRECTION"
  | "DOCUMENT"
  | "VIDEO"
  | "AUDIO"
  | "OTHER";

export interface Resource {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  type: ResourceType;
  category: string | null;
  subjectId: string | null;
  classLevelId: string | null;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  thumbnailUrl: string | null;
  isPublic: boolean;
  uploadedById: string;
  downloads: number;
  createdAt: string;
  updatedAt: string;
}

export function getResourceTypeLabel(type: ResourceType): string {
  const labels: Record<ResourceType, string> = {
    LESSON: "Cours",
    EXERCISE: "Exercice",
    EXAM: "Examen",
    CORRECTION: "Correction",
    DOCUMENT: "Document",
    VIDEO: "Vidéo",
    AUDIO: "Audio",
    OTHER: "Autre",
  };
  return labels[type];
}

export function getResourceTypeIcon(type: ResourceType): string {
  const icons: Record<ResourceType, string> = {
    LESSON: "📚",
    EXERCISE: "✏️",
    EXAM: "📝",
    CORRECTION: "✅",
    DOCUMENT: "📄",
    VIDEO: "🎥",
    AUDIO: "🎵",
    OTHER: "📎",
  };
  return icons[type];
}
