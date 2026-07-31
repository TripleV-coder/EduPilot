export type {
  StudentTemplateContext,
  SubjectPerformanceContext,
  OrientationTemplateResult,
  RiskSummaryResult,
  ActionPlanTemplate,
  TemplateAlert,
} from "./types";

export { generateAppreciation } from "./appreciation";
export { generateRiskSummary } from "./risk-summary";
export { generateStudentAlerts, generateAtRiskAlerts } from "./alerts";
export { generateOrientationSynthesis } from "./orientation";
export { generateActionPlan } from "./action-plan";
export { generateChatFallback } from "./chat";
export { buildStudentTemplateContext } from "./context";
