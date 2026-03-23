/**
 * Types pour les certificats de scolarité
 */

export type CertificateType =
  | "ENROLLMENT"
  | "ATTENDANCE"
  | "CONDUCT"
  | "SUCCESS"
  | "CUSTOM";

export interface Certificate {
  id: string;
  studentId: string;
  type: CertificateType;
  academicYearId: string | null;
  reason: string | null;
  issuedById: string;
  issuedAt: string;
  validUntil: string | null;
  certificateNumber: string;
  pdfUrl: string | null;
  createdAt: string;
}

export function getCertificateTypeLabel(type: CertificateType): string {
  const labels: Record<CertificateType, string> = {
    ENROLLMENT: "Certificat de Scolarité",
    ATTENDANCE: "Certificat d'Assiduité",
    CONDUCT: "Certificat de Bonne Conduite",
    SUCCESS: "Certificat de Réussite",
    CUSTOM: "Certificat Personnalisé",
  };
  return labels[type];
}
