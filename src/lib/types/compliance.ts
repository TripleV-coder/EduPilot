/**
 * Types pour la conformité RGPD
 */

export type DataAccessType = "EXPORT" | "RECTIFICATION" | "DELETION" | "PORTABILITY";

export type DataAccessStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

export interface DataAccessRequest {
  id: string;
  userId: string;
  requestType: DataAccessType;
  status: DataAccessStatus;
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  notes: string | null;
  processedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DataConsent {
  id: string;
  userId: string;
  consentType: string;
  isGranted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceDashboard {
  summary: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    complianceScore: number;
    lastAuditDate: string | null;
  };
  dataRequests: {
    pending: number;
    recent: DataAccessRequest[];
  };
  auditLogs: {
    last7Days: number;
    recentLogins: number;
    byAction: Array<{ action: string; _count: number }>;
  };
  consents: {
    statistics: Record<string, { granted: number; denied: number }>;
    totalTypes: number;
  };
  dataManagement: {
    retentionPolicies: number;
    deletedAccountsLast30Days: number;
  };
  alerts: Array<{
    level: "warning" | "error" | "info";
    message: string;
    action: string;
  }>;
}

export function getDataAccessTypeLabel(type: DataAccessType): string {
  const labels: Record<DataAccessType, string> = {
    EXPORT: "Export de Données",
    RECTIFICATION: "Rectification",
    DELETION: "Suppression",
    PORTABILITY: "Portabilité",
  };
  return labels[type];
}

export function getDataAccessStatusLabel(status: DataAccessStatus): string {
  const labels: Record<DataAccessStatus, string> = {
    PENDING: "En Attente",
    IN_PROGRESS: "En Cours",
    COMPLETED: "Terminé",
    REJECTED: "Rejeté",
  };
  return labels[status];
}

export function getDataAccessStatusColor(status: DataAccessStatus): string {
  const colors: Record<DataAccessStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    REJECTED: "bg-red-100 text-red-700",
  };
  return colors[status];
}
