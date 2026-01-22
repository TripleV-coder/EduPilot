"use client";

import { useApiQuery, useApiMutation, queryKeys, fetchApi } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fee, Payment } from "@/lib/types/finance";
import { FeeInput, PaymentInput } from "@/lib/validations/finance";
import { toast } from "sonner";

// FEES
export function useFees(schoolId?: string) {
  return useApiQuery<Fee[]>(
    schoolId ? `/api/finance/fees?schoolId=${schoolId}` : `/api/finance/fees` // Helper allows omitting if handled by backend logic but better to be explicit
  );
}

export function useCreateFeeMutation() {
  return useApiMutation<Fee, FeeInput>(
    "/api/finance/fees",
    "POST",
    {
      invalidateKeys: [queryKeys.fees.all], // Need to ensure queryKeys includes fees
      onSuccess: () => toast.success("Frais créé avec succès"),
      onError: (err) => toast.error(err.message || "Erreur lors de la création du frais"),
    }
  );
}

// PAYMENTS
export function usePayments(filters?: Record<string, any>) {
  // Convert object filters to query string
  const queryString = filters
    ? "?" + new URLSearchParams(
      Object.entries(filters).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && v !== "") acc[k] = String(v);
        return acc;
      }, {} as Record<string, string>)
    ).toString()
    : "";

  return useApiQuery<{ data: Payment[]; meta: any }>(
    `/api/finance/payments${queryString}`
  );
}

export function useCreatePaymentMutation() {
  return useApiMutation<Payment, PaymentInput>(
    "/api/finance/payments",
    "POST",
    {
      invalidateKeys: [queryKeys.payments.all, financeKeys.stats()], // Invalidate stats too
      onSuccess: () => toast.success("Paiement enregistré avec succès"),
      onError: (err) => toast.error(err.message || "Erreur lors de l'enregistrement"),
    }
  );
}

// STATS
export function useFinanceDashboard(schoolId?: string) {
  const queryString = schoolId ? `?schoolId=${schoolId}` : "";
  return useApiQuery<any>(
    `/api/finance/stats${queryString}`
  );
}

export function useFinanceCharts() {
  return useApiQuery<any>(
    `/api/finance/stats`
  );
}

// ALIASES for Compatibility
export const useCreatePayment = useCreatePaymentMutation;

export function useUpdatePayment(id: string) {
  return useApiMutation<Payment, Partial<PaymentInput>>(
    `/api/finance/payments/${id}`,
    "PUT",
    {
      invalidateKeys: [queryKeys.payments.all, financeKeys.stats()],
      onSuccess: () => toast.success("Paiement mis à jour"),
      onError: (err) => toast.error(err.message || "Erreur mise à jour"),
    }
  );
}

export function useDeletePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi<void>(`/api/finance/payments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: financeKeys.stats() });
      toast.success("Paiement supprimé");
    },
    onError: () => toast.error("Erreur suppression"),
  });
}
export const useDeletePayment = useDeletePaymentMutation;

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId }: { paymentId: string }) =>
      fetchApi<any>(`/api/finance/payments/${paymentId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "VERIFIED" })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: financeKeys.stats() });
      toast.success("Paiement vérifié");
    },
    onError: () => toast.error("Erreur vérification"),
  });
}

export function useReconcilePayments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentIds }: { paymentIds: string[] }) =>
      fetchApi<any>(`/api/finance/payments/reconcile`, {
        method: "POST",
        body: JSON.stringify({ paymentIds })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: financeKeys.stats() });
      toast.success("Réconciliation réussie");
    },
    onError: () => toast.error("Erreur réconciliation"),
  });
}

// Ensure queryKeys has finance keys in use-api.ts or extend here
export const financeKeys = {
  all: ['finance'] as const,
  fees: () => [...financeKeys.all, 'fees'] as const,
  payments: (filters?: any) => [...financeKeys.all, 'payments', filters] as const,
  stats: () => [...financeKeys.all, 'stats'] as const,
};
