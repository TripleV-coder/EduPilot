"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { AlertCircle, Save, ArrowLeft, CheckCircle, UserPlus, Info } from "lucide-react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { teacherCreateSchema } from "@/lib/validations/user";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useSWRConfig } from "swr";

const STANDARD_PASSWORD = "00000000";

type TeacherFormValues = z.infer<typeof teacherCreateSchema>;

export default function NewTeacherPage() {
    const { toast } = useToast();
    const { mutate } = useSWRConfig();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // additionalSchoolIds (.default) et hireDate (coerce) rendent le type
    // d'entrée ≠ type de sortie : trois génériques au lieu d'un cast.
    const form = useForm<z.input<typeof teacherCreateSchema>, unknown, TeacherFormValues>({
        resolver: zodResolver(teacherCreateSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            password: STANDARD_PASSWORD,
            matricule: `PROF-${new Date().getFullYear()}-`,
            specialization: "",
            hireDate: undefined,
        },
    });

    const onSubmit = async (values: TeacherFormValues) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const formData = {
                ...values,
                hireDate: values.hireDate ? new Date(values.hireDate).toISOString() : undefined
            };

            const res = await fetch("/api/teachers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.details && Array.isArray(data.details)) {
                    throw new Error(`${data.details[0].path.join('.')}: ${data.details[0].message}`);
                }
                throw new Error(data.error || "Une erreur est survenue lors de l'enregistrement");
            }

            setSuccess(true);
            mutate(key => typeof key === 'string' && key.startsWith('/api/teachers'));

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

    const resetForm = () => {
        setSuccess(false);
        form.reset({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            password: STANDARD_PASSWORD,
            matricule: `PROF-${new Date().getFullYear()}-`,
            specialization: "",
            hireDate: undefined,
        });
    };

    return (
        <PageGuard permission={Permission.TEACHER_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/teachers">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <PageHeader
                        title="Ajouter un Enseignant"
                        description="Enregistrer un nouveau membre du corps professoral"
                    />
                </div>

                <Card className="border-border shadow-sm">
                    <CardHeader className="border-b bg-muted/30">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Dossier de l'Enseignant
                        </CardTitle>
                        <CardDescription>
                            Remplissez ce formulaire. Le compte est créé avec le mot de passe standard et changement obligatoire à la première connexion.
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
                                <h3 className="text-xl font-bold text-success">Enseignant créé avec succès !</h3>

                                <Card className="bg-background max-w-md mx-auto p-4 text-left border-dashed shadow-sm">
                                    <p className="text-sm text-muted-foreground mb-2 flex flex-center gap-2">
                                        <Info className="h-4 w-4" />
                                        Veuillez transmettre ces identifiants au professeur :
                                    </p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                                            <span className="text-xs font-semibold text-muted-foreground">Mot de passe temporaire :</span>
                                            <code className="text-sm font-mono font-bold select-all bg-background px-2 py-1 rounded border">{STANDARD_PASSWORD}</code>
                                        </div>
                                    </div>
                                </Card>

                                <div className="pt-4 flex justify-center gap-4">
                                    <Button onClick={resetForm} variant="outline">
                                        Ajouter un autre enseignant
                                    </Button>
                                    <Link href="/dashboard/teachers">
                                        <Button>Retourner à la liste</Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                                    <div className="space-y-5">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">État Civil</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <FormField
                                                control={form.control}
                                                name="firstName"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Prénoms <span className="text-destructive">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input aria-label="Prénom de l'enseignant" placeholder="Ex: Awa" {...field} />
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
                                                        <FormLabel>Nom de famille <span className="text-destructive">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input aria-label="Nom de famille de l'enseignant" placeholder="Ex: Hountondji" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input aria-label="Adresse e-mail de l'enseignant" type="email" placeholder="prenom.nom@ecole.edu" {...field} />
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
                                                            <Input aria-label="Téléphone de l'enseignant" placeholder="+229 01 00 00 00 00" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-5 pt-4 border-t border-border">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profil Professionnel</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <FormField
                                                control={form.control}
                                                name="matricule"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Matricule</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="specialization"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Spécialité Principale</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="hireDate"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Date d'embauche</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="date"
                                                                {...field}
                                                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="hidden">
                                                <FormField
                                                    control={form.control}
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <Input type="hidden" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-border flex justify-end gap-3">
                                        <Link href="/dashboard/teachers">
                                            <Button type="button" variant="outline" disabled={loading}>
                                                Annuler
                                            </Button>
                                        </Link>
                                        <Button type="submit" disabled={loading} className="gap-2">
                                            {loading ? (
                                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            Enregistrer
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

