"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns } from "./columns";
import { PageHeader } from "@/components/layout/page-header";
import { FileUp, Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTeachers } from "@/hooks/use-teachers";

export default function TeachersPage() {
    const { data, isLoading, isError, error } = useTeachers();

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-destructive">
                <AlertCircle className="h-8 w-8" />
                <p>Erreur lors du chargement des données</p>
                <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Erreur inconnue"}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                heading="Enseignants"
                description="Gérez le corps enseignant de votre établissement."
            >
                <Link href="/school/onboarding">
                    <Button variant="outline">
                        <FileUp className="mr-2 h-4 w-4" />
                        Importer
                    </Button>
                </Link>
                <Link href="/school/teachers/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter
                    </Button>
                </Link>
            </PageHeader>

            <DataTable
                columns={columns}
                data={data?.data || []}
                searchKey="user.lastName"
                searchPlaceholder="Rechercher par nom..."
            />
        </div>
    );
}
