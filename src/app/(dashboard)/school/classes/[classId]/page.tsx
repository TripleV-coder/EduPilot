"use client"

import { useQuery } from "@tanstack/react-query";
import { ClassForm } from "@/components/forms/school/class-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const fetchClass = async (id: string) => {
    const res = await fetch(`/api/classes/${id}`);
    if (!res.ok) {
        throw new Error("Impossible de charger la classe");
    }
    return res.json();
}

export default function EditClassPage() {
    const params = useParams();
    const id = params.classId as string;

    const { data: classData, isLoading, isError } = useQuery({
        queryKey: ["class", id],
        queryFn: () => fetchClass(id),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isError || !classData) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-lg font-medium">Erreur lors du chargement</p>
                <Link href="/school/classes">
                    <Button variant="outline">Retour à la liste</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <PageHeader heading="Modifier Classe" description={`Mise à jour de ${classData.name}`}>
                <Link href="/school/classes">
                    <Button variant="ghost">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </Button>
                </Link>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Modification</CardTitle>
                </CardHeader>
                <CardContent>
                    <ClassForm initialData={classData} isEditing />
                </CardContent>
            </Card>
        </div>
    )
}
