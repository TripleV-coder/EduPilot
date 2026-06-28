"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormPageTemplate } from "@/components/layout/form-page-template";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { AlertCircle, Save, CheckCircle, BookOpen } from "lucide-react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { classSchema } from "@/lib/validations/school";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import useSWR, { useSWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";
import { getErrorMessage } from "@/lib/utils/error-message";
import { useSchool } from "@/components/providers/school-provider";

type ClassFormValues = z.infer<typeof classSchema>;

export default function NewClassPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { mutate } = useSWRConfig();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Fetch options for the selects
    const { data: levelsResponse } = useSWR<any>("/api/class-levels", fetcher);
    const { data: teachersResponse } = useSWR<any>("/api/teachers", fetcher);

    // Safety fallback
    const allClassLevels = Array.isArray(levelsResponse) ? levelsResponse : levelsResponse?.data || [];
    const teachers = Array.isArray(teachersResponse) ? teachersResponse : teachersResponse?.teachers || teachersResponse?.data || [];

    // N'autoriser que les niveaux des cycles offerts par l'établissement.
    // Défaut sûr : tant que offeredLevels est vide (chargement / non configuré),
    // on affiche tous les niveaux — on ne masque jamais hâtivement.
    const { offeredLevels } = useSchool();
    const classLevels = offeredLevels && offeredLevels.length > 0
        ? allClassLevels.filter((lvl: any) => offeredLevels.includes(lvl.level))
        : allClassLevels;

    // z.coerce rend le type d'entrée ≠ type de sortie : les trois génériques
    // remplacent le cast du resolver.
    const form = useForm<z.input<typeof classSchema>, unknown, ClassFormValues>({
        resolver: zodResolver(classSchema),
        defaultValues: {
            name: "",
            classLevelId: "",
            capacity: undefined,
            mainTeacherId: "",
        },
    });

    const onSubmit = async (values: ClassFormValues) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // cleanup empty relations
            const payload = {
                ...values,
                mainTeacherId: values.mainTeacherId || undefined,
            };

            const res = await fetch("/api/classes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.details && Array.isArray(data.details)) {
                    throw new Error(`${data.details[0].path.join('.')}: ${data.details[0].message}`);
                }
                throw new Error(data.error || "Une erreur est survenue lors de l'enregistrement");
            }

            setSuccess(true);
            mutate(key => typeof key === 'string' && key.startsWith('/api/classes'));

            setTimeout(() => {
                router.push("/dashboard/classes");
            }, 1000);

        } catch (err) {
            setError(getErrorMessage(err));
            toast({
                title: "Erreur",
                description: getErrorMessage(err),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <FormPageTemplate
            permission={Permission.CLASS_CREATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
            backHref="/dashboard/classes"
            title="Créer une classe"
            description="Ajouter une nouvelle classe à l'établissement"
            maxWidth="max-w-2xl"
        >

                <Card className="border-border shadow-sm">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Configuration de la classe
                        </CardTitle>
                        <CardDescription>
                            Renseignez les informations de la classe et assignez un niveau.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        {success ? (
                            <div className="p-6 rounded-xl border-2 border-success/30 bg-success/10 text-center space-y-4">
                                <div className="mx-auto w-12 h-12 bg-success/10 text-success rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-success">Classe créée avec succès !</h3>
                                <p className="text-sm text-muted-foreground">Redirection vers la liste des classes...</p>
                            </div>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nom de la classe <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input aria-label="Nom de la classe" placeholder="Ex: 6ème A" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="classLevelId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Niveau d'étude <span className="text-destructive">*</span></FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger aria-label="Sélectionner le niveau d'étude">
                                                            <SelectValue placeholder="Choisir un niveau" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {classLevels.map((lvl: any) => (
                                                            <SelectItem key={lvl.id} value={lvl.id}>
                                                                {lvl.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {!classLevels.length && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Aucun niveau disponible pour les cycles offerts par votre établissement.{" "}
                                                        <Link href="/dashboard/settings/cycles" className="text-primary underline underline-offset-2">
                                                            Configurer les cycles
                                                        </Link>
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-5">
                                        <FormField
                                            control={form.control}
                                            name="capacity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Capacité (élèves)</FormLabel>
                                                    <FormControl>
                                                        <Input aria-label="Capacité maximale de la classe" type="number" min="1" placeholder="Ex: 45" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="mainTeacherId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Professeur Principal</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                                                        <FormControl>
                                                            <SelectTrigger aria-label="Sélectionner le professeur principal">
                                                                <SelectValue placeholder="Aucun" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="">Aucun</SelectItem>
                                                            {teachers.map((t: any) => (
                                                                <SelectItem key={t.id} value={t.id}>
                                                                    {t.user.lastName} {t.user.firstName}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="pt-6 flex justify-end gap-3">
                                        <Link href="/dashboard/classes">
                                            <Button type="button" variant="outline" disabled={loading}>
                                                Annuler
                                            </Button>
                                        </Link>
                                        <Button type="submit" disabled={loading || !classLevels.length} className="gap-2">
                                            {loading ? (
                                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            Enregistrer la classe
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        )}
                    </CardContent>
                </Card>
        </FormPageTemplate>
    );
}
