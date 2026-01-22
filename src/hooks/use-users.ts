import { useQueryClient, useMutation } from "@tanstack/react-query";
import { fetchApi, queryKeys, useApiQuery } from "./use-api";
import { UserRole } from "@prisma/client";

interface UseUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    schoolId?: string;
}

export function useUsers(params: UseUsersParams = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.role) queryParams.append("role", params.role);
    if (params.schoolId) queryParams.append("schoolId", params.schoolId);

    return useApiQuery<any>(`/api/users?${queryParams.toString()}`);
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => fetchApi(`/api/users/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.users });
        }
    });
}
