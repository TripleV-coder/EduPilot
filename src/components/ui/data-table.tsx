"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { Search, Settings2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchKey?: string
    searchPlaceholder?: string
    pageSizeOptions?: number[]
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchKey,
    searchPlaceholder = "Filtrer...",
    pageSizeOptions = [10, 25, 50, 100],
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    // Memoize table configuration to avoid recreating on every render
    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table API returns unstable refs by design
    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    })

    const pageCount = table.getPageCount()
    const currentPage = table.getState().pagination.pageIndex + 1

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages: (number | "ellipsis")[] = []
        const maxVisible = 5

        if (pageCount <= maxVisible) {
            for (let i = 1; i <= pageCount; i++) {
                pages.push(i)
            }
        } else {
            // Always show first page
            pages.push(1)

            if (currentPage > 3) {
                pages.push("ellipsis")
            }

            // Show pages around current
            const start = Math.max(2, currentPage - 1)
            const end = Math.min(pageCount - 1, currentPage + 1)

            for (let i = start; i <= end; i++) {
                pages.push(i)
            }

            if (currentPage < pageCount - 2) {
                pages.push("ellipsis")
            }

            // Always show last page
            if (pageCount > 1) {
                pages.push(pageCount)
            }
        }

        return pages
    }

    return (
        <div className="w-full space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {searchKey && (
                    <div className="flex items-center w-full sm:w-auto relative">
                        <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
                            onChange={(event) =>
                                table.getColumn(searchKey)?.setFilterValue(event.target.value)
                            }
                            className="w-full sm:w-[300px] pl-9"
                        />
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground cursor-not-allowed opacity-50" />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-background/50 backdrop-blur-sm overflow-x-auto">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="whitespace-nowrap">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Aucun résultat.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
                {/* Left: Selection info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                        {table.getFilteredSelectedRowModel().rows.length} sur{" "}
                        {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s)
                    </span>
                </div>

                {/* Center/Right: Pagination controls */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Page size selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            Lignes par page
                        </span>
                        <Select
                            value={String(table.getState().pagination.pageSize)}
                            onValueChange={(value: string) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={String(table.getState().pagination.pageSize)} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {pageSizeOptions.map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Page info */}
                    <div className="text-sm text-muted-foreground">
                        Page {currentPage} sur {pageCount || 1}
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-1">
                        {/* First page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                            aria-label="Première page"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>

                        {/* Previous page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            aria-label="Page précédente"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {/* Page numbers */}
                        <div className="hidden sm:flex items-center gap-1">
                            {getPageNumbers().map((page, index) => (
                                page === "ellipsis" ? (
                                    <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                                        ...
                                    </span>
                                ) : (
                                    <Button
                                        key={page}
                                        variant={currentPage === page ? "default" : "outline"}
                                        size="icon"
                                        className={cn(
                                            "h-8 w-8",
                                            currentPage === page && "pointer-events-none"
                                        )}
                                        onClick={() => table.setPageIndex(page - 1)}
                                    >
                                        {page}
                                    </Button>
                                )
                            ))}
                        </div>

                        {/* Next page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            aria-label="Page suivante"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>

                        {/* Last page */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => table.setPageIndex(pageCount - 1)}
                            disabled={!table.getCanNextPage()}
                            aria-label="Dernière page"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
