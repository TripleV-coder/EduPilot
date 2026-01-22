"use client"

import { useQuery } from "@tanstack/react-query";
import { StudentForm } from "@/components/forms/school/student-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const fetchStudent = async (id: string) => {
    const res = await fetch(`/api/students/${id}`);
    if (!res.ok) {
        throw new Error("Impossible de charger l'élève");
    }
    return res.json();
}

export default function EditStudentPage() {
    const params = useParams();
    const id = params.studentId as string;

    const { data: student, isLoading, isError } = useQuery({
        queryKey: ["student", id],
        queryFn: () => fetchStudent(id),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isError || !student) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="text-lg font-medium">Erreur lors du chargement</p>
                <Link href="/school/students">
                    <Button variant="outline">Retour à la liste</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <PageHeader heading="Modifier Élève" description={`Mise à jour du dossier de ${student.user.firstName} ${student.user.lastName}`}>
                <Link href="/school/students">
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
                    <StudentForm initialData={student} isEditing />
                </CardContent>
            </Card>
        </div>
    )
}
