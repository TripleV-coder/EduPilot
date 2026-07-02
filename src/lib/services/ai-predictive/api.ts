/**
 * Façade API pour le moteur prédictif déterministe (couche 1).
 * Utilisée par les routes /api/ai/predictions/*.
 */

import {
  generateStudentPredictions,
  generateClassPredictions,
  type StudentPrediction,
  type ClassPrediction,
} from "./index";

export interface PredictiveApiMeta {
  engine: "deterministic";
  source: "ai-predictive";
  cloudRequired: false;
}

export interface StudentPredictionResponse {
  success: true;
  data: StudentPrediction;
  meta: PredictiveApiMeta;
}

export interface ClassPredictionResponse {
  success: true;
  data: ClassPrediction;
  meta: PredictiveApiMeta;
}

const META: PredictiveApiMeta = {
  engine: "deterministic",
  source: "ai-predictive",
  cloudRequired: false,
};

export async function getStudentPredictions(studentId: string): Promise<StudentPredictionResponse> {
  const data = await generateStudentPredictions(studentId);
  return { success: true, data, meta: META };
}

export async function getClassPredictions(classId: string): Promise<ClassPredictionResponse> {
  const data = await generateClassPredictions(classId);
  return { success: true, data, meta: META };
}
