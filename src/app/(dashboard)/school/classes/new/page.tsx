"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page-header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ClassForm } from "@/components/forms/school/class-form"
import { Button } from "@/components/ui/button"

export default function NewClassPage() {
    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <PageHeader heading="Nouvelle Classe" description="Créer une salle de classe">
                <Link href="/school/classes">
                    <Button variant="ghost">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </Button>
                </Link>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Détails de la classe</CardTitle>
                    <CardDescription>Configuration de la nouvelle classe.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ClassForm />
                </CardContent>
            </Card>
        </div>
    )
}
