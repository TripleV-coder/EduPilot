"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { TeacherForm } from "@/components/forms/school/teacher-form"
import { Button } from "@/components/ui/button"

export default function NewTeacherPage() {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <PageHeader heading="Nouvel Enseignant" description="Ajouter un membre au corps enseignant">
                <Link href="/school/teachers">
                    <Button variant="ghost">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </Button>
                </Link>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Informations Personnelles</CardTitle>
                    <CardDescription>Remplissez les détails du nouvel enseignant.</CardDescription>
                </CardHeader>
                <CardContent>
                    <TeacherForm />
                </CardContent>
            </Card>
        </div>
    )
}
