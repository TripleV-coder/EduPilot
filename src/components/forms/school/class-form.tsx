"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { classSchema } from "@/lib/validations/school"
import { Loader2, Save } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useTeachers } from "@/hooks/use-teachers"
import { useClassLevels } from "@/hooks/use-class-levels"

type ClassFormValues = z.infer<typeof classSchema>

interface ClassFormProps {
    initialData?: any;
    isEditing?: boolean;
}

export function ClassForm({ initialData, isEditing = false }: ClassFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const { data: teachersData, isLoading: isLoadingTeachers } = useTeachers()
    const { data: levelsData, isLoading: isLoadingLevels } = useClassLevels()

    const form = useForm<ClassFormValues>({
        resolver: zodResolver(classSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            classLevelId: initialData?.classLevelId || "",
            capacity: initialData?.capacity || 40,
            mainTeacherId: initialData?.mainTeacherId || "",
        },
    })

    async function onSubmit(data: ClassFormValues) {
        setIsSubmitting(true)
        try {
            const url = isEditing && initialData ? `/api/classes/${initialData.id}` : "/api/classes";
            const method = isEditing ? "PATCH" : "POST";

            const payload = {
                ...data,
                mainTeacherId: data.mainTeacherId === "none" || data.mainTeacherId === "" ? null : data.mainTeacherId
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

            toast.success(isEditing ? "Classe mise à jour" : "Classe créée avec succès")
            router.push("/school/classes")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Une erreur est survenue")
        } finally {
            setIsSubmitting(false)
        }
    }

    const allTeachers = teachersData?.data || [];
    const allLevels = levelsData || [];

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nom de la classe</FormLabel>
                            <FormControl>
                                <Input placeholder="6ème A" {...field} />
                            </FormControl>
                            <FormDescription>Ex: 6ème A, Tle D1, CP B</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="classLevelId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Niveau</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger disabled={isLoadingLevels}>
                                            <SelectValue placeholder="Sélectionner le niveau" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allLevels.map((level) => (
                                            <SelectItem key={level.id} value={level.id}>
                                                {level.name}
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
                        name="capacity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Capacité Max.</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="mainTeacherId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Professeur Principal (Optionnel)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
                                <FormControl>
                                    <SelectTrigger disabled={isLoadingTeachers}>
                                        <SelectValue placeholder="Sélectionner un professeur" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Aucun</SelectItem>
                                    {allTeachers.map((teacher) => (
                                        <SelectItem key={teacher.id} value={teacher.id}>
                                            {teacher.user.firstName} {teacher.user.lastName}
                                            {teacher.specialization ? ` (${teacher.specialization})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        {isEditing ? "Enregistrer les modifications" : "Créer la classe"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
