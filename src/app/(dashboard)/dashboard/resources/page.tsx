"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Folder, UploadCloud, FileText, Video, Link as LinkIcon, Download, MoreVertical, Search, Plus, Loader2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageCallout } from "@/components/layout/page-callout";

const RESOURCE_TYPES = [
    { value: "", label: "Tous les types" },
    { value: "LESSON", label: "Cours" },
    { value: "EXERCISE", label: "Exercice" },
    { value: "EXAM", label: "Examen" },
    { value: "CORRECTION", label: "Correction" },
    { value: "DOCUMENT", label: "Document" },
    { value: "VIDEO", label: "Vidéo" },
    { value: "AUDIO", label: "Audio" },
    { value: "OTHER", label: "Autre" },
] as const;

function formatFileSize(bytes: number | null): string {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function getIcon(type: string) {
    switch (type) {
        case "LESSON":
        case "DOCUMENT":
            return <FileText className="w-8 h-8 text-blue-500" />;
        case "VIDEO":
            return <Video className="w-8 h-8 text-purple-500" />;
        case "EXAM":
            return <FileText className="w-8 h-8 text-red-500" />;
        case "EXERCISE":
            return <FileText className="w-8 h-8 text-orange-500" />;
        case "CORRECTION":
            return <FileText className="w-8 h-8 text-green-500" />;
        case "AUDIO":
            return <Music className="w-8 h-8 text-teal-500" />;
        default:
            return <FileText className="w-8 h-8 text-gray-500" />;
    }
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

export default function ResourcesPage() {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [page, setPage] = useState(1);
    const limit = 20;

    const debouncedSearch = useDebounce(search, 400);

    // Reset page when filters change
    useEffect(() => {
        queueMicrotask(() => setPage(1));
    }, [debouncedSearch, typeFilter]);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter) params.set("type", typeFilter);

    const { data, isLoading } = useSWR(`/api/resources?${params.toString()}`, fetcher);

    const resources = data?.resources ?? [];
    const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT"]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Ressources Pédagogiques"
                        description="Banque de documents, vidéos et supports de cours"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Ressources numériques" },
                        ]}
                    />
                    <div className="flex gap-3">
                        <Button className="gap-2 shadow-sm">
                            <UploadCloud className="w-4 h-4" />
                            Ajouter une ressource
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            
                            className="pl-9 bg-muted/50 border-border"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        {RESOURCE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                    <Button variant="outline" className="gap-2">
                        <Folder className="w-4 h-4" />
                        Gérer les dossiers
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : resources.length === 0 ? (
                    <PageCallout
                        icon={FileText}
                        title="Aucune ressource disponible"
                        description="Ajoutez des cours, exercices, corrigés, documents ou médias pour alimenter la bibliothèque pédagogique."
                        actions={[{ label: "Ajouter une ressource", href: "/dashboard/resources", variant: "outline" }]}
                    />
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {resources.map((res: any) => (
                                <Card key={res.id} className="border-border shadow-sm hover:shadow-md transition-shadow group">
                                    <CardContent className="p-4 relative">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>

                                        <div className="flex flex-col items-center text-center mt-2 mb-4">
                                            <div className="p-3 bg-muted/30 rounded-full mb-3">
                                                {getIcon(res.type)}
                                            </div>
                                            <h3 className="font-semibold text-foreground line-clamp-2" title={res.title}>{res.title}</h3>
                                            <div className="mt-2 flex flex-wrap justify-center gap-1">
                                                {res.subject?.name && (
                                                    <Badge variant="secondary" className="text-[10px] font-normal">{res.subject.name}</Badge>
                                                )}
                                                {res.classLevel?.name && (
                                                    <Badge variant="outline" className="text-[10px] font-normal">{res.classLevel.name}</Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                                            <span>{formatDate(res.createdAt)} • {formatFileSize(res.fileSize)}</span>
                                            <a href={res.fileUrl} target="_blank" rel="noopener noreferrer" download>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </a>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <Card className="border-border border-dashed shadow-none hover:bg-muted/5 transition-colors cursor-pointer bg-muted/10">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[220px] text-center">
                                    <div className="p-3 bg-background rounded-full mb-3 shadow-sm border border-border">
                                        <Plus className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-medium text-foreground">Nouvelle ressource</h3>
                                    <p className="text-xs text-muted-foreground mt-1 px-4">Glissez-déposez un fichier ici ou cliquez pour parcourir.</p>
                                </CardContent>
                            </Card>
                        </div>

                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    Précédent
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    Page {pagination.page} / {pagination.totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Suivant
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </PageGuard>
    );
}
