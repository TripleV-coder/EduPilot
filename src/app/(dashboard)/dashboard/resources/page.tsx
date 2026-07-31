"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Badge, Button, Card, Icon, Input, type IconName } from "@/components/edu";
import { fetcher } from "@/lib/fetcher";
import { formatDateShort, formatFileSize } from "@/lib/utils/formatters";

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

function resourceIcon(type: string): IconName {
    switch (type) {
        case "EXAM":
            return "warning";
        case "EXERCISE":
            return "pencil";
        default:
            return "cards";
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

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, typeFilter]);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (typeFilter) params.set("type", typeFilter);

    const { data, error, isLoading, mutate } = useSWR(
        `/api/resources?${params.toString()}`,
        fetcher
    );

    const resources = data?.resources ?? [];
    const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0 };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT"]}>
            <PageShell className="max-w-6xl">
                <PageHeader
                    title="Ressources pédagogiques"
                    description="Banque de documents, vidéos et supports de cours"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Ressources numériques" },
                    ]}
                    actions={
                        <Button variant="primary" size="sm" icon="plus">
                            Ajouter une ressource
                        </Button>
                    }
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                        <Input
                            aria-label="Rechercher une ressource"
                            icon="search"
                            placeholder="Rechercher un titre, une matière ou un niveau…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        aria-label="Filtrer les ressources par type"
                        className="edu-field h-10 w-full sm:w-48"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        {RESOURCE_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                {isLoading ? <PageLoading label="Chargement des ressources…" /> : null}
                {error ? (
                    <PageError
                        message={error.message || "Impossible de charger les ressources"}
                        onRetry={() => void mutate()}
                    />
                ) : null}

                {!isLoading && !error && resources.length === 0 ? (
                    <PageEmpty
                        icon="cards"
                        title="Aucune ressource disponible"
                        description="Ajoutez des cours, exercices, corrigés ou médias pour alimenter la bibliothèque."
                        actions={[{ label: "Ajouter une ressource", href: "/dashboard/resources" }]}
                    />
                ) : null}

                {!isLoading && !error && resources.length > 0 ? (
                    <>
                        <div className="edu-stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {resources.map((resource: {
                                id: string;
                                title: string;
                                type: string;
                                createdAt: string;
                                fileSize?: number;
                                fileUrl: string;
                                subject?: { name: string };
                                classLevel?: { name: string };
                            }) => (
                                <Card key={resource.id} padding={16} interactive>
                                    <div className="flex flex-col items-center text-center">
                                        <div
                                            className="mb-3 grid h-14 w-14 place-items-center rounded-full"
                                            style={{ background: "var(--eduflow-surface-sunken)" }}
                                        >
                                            <Icon name={resourceIcon(resource.type)} size={24} color="var(--brand-600)" />
                                        </div>
                                        <h3
                                            className="line-clamp-2 text-sm font-semibold"
                                            title={resource.title}
                                            style={{ color: "var(--eduflow-text-primary)" }}
                                        >
                                            {resource.title}
                                        </h3>
                                        <div className="mt-2 flex flex-wrap justify-center gap-1">
                                            {resource.subject?.name ? (
                                                <Badge variant="brand" size="sm">
                                                    {resource.subject.name}
                                                </Badge>
                                            ) : null}
                                            {resource.classLevel?.name ? (
                                                <Badge variant="neutral" size="sm">
                                                    {resource.classLevel.name}
                                                </Badge>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div
                                        className="mt-4 flex items-center justify-between border-t pt-3 text-xs"
                                        style={{
                                            borderColor: "var(--eduflow-border-subtle)",
                                            color: "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        <span>
                                            {formatDateShort(resource.createdAt)}
                                            {resource.fileSize ? ` · ${formatFileSize(resource.fileSize)}` : ""}
                                        </span>
                                        <a
                                            href={resource.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                            aria-label={`Télécharger ${resource.title}`}
                                        >
                                            <Button variant="ghost" size="sm" icon="download" aria-label="Télécharger" />
                                        </a>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {pagination.totalPages > 1 ? (
                            <div className="flex items-center justify-center gap-3">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((current) => current - 1)}
                                >
                                    Précédent
                                </Button>
                                <span className="text-sm" style={{ color: "var(--eduflow-text-secondary)" }}>
                                    Page {pagination.page} / {pagination.totalPages}
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => setPage((current) => current + 1)}
                                >
                                    Suivant
                                </Button>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}
