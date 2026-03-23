/**
 * Types pour les dossiers médicaux
 */

export interface Allergy {
  id: string;
  medicalRecordId: string;
  allergen: string;
  severity: string;
  reaction: string | null;
  treatment: string | null;
  createdAt: string;
}

export interface Vaccination {
  id: string;
  medicalRecordId: string;
  vaccineName: string;
  dateGiven: string;
  nextDueDate: string | null;
  administeredBy: string | null;
  batchNumber: string | null;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  medicalRecordId: string;
  name: string;
  relationship: string;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  studentId: string;
  bloodType: string | null;
  medicalHistory: string | null;
  medications: string[];
  conditions: string[];
  notes: string | null;
  allergies: Allergy[];
  vaccinations: Vaccination[];
  emergencyContacts: EmergencyContact[];
  createdAt: string;
  updatedAt: string;
}
