"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { BookOpen, Users, AlertCircle, Plus, Trash2, UploadCloud, ArrowUpDown, Eye, LayoutGrid, TableProperties } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { PageCallout } from "@/components/layout/page-callout";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { t } from "@/lib/i18n";

type ClassItem = {
    id: string;
    name: string;
    classLevel?: { id: string; name: string; level: string; sequence: number };
    _count?: { enrollments: number; classSubjects: number };
};

const CYCLE_LABELS: Record<string, string> = {
    PRIMARY: "Primaire",
    SECONDARY_COLLEGE: "Collège (1er Cycle)",
    SECONDARY_LYCEE: "Lycée (2nd Cycle)",
    MIXED: "Mixte",
};

const CYCLE_COLORS: Record<string, string> = {
    PRIMARY: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    SECONDARY_COLLEGE: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    SECONDARY_LYCEE: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    MIXED: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

const CYCLE_FILTERS = [
    { value: "ALL", label: "Tous" },
    { value: "PRIMARY", label: "Primaire" },
    { value: "SECONDARY_COLLEGE", label: "Collège" },
    { value: "SECONDARY_LYCEE", label: "Lycée" },
] as const;

export default function ClassesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [selectedCycle, setSelectedCycle] = useState<string>("ALL");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set("search", debouncedSearch);

    const { data: response, error, isLoading: loading } = useSWR<any>(`/api/classes?${queryParams.toString()}`, fetcher);
    const { mutate } = useSWRConfig();
    const { toast } = useToast();

    const allClasses: ClassItem[] = response?.data || response?.classes || (Array.isArray(response) ? response : []);

    // Filter by cycle
    const classes = useMemo(() => {
        if (selectedCycle === "ALL") return allClasses;
        return allClasses.filter((cls) => cls.classLevel?.level === selectedCycle);
    }, [allClasses, selectedCycle]);

    // Count per cycle for badges
    const cycleCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: allClasses.length };
        allClasses.forEach((cls) => {
            const level = cls.classLevel?.level || "UNKNOWN";
            counts[level] = (counts[level] || 0) + 1;
        });
        return counts;
    }, [allClasses]);

    const handleExportCSV = () => {
        if (!classes || classes.length === 0) {
            toast({ title: "Export impossible", description: "Aucune donnée à exporter.", variant: "destructive" });
            return;
        }
        const headers = ["Nom de la classe", "Niveau", "Cycle", "Nombre d'élèves"];
        const rows = classes.map(cls => [
            cls.name || "",
            cls.classLevel?.name || "",
            CYCLE_LABELS[cls.classLevel?.level || ""] || "",
            (cls._count?.enrollments ?? 0).toString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `classes_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const requestDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        setPendingDelete({ id, name });
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/classes/${pendingDelete.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            toast({ title: "Succès", description: "La classe a été supprimée." });
            setDeleteDialogOpen(false);
            setPendingDelete(null);
            mutate(`/api/classes?${queryParams.toString()}`);
        } catch (err: any) {
            toast({ title: "Erreur", description: err.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const CycleBadge = ({ level }: { level?: string }) => {
        if (!level) return null;
        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${CYCLE_COLORS[level] || "bg-muted text-muted-foreground"}`}>
                {CYCLE_LABELS[level] || level}
            </span>
        );
    };

    const classColumns: ColumnDef<ClassItem>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Nom <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        {
            id: "level",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Niveau <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.classLevel?.name || "—",
        },
        {
            id: "cycle",
            header: "Cycle",
            cell: ({ row }) => <CycleBadge level={row.original.classLevel?.level} />,
        },
        {
            id: "students",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Élèves <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row._count?.enrollments ?? 0,
            cell: ({ row }) => (
                <span className="inline-flex items-center gap-1 text-sm">
                    <Users className="h-3 w-3" /> {row.original._count?.enrollments ?? 0}
                </span>
            ),
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/classes/${row.original.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => requestDelete(e, row.original.id, row.original.name)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <PageGuard permission={Permission.CLASS_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Classes"
                        description="Gestion des classes de l'établissement"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Classes" },
                        ]}
                    />
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center border rounded-lg overflow-hidden">
                            <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode("grid")}>
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" className="h-9 w-9 rounded-none" onClick={() => setViewMode("table")}>
                                <TableProperties className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button variant="outline" className="gap-2 shadow-sm" onClick={handleExportCSV}>
                            <UploadCloud className="h-4 w-4" />
                            {t("common.exportCsv")}
                        </Button>
                        <Link href="/dashboard/classes/new">
                            <Button className="gap-2 shadow-sm">
                                <Plus className="h-4 w-4" />
                                Ajouter une classe
                            </Button>
                        </Link>
                    </div>
                </div>

                <Card className="border-border shadow-sm">
                    <div className="p-4 flex flex-col sm:flex-row items-center gap-4 bg-muted/20">
                        <div className="relative flex-1 w-full sm:max-w-md">
                            <Input
                                
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-background"
                            />
                        </div>
                        {/* Cycle filter tabs */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {CYCLE_FILTERS.map((cycle) => (
                                <button
                                    key={cycle.value}
                                    onClick={() => setSelectedCycle(cycle.value)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                        selectedCycle === cycle.value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted text-muted-foreground hover:bg-card/80 border border-border"
                                    }`}
                                >
                                    {cycle.label}
                                    {cycleCounts[cycle.value] !== undefined && (
                                        <span className="ml-1.5 opacity-70">({cycleCounts[cycle.value]})</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error.message || "Erreur de chargement des classes"}</p>
                    </div>
                )}

                {!loading && !error && classes.length === 0 && (
                    <PageCallout
                        icon={BookOpen}
                        title={
                            selectedCycle !== "ALL"
                                ? `Aucune classe en ${CYCLE_LABELS[selectedCycle] || selectedCycle}`
                                : "Aucune classe enregistrée"
                        }
                        description="Créez vos classes pour pouvoir inscrire des élèves, planifier l’emploi du temps et saisir des notes."
                        actions={[{ label: "Ajouter une classe", href: "/dashboard/classes/new" }]}
                    />
                )}

                {!loading && !error && classes.length > 0 && viewMode === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {classes.map((cls) => (
                            <Link href={`/dashboard/classes/${cls.id}`} key={cls.id}>
                                <Card className="border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 h-full cursor-pointer group flex flex-col">
                                    <CardHeader className="flex flex-row items-center gap-3 pb-2">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0 group-hover:scale-110 transition-transform">
                                            <BookOpen className="h-5 w-5" />
                                        </div>
                                        <div className="overflow-hidden flex-1">
                                            <CardTitle className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{cls.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground truncate">{cls.classLevel?.name ?? "—"}</p>
                                        </div>
                                        <div className="ml-auto">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => requestDelete(e, cls.id, cls.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0 flex-1 flex flex-col justify-end mt-2">
                                        <div className="flex items-center justify-between border-t border-border pt-2">
                                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                                <Users className="h-3 w-3" /> {cls._count?.enrollments ?? 0} élèves
                                            </span>
                                            <CycleBadge level={cls.classLevel?.level} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}

        {!loading && !error && classes.length > 0 && viewMode === "table" && (
                    <DataTable columns={classColumns} data={classes} />
                )}

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setPendingDelete(null);
                }}
                title={pendingDelete ? `Supprimer la classe ${pendingDelete.name} ?` : "Supprimer cette classe ?"}
                description="Cette action est définitive. Les inscriptions et emplois du temps liés peuvent être impactés."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleting}
                onConfirm={confirmDelete}
            />
            </div>
        </PageGuard>
    );
}
