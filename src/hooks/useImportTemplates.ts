"use client";

import { useApiQuery, useApiMutation, fetchApi, ApiError } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface ImportTemplate {
    id: string;
    schoolId: string;
    name: string;
    type: "TEACHER" | "STUDENT" | "CLASS" | "PARENT";
    mappings: Record<string, string>;
    settings?: any;
    isDefault: boolean;
    createdById: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTemplateInput {
    name: string;
    type: "TEACHER" | "STUDENT" | "CLASS" | "PARENT";
    mappings: Record<string, string>;
}

export interface UpdateTemplateInput {
    name?: string;
    mappings?: Record<string, string>;
}

// Query keys
export const templateKeys = {
    all: ["import-templates"] as const,
    byType: (type: string) => [...templateKeys.all, type] as const,
    detail: (id: string) => [...templateKeys.all, id] as const,
};

// Hooks
export function useTemplates(type?: string) {
    const url = type ? `/api/import/templates?type=${type}` : "/api/import/templates";
    return useApiQuery<ImportTemplate[]>(url);
}

export function useTemplate(id: string) {
    return useApiQuery<ImportTemplate>(`/api/import/templates/${id}`);
}

export function useCreateTemplate() {
    return useApiMutation<ImportTemplate, CreateTemplateInput>(
        "/api/import/templates",
        "POST",
        {
            invalidateKeys: [templateKeys.all],
            onSuccess: () => toast.success("Template sauvegardé"),
            onError: (err) => toast.error(err.message || "Erreur lors de la sauvegarde"),
        }
    );
}

export function useUpdateTemplate(id: string) {
    return useApiMutation<ImportTemplate, UpdateTemplateInput>(
        `/api/import/templates/${id}`,
        "PUT",
        {
            invalidateKeys: [templateKeys.all, templateKeys.detail(id)],
            onSuccess: () => toast.success("Template mis à jour"),
            onError: (err) => toast.error(err.message || "Erreur lors de la mise à jour"),
        }
    );
}

export function useDeleteTemplate() {
    const queryClient = useQueryClient();

    return useMutation<void, ApiError, string>({
        mutationFn: (id: string) =>
            fetchApi<void>(`/api/import/templates/${id}`, {
                method: "DELETE",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: templateKeys.all });
            toast.success("Template supprimé");
        },
        onError: (err) => {
            toast.error(err.message || "Erreur lors de la suppression");
        },
    });
}
