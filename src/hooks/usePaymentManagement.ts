"use client";

import { useSession } from "next-auth/react";
import { useApiQuery, useApiMutation, queryKeys } from "./use-api";
import { toast } from "sonner";

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  feeId: string;
  feeName: string;
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  dueDate: string;
  paidDate?: string;
  status: "pending" | "partial" | "paid" | "overdue";
  method?: string;
  reference?: string;
}

export interface Fee {
  id: string;
  name: string;
  description?: string;
  amount: number;
  academicYear: string;
  dueDate: string;
  classLevel?: string;
}

export interface PaymentPlan {
  id: string;
  studentId: string;
  feeId: string;
  totalAmount: number;
  installments: Array<{
    id: string;
    number: number;
    amount: number;
    dueDate: string;
    paidDate?: string;
    status: "pending" | "paid";
  }>;
  status: "active" | "completed" | "defaulted";
}

// Parent Payment Hooks

export function useParentPayments() {
  const { data: session } = useSession();
  const parentId = session?.user?.id;

  return useApiQuery<any>(
    parentId ? `/api/payments?parentId=${parentId}` : null
  );
}

export function useParentPaymentStats() {
  const { data: session } = useSession();
  const parentId = session?.user?.id;

  return useApiQuery<any>(
    parentId ? `/api/payments/stats?parentId=${parentId}` : null
  );
}

export function usePaymentPlans() {
  const { data: session } = useSession();
  const parentId = session?.user?.id;

  return useApiQuery<any>(
    parentId ? `/api/payment-plans?parentId=${parentId}` : null
  );
}

export function useSchoolFees() {
  return useApiQuery<any>(`/api/fees`);
}

// School Admin Payment Hooks

export function useSchoolPayments() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/payments?schoolId=${session.user.schoolId}` : null
  );
}

export function useOverduePayments() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId
      ? `/api/payments?schoolId=${session.user.schoolId}&status=overdue`
      : null
  );
}

// Mutations

export function useCreatePaymentMutation() {
  return useApiMutation<any, any>(
    `/api/payments`,
    "POST",
    {
      invalidateKeys: [queryKeys.payments.all],
      onSuccess: () => {
        toast.success("Paiement enregistré avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

export function useProcessPaymentMutation() {
  return useApiMutation<any, any>(
    `/api/payments/process`,
    "POST",
    {
      invalidateKeys: [queryKeys.payments.all],
      onSuccess: () => {
        toast.success("Paiement traité avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

export function useCreatePaymentPlanMutation() {
  return useApiMutation<any, any>(
    `/api/payment-plans`,
    "POST",
    {
      invalidateKeys: [queryKeys.paymentPlans.all],
      onSuccess: () => {
        toast.success("Plan de paiement créé avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

// Combined hooks for pages

export function useParentPaymentDashboard() {
  const paymentsQuery = useParentPayments();
  const statsQuery = useParentPaymentStats();
  const plansQuery = usePaymentPlans();

  const isLoading =
    paymentsQuery.isPending ||
    statsQuery.isPending ||
    plansQuery.isPending;

  const error = paymentsQuery.error || statsQuery.error || plansQuery.error;
  const isError = !!error;

  const data =
    paymentsQuery.data && statsQuery.data && plansQuery.data
      ? {
          payments: paymentsQuery.data.payments || [],
          stats: {
            totalDue: statsQuery.data.totalDue || 0,
            totalPaid: statsQuery.data.totalPaid || 0,
            totalOverdue: statsQuery.data.totalOverdue || 0,
            completionRate: statsQuery.data.completionRate || 0,
          },
          plans: plansQuery.data.plans || [],
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}

export function useSchoolPaymentDashboard() {
  const paymentsQuery = useSchoolPayments();
  const overdueQuery = useOverduePayments();

  const isLoading = paymentsQuery.isPending || overdueQuery.isPending;
  const error = paymentsQuery.error || overdueQuery.error;
  const isError = !!error;

  const data =
    paymentsQuery.data && overdueQuery.data
      ? {
          allPayments: paymentsQuery.data.payments || [],
          overduePayments: overdueQuery.data.payments || [],
          stats: {
            totalCollected: paymentsQuery.data.totalCollected || 0,
            totalExpected: paymentsQuery.data.totalExpected || 0,
            pendingAmount: paymentsQuery.data.pendingAmount || 0,
            overdueAmount: overdueQuery.data.totalAmount || 0,
          },
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
