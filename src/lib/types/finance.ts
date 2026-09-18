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

// Format currency helper
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
};
