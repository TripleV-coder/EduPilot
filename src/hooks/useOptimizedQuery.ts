import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface UseOptimizedQueryOptions<T> extends Omit<UseQueryOptions<{ data: T[]; total: number }>, 'queryKey' | 'queryFn'> {
  pageSize?: number;
  enablePagination?: boolean;
  cacheTime?: number;
  staleTime?: number;
  onFilterChange?: (filters: Record<string, unknown>) => void;
}

export function useOptimizedQuery<T = unknown>(
  queryKey: string[],
  queryFn: (params: {
    page: number;
    limit: number;
    filters?: Record<string, unknown>;
  }) => Promise<{ data: T[]; total: number }>,
  options: UseOptimizedQueryOptions<T> = {}
) {
  const {
    pageSize = 20,
    enablePagination: _enablePagination = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 2 * 60 * 1000, // 2 minutes
    onFilterChange,
    ...queryOptions
  } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data with pagination and filtering
  const { data, isLoading, error, refetch, isFetching } = useQuery<{ data: T[]; total: number }>({
    queryKey: [
      ...queryKey,
      currentPage,
      pageSize,
      JSON.stringify(filters),
      searchQuery,
    ],
    queryFn: () =>
      queryFn({
        page: currentPage,
        limit: pageSize,
        filters: { ...filters, search: searchQuery },
      }),
    gcTime: cacheTime,
    staleTime: staleTime,
    ...queryOptions,
  });

  // Pagination helpers
  const pagination: PaginationParams = useMemo(() => {
    const total = data?.total || 0;
    return {
      page: currentPage,
      limit: pageSize,
      total,
      hasMore: currentPage * pageSize < total,
    };
  }, [data?.total, currentPage, pageSize]);

  // Filter handlers
  const updateFilter = useCallback(
    (key: string, value: unknown) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      setCurrentPage(1); // Reset to first page
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery("");
    setCurrentPage(1);
    onFilterChange?.({});
  }, [onFilterChange]);

  const updateSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  // Navigation
  const goToPage = useCallback((page: number) => {
    const maxPage = Math.ceil((data?.total || 1) / pageSize);
    setCurrentPage(Math.min(Math.max(1, page), maxPage));
  }, [data?.total, pageSize]);

  const nextPage = useCallback(() => {
    if (pagination.hasMore) {
      setCurrentPage((p) => p + 1);
    }
  }, [pagination.hasMore]);

  const previousPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  return {
    data: data?.data || [],
    isLoading,
    error,
    isFetching,
    refetch,
    pagination,
    filters,
    searchQuery,
    updateFilter,
    clearFilters,
    updateSearch,
    goToPage,
    nextPage,
    previousPage,
  };
}

export function useSavedFilters(key: string) {
  const [filters, setFilters] = useState<Record<string, unknown>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem(`filters_${key}`);
    return saved ? JSON.parse(saved) : {};
  });

  const updateFilter = (newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
    if (typeof window !== "undefined") {
      localStorage.setItem(`filters_${key}`, JSON.stringify(newFilters));
    }
  };

  const clearFilters = () => {
    setFilters({});
    if (typeof window !== "undefined") {
      localStorage.removeItem(`filters_${key}`);
    }
  };

  return { filters, updateFilter, clearFilters };
}
