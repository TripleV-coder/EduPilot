"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { StudentForm } from "@/components/forms/school/student-form"
import { Button } from "@/components/ui/button"

export default function NewStudentPage() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            <PageHeader heading="Nouvel Élève" description="Inscrire un nouvel élève">
                <Link href="/school/students">
                    <Button variant="ghost">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </Button>
                </Link>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Format Complet</CardTitle>
                        <CardDescription>Remplissez tous les champs requis.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StudentForm />
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <div className="bg-muted/50 p-4 rounded-lg border">
                        <h3 className="font-semibold mb-2">Instructions</h3>
                        <p className="text-sm text-muted-foreground">
                            Le matricule est unique à chaque élève. Assurez-vous d&apos;avoir sélectionné la bonne classe et année scolaire.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
