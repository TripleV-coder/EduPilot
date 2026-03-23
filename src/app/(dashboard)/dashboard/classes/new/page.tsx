"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { AlertCircle, Save, ArrowLeft, CheckCircle, BookOpen } from "lucide-react";
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
    const classLevels = Array.isArray(levelsResponse) ? levelsResponse : levelsResponse?.data || [];
    const teachers = Array.isArray(teachersResponse) ? teachersResponse : teachersResponse?.teachers || teachersResponse?.data || [];

    const form = useForm<ClassFormValues>({
        resolver: zodResolver(classSchema) as any,
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

        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Erreur",
                description: err.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageGuard permission={Permission.CLASS_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className="space-y-6 max-w-2xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/classes">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <PageHeader
                        title="Créer une classe"
                        description="Ajouter une nouvelle classe à l'établissement"
                    />
                </div>

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
                            <div className="p-6 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/5 text-center space-y-4">
                                <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-emerald-700">Classe créée avec succès !</h3>
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
                                                    <Input {...field} />
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
                                                        <SelectTrigger>
                                                            <SelectValue />
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
                                                        <Input type="number" min="1" {...field} />
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
                                                            <SelectTrigger>
                                                                <SelectValue />
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
            </div>
        </PageGuard>
    );
}
