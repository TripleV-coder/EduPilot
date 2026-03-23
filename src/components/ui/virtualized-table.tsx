"use client";

import { useMemo, useCallback } from "react";
import { List } from "react-window";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface VirtualizedTableProps<T> {
  data: T[];
  columns: {
    header: string;
    accessor: (row: T) => React.ReactNode;
    width?: number;
  }[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
}

/**
 * Virtualized table component for large lists
 * Only renders visible rows, dramatically improving performance for 100+ items
 */
export function VirtualizedTable<T extends { id: string }>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = 600,
  className,
}: VirtualizedTableProps<T>) {
  const _totalWidth = useMemo(
    () => columns.reduce((sum, col) => sum + (col.width || 200), 0),
    [columns]
  );

  const Row = useCallback(
    ({
      index,
      style,
    }: {
      index: number;
      style: React.CSSProperties;
      ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
    }) => {
      const row = data[index];
      if (!row) return null;

      return (
        <div style={style}>
          <TableRow className="h-full">
            {columns.map((column, colIndex) => (
              <TableCell
                key={colIndex}
                style={{ width: column.width || 200 }}
                className="h-full"
              >
                {column.accessor(row)}
              </TableCell>
            ))}
          </TableRow>
        </div>
      );
    },
    [data, columns]
  );

  if (data.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        Aucun résultat
      </div>
    );
  }

  const listHeight = Math.min(maxHeight, Math.max(rowHeight, data.length * rowHeight));

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  style={{ width: column.width || 200 }}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <div style={{ height: listHeight, width: "100%" }}>
          <List
            rowComponent={Row}
            rowCount={data.length}
            rowHeight={rowHeight}
            rowProps={{}}
            style={{ height: listHeight, width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
