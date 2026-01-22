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
import { teacherCreateSchema } from "@/lib/validations/user"
import { Loader2, Save } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

// Definition of the form schema extending the create schema
// Validates looser types for the form state before submitting to API
const teacherFormSchema = teacherCreateSchema.extend({
    password: z.string().optional(),
});

// Explicit type definition for the form values to satisfy useForm
type TeacherFormValues = {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    matricule?: string;
    specialization?: string;
    hireDate?: Date;
    password?: string;
}

interface TeacherFormProps {
    initialData?: any; // Should be TeacherWithUser type eventually
    isEditing?: boolean;
}

export function TeacherForm({ initialData, isEditing = false }: TeacherFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Using the explicit type here fixes the 'FieldValues' mismatch error
    const form = useForm<TeacherFormValues>({
        resolver: zodResolver(teacherFormSchema) as any,
        defaultValues: {
            firstName: initialData?.user?.firstName || "",
            lastName: initialData?.user?.lastName || "",
            email: initialData?.user?.email || "",
            phone: initialData?.user?.phone || "",
            password: "",
            matricule: initialData?.matricule || "",
            specialization: initialData?.specialization || "",
            // Handle date conversion safely
            hireDate: initialData?.hireDate ? new Date(initialData.hireDate) : undefined,
        },
    })

    async function onSubmit(data: TeacherFormValues) {
        setIsSubmitting(true)
        try {
            const url = isEditing && initialData ? `/api/teachers/${initialData.id}` : "/api/teachers";
            const method = isEditing ? "PATCH" : "POST";

            // Remove password if empty in edit mode
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

            toast.success(isEditing ? "Enseignant mis à jour" : "Enseignant créé avec succès")
            router.push("/school/teachers")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setIsSubmitting(false)
        }
    }

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
                                    <Input placeholder="Dupont" {...field} />
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
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input placeholder="jean.dupont@ecole.com" type="email" {...field} />
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
                                <FormLabel>Téléphone</FormLabel>
                                <FormControl>
                                    <Input placeholder="+229..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="specialization"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Spécialisation / Matière</FormLabel>
                            <FormControl>
                                <Input placeholder="Mathématiques" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="matricule"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Matricule (Optionnel)</FormLabel>
                                <FormControl>
                                    <Input placeholder="ENS-2024-001" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{isEditing ? "Nouveau mot de passe (Optionnel)" : "Mot de passe provisoire"}</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder={isEditing ? "Laisser vide pour garder l'actuel" : "******"} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        {isEditing ? "Enregistrer les modifications" : "Créer le compte"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
