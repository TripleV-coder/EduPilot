"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { studentCreateSchema } from "@/lib/validations/user"
import { Loader2, Save } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useClasses } from "@/hooks/use-classes"
import { useAcademicYears } from "@/hooks/use-academic-years"

// Schema tweaks for Edit
const studentFormSchema = studentCreateSchema.extend({
    password: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentFormSchema>

interface StudentFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export function StudentForm({ initialData, isEditing = false }: StudentFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const { data: classesData, isLoading: isLoadingClasses } = useClasses()
    const { data: yearsData, isLoading: isLoadingYears } = useAcademicYears()

    const defaultYear = yearsData?.find(y => y.isCurrent)?.id;

    const form = useForm<StudentFormValues>({
        resolver: zodResolver(studentFormSchema) as any,
        defaultValues: {
            firstName: initialData?.user?.firstName || "",
            lastName: initialData?.user?.lastName || "",
            email: initialData?.user?.email || "",
            phone: initialData?.user?.phone || "",
            password: "",
            matricule: initialData?.matricule || "",
            nationality: initialData?.nationality || "Beninoise",
            gender: initialData?.gender || "MALE",
            birthPlace: initialData?.birthPlace || "",
            address: initialData?.address || "",
            dateOfBirth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth) : undefined,
            classId: initialData?.enrollments?.[0]?.classId || "", // Assuming active enrollment
            academicYearId: initialData?.enrollments?.[0]?.academicYearId || "",
        },
    })

    // Set default academic year for new students if not set
    useEffect(() => {
        if (!isEditing && defaultYear && !form.getValues("academicYearId")) {
            form.setValue("academicYearId", defaultYear);
        }
    }, [defaultYear, form, isEditing]);

    async function onSubmit(data: StudentFormValues) {
        setIsSubmitting(true)
        try {
            const url = isEditing && initialData ? `/api/students/${initialData.id}` : "/api/students";
            const method = isEditing ? "PATCH" : "POST";

            const payload: any = { ...data };
            if (isEditing && !payload.password) {
                delete payload.password;
            }

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Erreur lors de la sauvegarde")
            }

            toast.success(isEditing ? "Élève mis à jour" : "Élève inscrit avec succès")
            router.push("/school/students")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setIsSubmitting(false)
        }
    }

    const allClasses = classesData?.data || [];
    const allYears = yearsData || [];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Prénom</FormLabel>
                                <FormControl>
                                    <Input placeholder="Jean" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nom</FormLabel>
                                <FormControl>
                                    <Input placeholder="Koffi" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email (Optionnel)</FormLabel>
                                <FormControl>
                                    <Input placeholder="jean.koffi@ecole.com" type="email" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Téléphone (Optionnel)</FormLabel>
                                <FormControl>
                                    <Input placeholder="+229..." {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date de naissance</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        {...field}
                                        value={field.value instanceof Date ? field.value.toISOString().split("T")[0] : field.value}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sexe</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner le sexe" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="MALE">Masculin</SelectItem>
                                        <SelectItem value="FEMALE">Féminin</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="birthPlace"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Lieu de naissance</FormLabel>
                                <FormControl>
                                    <Input placeholder="Cotonou" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="nationality"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nationalité</FormLabel>
                                <FormControl>
                                    <Input placeholder="Béninoise" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Adresse</FormLabel>
                            <FormControl>
                                <Input placeholder="Quartier, Ville..." {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Hidden password for edit or if generated */}
                {!isEditing && <input type="hidden" {...form.register("password")} />}

                <div className="border-t pt-4">
                    <h3 className="mb-4 text-lg font-medium">Scolarité</h3>
                    <div className="grid gap-4">
                        <FormField
                            control={form.control}
                            name="matricule"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Matricule</FormLabel>
                                    <FormControl>
                                        <Input placeholder="2024-EL-001" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="classId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Classe</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger disabled={isLoadingClasses}>
                                                <SelectValue placeholder="Sélectionner une classe" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {allClasses.map((cls) => (
                                                <SelectItem key={cls.id} value={cls.id}>
                                                    {cls.name} ({cls.classLevel.name})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="academicYearId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Année Scolaire</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger disabled={isLoadingYears}>
                                                <SelectValue placeholder="Sélectionner l'année" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {allYears.map((year) => (
                                                <SelectItem key={year.id} value={year.id}>
                                                    {year.name} {year.isCurrent && "(En cours)"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        {isEditing ? "Enregistrer les modifications" : "Inscrire l'élève"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
