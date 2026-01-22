"use client"

import { useQuery } from "@tanstack/react-query";
import { TeacherForm } from "@/components/forms/school/teacher-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const fetchTeacher = async (id: string) => {
    const res = await fetch(`/api/teachers/${id}`);
    if (!res.ok) {
        throw new Error("Impossible de charger l'enseignant");
    }
    return res.json();
}

export default function EditTeacherPage() {
    const params = useParams();
    const id = params.teacherId as string;

    const { data: teacher, isLoading, isError } = useQuery({
        queryKey: ["teacher", id],
        queryFn: () => fetchTeacher(id),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isError || !teacher) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-lg font-medium">Erreur lors du chargement</p>
                <Link href="/school/teachers">
                    <Button variant="outline">Retour à la liste</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <PageHeader heading="Modifier Enseignant" description={`Mise à jour du profil de ${teacher.user.firstName} ${teacher.user.lastName}`}>
                <Link href="/school/teachers">
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
                    <TeacherForm initialData={teacher} isEditing />
                </CardContent>
            </Card>
        </div>
    )
}
