import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";

// Types API
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Clés de cache par domaine
export const queryKeys = {
  // Auth
  session: ["session"] as const,

  // Users
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,

  // Students
  students: ["students"] as const,
  student: (id: string) => ["students", id] as const,
  studentGrades: (id: string) => ["students", id, "grades"] as const,
  studentAttendance: (id: string) => ["students", id, "attendance"] as const,
  studentAnalytics: (id: string) => ["students", id, "analytics"] as const,
  studentPredictions: (id: string) => ["students", id, "predictions"] as const,

  // Teachers
  teachers: ["teachers"] as const,
  teacher: (id: string) => ["teachers", id] as const,
  teacherClasses: (id: string) => ["teachers", id, "classes"] as const,

  // Classes
  classes: ["classes"] as const,
  class: (id: string) => ["classes", id] as const,
  classStudents: (id: string) => ["classes", id, "students"] as const,
  classSchedule: (id: string) => ["classes", id, "schedule"] as const,

  // Grades
  grades: ["grades"] as const,
  evaluations: ["evaluations"] as const,

  // Attendance
  attendance: ["attendance"] as const,
  attendanceStats: ["attendance", "stats"] as const,

  // Courses
  courses: ["courses"] as const,
  course: (id: string) => ["courses", id] as const,
  courseModules: (id: string) => ["courses", id, "modules"] as const,

  // Exams
  exams: ["exams"] as const,
  exam: (id: string) => ["exams", id] as const,

  // Appointments
  appointments: ["appointments"] as const,

  // Events
  events: ["events"] as const,

  // Resources
  resources: ["resources"] as const,

  // Analytics
  analytics: ["analytics"] as const,

  // AI
  aiPredictions: ["ai", "predictions"] as const,

  // Finance
  fees: {
    all: ["fees"] as const,
    list: (schoolId?: string, academicYearId?: string) =>
      ["fees", { schoolId, academicYearId }] as const,
    detail: (id: string) => ["fees", id] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: (filters?: any) => ["payments", "list", filters] as const,
    detail: (id: string) => ["payments", id] as const,
  },
  paymentPlans: {
    all: ["payment-plans"] as const,
    list: (studentId?: string, feeId?: string) =>
      ["payment-plans", { studentId, feeId }] as const,
    detail: (id: string) => ["payment-plans", id] as const,
  },
  scholarships: {
    all: ["scholarships"] as const,
    list: (studentId?: string) => ["scholarships", { studentId }] as const,
    detail: (id: string) => ["scholarships", id] as const,
  },
  finance: {
    all: ["finance"] as const,
    report: (schoolId: string, academicYearId?: string, startDate?: Date, endDate?: Date) =>
      ["finance", "report", { schoolId, academicYearId, startDate, endDate }] as const,
    dashboard: (schoolId: string, academicYearId?: string) =>
      ["finance", "dashboard", { schoolId, academicYearId }] as const,
    studentStatus: (studentId: string) => ["finance", "student-status", studentId] as const,
    studentsStatus: (schoolId: string, classId?: string) =>
      ["finance", "students-status", { schoolId, classId }] as const,
    reconciliation: (schoolId: string) =>
      ["finance", "reconciliation", schoolId] as const,
    export: (schoolId: string, format: string) =>
      ["finance", "export", { schoolId, format }] as const,
  },

  // Medical
  medicalRecords: ["medical-records"] as const,

  // Incidents
  incidents: ["incidents"] as const,

  // Orientation
  orientation: ["orientation"] as const,

  // Homework
  homework: ["homework"] as const,

  // Messages
  messages: ["messages"] as const,

  // Notifications
  notifications: ["notifications"] as const,
};

// Custom error class with additional context
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Fetch helper avec gestion d'erreurs améliorée
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = "Une erreur est survenue";
      let errorDetails: Record<string, unknown> | undefined;

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch {
        // Response wasn't JSON, use generic message
        errorMessage = `Erreur ${response.status}: ${response.statusText}`;
      }

      throw new ApiError(response.status, errorMessage, errorDetails);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Re-throw API errors as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or parsing errors
    if (error instanceof SyntaxError) {
      throw new ApiError(500, "Erreur lors de la lecture de la réponse", {
        originalError: error.message,
      });
    }

    // Generic error fallback
    throw new ApiError(
      500,
      "Une erreur réseau est survenue. Veuillez vérifier votre connexion.",
      {
        originalError: error instanceof Error ? error.message : "Unknown error",
      }
    );
  }
}

// Enhanced hook for GET requests with better error handling
export function useApiQuery<TData>(
  endpoint: string | null,
  queryKey?: readonly unknown[],
  options?: Omit<UseQueryOptions<TData, ApiError>, "queryKey" | "queryFn">
) {
  return useQuery<TData, ApiError>({
    queryKey: queryKey || [endpoint],
    queryFn: () => fetchApi<TData>(endpoint!),
    enabled: !!endpoint, // Don't fetch if endpoint is null
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (validation, auth, etc)
      if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      // Retry up to 3 times for 5xx errors or network issues
      return failureCount < 3;
    },
    ...options,
  });
}

// Hook pour les données paginées
export function usePaginatedQuery<TData>(
  endpoint: string,
  page: number = 1,
  pageSize: number = 50
) {
  return useQuery<PaginatedResponse<TData>>({
    queryKey: [endpoint, page, pageSize],
    queryFn: () =>
      fetchApi<PaginatedResponse<TData>>(
        `${endpoint}?page=${page}&pageSize=${pageSize}`
      ),
  });
}

// Enhanced hook for mutations with proper error handling
export function useApiMutation<TData, TVariables>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET" = "POST",
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: ApiError) => void;
    invalidateKeys?: (readonly unknown[])[];
  }
) {
  const queryClient = useQueryClient();

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: (variables: TVariables) =>
      fetchApi<TData>(endpoint, {
        method,
        body: JSON.stringify(variables),
      }),
    onSuccess: (data) => {
      // Invalidate relevant caches
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
}

// Optimized mutation hooks with automatic cache invalidation
export function useCreateMutation<TData, TVariables = TData>(
  endpoint: string,
  invalidateKey: readonly unknown[],
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: ApiError) => void;
  }
) {
  return useApiMutation<TData, TVariables>(endpoint, "POST", {
    invalidateKeys: [invalidateKey],
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

export function useUpdateMutation<TData, TVariables = TData>(
  endpoint: string,
  invalidateKey: readonly unknown[],
  options?: {
    onSuccess?: (data: TData) => void;
    onError?: (error: ApiError) => void;
  }
) {
  return useApiMutation<TData, TVariables>(endpoint, "PUT", {
    invalidateKeys: [invalidateKey],
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

export function useDeleteMutation(
  endpoint: string,
  invalidateKey: readonly unknown[],
  options?: {
    onSuccess?: () => void;
    onError?: (error: ApiError) => void;
  }
) {
  return useApiMutation<void, unknown>(endpoint, "DELETE", {
    invalidateKeys: [invalidateKey],
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
