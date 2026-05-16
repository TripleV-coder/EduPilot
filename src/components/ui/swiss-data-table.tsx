"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SwissColumn<T> = {
  key: keyof T;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "right" | "center";
  render?: (value: any, row: T) => React.ReactNode;
};

export type SwissDataTableProps<T> = {
  data: T[];
  columns: SwissColumn<T>[];
  className?: string;
  searchable?: boolean;
  itemsPerPage?: number;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
};

// Swiss Badge Component (Transparent with borders only)
export function SwissBadge({ 
  children, 
  variant = "default" 
}: { 
  children: React.ReactNode; 
  variant?: "success" | "danger" | "warning" | "inactive" | "default";
}) {
  const variantStyles = {
    success: "text-success border-success/30 bg-success/10",
    danger: "text-destructive border-destructive/30 bg-destructive/10",
    warning: "text-warning border-warning/30",
    inactive: "text-text-secondary border-border",
    default: "text-text-primary border-border",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-sm",
      variantStyles[variant]
    )}>
      {children}
    </span>
  );
}

// Swiss Stats Card (Monochrome KPI)
export function SwissStatCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn(
      "p-3 bg-[hsl(var(--surface-base))] border border-border rounded-sm",
      className
    )}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl font-semibold tracking-tight text-text-primary tabular-nums">
          {value}
        </div>
        {delta && (
          <span className={cn(
            "text-[11px] font-medium",
            deltaType === "positive" && "text-success",
            deltaType === "negative" && "text-destructive",
            deltaType === "neutral" && "text-text-secondary"
          )}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function SwissDataTable<T extends Record<string, any>>({
  data,
  columns,
  className,
  searchable = true,
  itemsPerPage = 10,
  loading = false,
  emptyMessage = "Aucune donnée disponible",
  onRowClick,
}: SwissDataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);

  // Filter & Sort
  const filteredData = useMemo(() => {
    let filtered = [...data];
    
    if (search) {
      filtered = filtered.filter((row) =>
        columns.some((col) => {
          const value = row[col.key];
          return value?.toString().toLowerCase().includes(search.toLowerCase());
        })
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, search, sortConfig, columns]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleSort = (key: keyof T) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  if (loading) {
    return (
      <div className={cn("w-full bg-[hsl(var(--surface-base))] border border-border rounded-sm", className)}>
        <div className="animate-pulse">
          {searchable && <div className="h-10 border-b border-border bg-muted/40" />}
          <div className="h-10 bg-muted/40 border-b border-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-border last:border-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-full bg-[hsl(var(--surface-base))] border border-border rounded-sm", className)}>
      {/* Search */}
      {searchable && (
        <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/40">
          <Search className="h-4 w-4 text-text-tertiary ml-2" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-secondary bg-muted/40",
                    col.sortable && "cursor-pointer hover:text-text-primary select-none",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className={cn(
                    "flex items-center gap-1",
                    col.align === "right" && "justify-end",
                    col.align === "center" && "justify-center"
                  )}>
                    {col.header}
                    {col.sortable && (
                      <div className="flex flex-col">
                        <ChevronUp className={cn(
                          "h-3 w-3 -mb-0.5",
                          sortConfig.key === col.key && sortConfig.direction === "asc"
                            ? "text-text-primary"
                            : "text-text-tertiary"
                        )} />
                        <ChevronDown className={cn(
                          "h-3 w-3",
                          sortConfig.key === col.key && sortConfig.direction === "desc"
                            ? "text-text-primary"
                            : "text-text-tertiary"
                        )} />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[13px] text-text-secondary">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/25"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn(
                        "px-3 py-2.5 text-text-primary",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center"
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key]?.toString()}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/40">
          <span className="text-[11px] text-text-secondary">
            {filteredData.length} résultat{filteredData.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-sm border border-border bg-[hsl(var(--surface-base))] text-text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:border-[hsl(var(--primary)/0.45)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] text-text-secondary px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-sm border border-border bg-[hsl(var(--surface-base))] text-text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:border-[hsl(var(--primary)/0.45)] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SwissDataTable;
