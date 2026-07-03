"use client";

import * as React from "react";
import { Button } from "@/components/edu";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
    id: string;
    header: React.ReactNode;
    cell: (row: T) => React.ReactNode;
    scope?: "col" | "row";
};

export type DataTableProps<T> = {
    caption?: string;
    columns: DataTableColumn<T>[];
    data: T[];
    getRowKey: (row: T) => string;
    className?: string;
    page?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    emptyMessage?: string;
};

export function DataTable<T>({
    caption,
    columns,
    data,
    getRowKey,
    className,
    page,
    totalPages,
    onPageChange,
    emptyMessage = "Aucune donnée à afficher.",
}: DataTableProps<T>) {
    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div
                className="overflow-x-auto rounded-card border"
                style={{
                    borderColor: "var(--eduflow-border-subtle)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    {caption ? <caption className="sr-only">{caption}</caption> : null}
                    <thead>
                        <tr
                            style={{
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                                background: "var(--eduflow-surface-sunken)",
                            }}
                        >
                            {columns.map((column) => (
                                <th
                                    key={column.id}
                                    scope={column.scope ?? "col"}
                                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-12 text-center text-sm"
                                    style={{ color: "var(--eduflow-text-secondary)" }}
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((row) => (
                                <tr
                                    key={getRowKey(row)}
                                    className="transition-colors hover:bg-[var(--eduflow-surface-sunken)]"
                                    style={{
                                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
                                    {columns.map((column) => (
                                        <td
                                            key={column.id}
                                            className="px-4 py-3 align-top"
                                            style={{ color: "var(--eduflow-text-primary)" }}
                                        >
                                            {column.cell(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {page != null && totalPages != null && totalPages > 1 && onPageChange ? (
                <div className="flex items-center justify-center gap-3">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                    >
                        Précédent
                    </Button>
                    <span className="text-sm" style={{ color: "var(--eduflow-text-secondary)" }}>
                        Page {page} / {totalPages}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => onPageChange(page + 1)}
                    >
                        Suivant
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
