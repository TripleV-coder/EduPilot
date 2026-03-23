"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Permission } from "@/lib/rbac/permissions";
import { incidentCreateSchema, IncidentFormValues } from "@/lib/validations/incident";
import { AlertCircle, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { t } from "@/lib/i18n";

const INCIDENT_TYPES = [
    { value: "LATE", label: "Retard" },
    { value: "ABSENCE_UNEXCUSED", label: "Absence Injustifiée" },
    { value: "DISRESPECT", label: "Manque de respect" },
    { value: "DISRUPTION", label: "Perturbation de cours" },
    { value: "CHEATING", label: "Tricherie / Fraude" },
    { value: "BULLYING", label: "Harcèlement" },
    { value: "VIOLENCE", label: "Violence physique/verbale" },
    { value: "VANDALISM", label: "Vandalisme" },
    { value: "THEFT", label: "Vol" },
    { value: "SUBSTANCE", label: "Substances illicites" },
    { value: "INAPPROPRIATE_LANGUAGE", label: "Langage grossier" },
    { value: "DRESS_CODE", label: "Tenue non-conforme" },
    { value: "TECHNOLOGY_MISUSE", label: "Usage interdit du téléphone" },
    { value: "OTHER", label: "Autre" }
];

const SEVERITIES = [
    { value: "LOW", label: "Mineur" },
    { value: "MEDIUM", label: "Moyen" },
    { value: "HIGH", label: "Majeur" },
    { value: "CRITICAL", label: "Critique" }
];

export default function NewIncidentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch students list
    const { data: studentsData, isLoading: isLoadingStudents } = useSWR("/api/students?limit=200", fetcher);
    const students = studentsData?.students || [];

    const form = useForm<IncidentFormValues>({
        resolver: zodResolver(incidentCreateSchema) as any,
        defaultValues: {
            studentId: "",
            incidentType: "OTHER",
            severity: "MEDIUM",
            date: new Date().toISOString().slice(0, 16),
            location: "",
            description: "",
            actionTaken: "",
        },
    });

    const onSubmit = async (values: IncidentFormValues) => {
        setIsSubmitting(true);
        try {
            const formattedValues = {
                ...values,
                date: new Date(values.date).toISOString()
            };

            const response = await fetch("/api/incidents", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formattedValues),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erreur lors du signalement de l'incident");
            }

            toast({
                title: "Incident signalé",
                description: "L'incident a été enregistré avec succès.",
            });

            router.push("/dashboard/incidents");
            router.refresh();
        } catch (error) {
            toast({
                title: "Erreur",
                description: error instanceof Error ? error.message : "Une erreur est survenue",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6 max-w-4xl mx-auto pb-12">
                <PageHeader
                    title="Signaler un incident"
                    description="Enregistrer une infraction, un retard ou tout autre incident lié à la vie scolaire."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Vie Scolaire", href: "/dashboard/incidents" },
                        { label: "Incidents", href: "/dashboard/incidents" },
                        { label: t("common.new") }
                    ]}
                />

                <Card className="border-border shadow-sm">
                    <CardContent className="pt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium">Détails de l'élève</h3>

                                    <FormField
                                        control={form.control as any}
                                        name="studentId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Élève concerné *</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={isLoadingStudents ? "Chargement des élèves..." : "Sélectionner un élève"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {students.map((student: any) => (
                                                            <SelectItem key={student.id} value={student.id}>
                                                                {student.user.firstName} {student.user.lastName} ({student.matricule})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium border-t border-border pt-4">Informations sur l'incident</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control as any}
                                            name="incidentType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Type d'incident *</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {INCIDENT_TYPES.map((type) => (
                                                                <SelectItem key={type.value} value={type.value}>
                                                                    {type.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control as any}
                                            name="severity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Gravité *</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {SEVERITIES.map((sev) => (
                                                                <SelectItem key={sev.value} value={sev.value}>
                                                                    {sev.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control as any}
                                            name="date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date et heure *</FormLabel>
                                                    <FormControl>
                                                        <Input type="datetime-local" {...field as any} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control as any}
                                            name="location"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Lieu de l'incident</FormLabel>
                                                    <FormControl>
                                                        <Input {...field as any} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control as any}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description détaillée *</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        
                                                        className="min-h-[120px]"
                                                        {...field as any}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control as any}
                                        name="actionTaken"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mesure(s) conservatoire(s) prise(s)</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        
                                                        className="min-h-[80px]"
                                                        {...field as any}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="flex items-center justify-between border-t border-border pt-6 mt-6">
                                    <Button variant="outline" type="button" asChild>
                                        <Link href="/dashboard/incidents">
                                            <ArrowLeft className="w-4 h-4 mr-2" />
                                            Annuler
                                        </Link>
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Enregistrement...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-2" />
                                                Signaler l'incident
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
