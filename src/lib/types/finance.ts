import { PaymentMethod, PaymentStatus } from "@prisma/client";

// Fee Types
export interface Fee {
  id: string;
  schoolId: string;
  academicYearId: string | null;
  name: string;
  description: string | null;
  amount: number;
  classLevelCode: string | null;
  dueDate: Date | null;
  isRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  academicYear?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    payments: number;
    paymentPlans: number;
  };
}

// Payment Types
export interface Payment {
  id: string;
  studentId: string;
  feeId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  paidAt: Date | null;
  reconciledAt: Date | null;
  reconciledBy: string | null;
  receivedBy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
    matricule: string;
  };
  fee?: {
    id: string;
    name: string;
    amount: number;
  };
  receiver?: {
    firstName: string;
    lastName: string;
  } | null;
}

// Payment Plan Types
export interface PaymentPlan {
  id: string;
  studentId: string;
  feeId: string;
  totalAmount: number;
  installments: number;
  paidAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
    matricule: string;
  };
  fee?: {
    id: string;
    name: string;
    amount: number;
  };
  installmentPayments?: InstallmentPayment[];
  _count?: {
    installmentPayments: number;
  };
}

export interface InstallmentPayment {
  id: string;
  paymentPlanId: string;
  amount: number;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Scholarship Types
export interface Scholarship {
  id: string;
  studentId: string;
  name: string;
  type: string;
  amount: number;
  percentage: number | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
    matricule: string;
  };
}

// Financial Reports Types
export interface FinancialSummary {
  totalFees: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number;
  paymentsCount: number;
  studentsWithBalance: number;
}

export interface PaymentsByMethod {
  method: PaymentMethod;
  total: number;
  count: number;
  percentage: number;
}

export interface PaymentsByPeriod {
  period: string;
  total: number;
  count: number;
}

export interface PaymentsByStatus {
  status: PaymentStatus;
  total: number;
  count: number;
  percentage: number;
}

export interface StudentFinancialStatus {
  studentId: string;
  studentName: string;
  matricule: string;
  totalFees: number;
  totalPaid: number;
  balance: number;
  overdueAmount: number;
  lastPaymentDate: Date | null;
  paymentStatus: "PAID" | "PARTIAL" | "OVERDUE" | "PENDING";
}

export interface FinancialReport {
  summary: FinancialSummary;
  paymentsByMethod: PaymentsByMethod[];
  paymentsByPeriod: PaymentsByPeriod[];
  paymentsByStatus: PaymentsByStatus[];
  topDebtors: StudentFinancialStatus[];
  recentPayments: Payment[];
}

// Payment Method Labels
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  MOBILE_MONEY_MTN: "Mobile Money MTN",
  MOBILE_MONEY_MOOV: "Mobile Money Moov",
  BANK_TRANSFER: "Virement bancaire",
  CHECK: "Chèque",
  OTHER: "Autre",
};

// Payment Status Labels
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  VERIFIED: "Vérifié",
  RECONCILED: "Réconcilié",
  CANCELLED: "Annulé",
};

// Scholarship Type Labels
export const SCHOLARSHIP_TYPE_LABELS: Record<string, string> = {
  MERIT: "Mérite académique",
  NEED_BASED: "Besoin financier",
  SPORTS: "Sportive",
  ACADEMIC: "Académique",
  OTHER: "Autre",
};

// Payment Status Colors
export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  VERIFIED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  RECONCILED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

// Format currency helper
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
};

// Calculate payment plan schedule
export const calculateInstallmentSchedule = (
  totalAmount: number,
  installments: number,
  firstDueDate: Date
): { amount: number; dueDate: Date }[] => {
  const installmentAmount = Math.round(totalAmount / installments);
  const schedule: { amount: number; dueDate: Date }[] = [];

  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(firstDueDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    // Last installment gets the remainder
    const amount = i === installments - 1
      ? totalAmount - (installmentAmount * (installments - 1))
      : installmentAmount;

    schedule.push({ amount, dueDate });
  }

  return schedule;
};
