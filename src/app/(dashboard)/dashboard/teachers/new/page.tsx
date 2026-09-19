"use client";

import { FormPageTemplate } from "@/components/layout/form-page-template";
export type { PageShellProps } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { AlertCircle, Save, CheckCircle, UserPlus, Info } from "lucide-react";
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
import { useCreateAccount } from "@/hooks/use-create-account";

type TeacherFormValues = z.infer<typeof teacherCreateSchema>;

export default function NewTeacherPage() {
    const { toast } = useToast();
    // Envoi et mot de passe provisoire généré par le serveur (N31) : hooks/use-create-account.
    const { loading, error, success, provisionalPassword, submit, reset } = useCreateAccount({
        endpoint: "/api/teachers",
        revalidatePrefix: "/api/teachers",
    });

    // additionalSchoolIds (.default) et hireDate (coerce) rendent le type
    // d'entrée ≠ type de sortie : trois génériques au lieu d'un cast.
    const form = useForm<z.input<typeof teacherCreateSchema>, unknown, TeacherFormValues>({
        resolver: zodResolver(teacherCreateSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            matricule: `PROF-${new Date().getFullYear()}-`,
            specialization: "",
            hireDate: undefined,
        },
    });

    const onSubmit = async (values: TeacherFormValues) => {
        const outcome = await submit({
            ...values,
            hireDate: values.hireDate ? new Date(values.hireDate).toISOString() : undefined
        });
        if (!outcome.ok) {
            toast({
                title: "Erreur",
                description: outcome.error,
                variant: "destructive"
            });
        }
    };

    const resetForm = () => {
        reset();
        form.reset({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            matricule: `PROF-${new Date().getFullYear()}-`,
            specialization: "",
            hireDate: undefined,
        });
    };

    return (
        <FormPageTemplate
            permission={Permission.TEACHER_CREATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
            backHref="/dashboard/teachers"
            title="Ajouter un Enseignant"
            description="Enregistrer un nouveau membre du corps professoral"
            breadcrumbs={[
                { label: "Tableau de bord", href: "/dashboard" },
                { label: "Enseignants", href: "/dashboard/teachers" },
                { label: "Nouveau" },
            ]}
        >

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
                                <h2 className="text-xl font-bold text-success">Enseignant créé avec succès !</h2>

                                <Card className="bg-background max-w-md mx-auto p-4 text-left border-dashed shadow-sm">
                                    <p className="text-sm text-muted-foreground mb-2 flex flex-center gap-2">
                                        <Info className="h-4 w-4" />
                                        Veuillez transmettre ces identifiants au professeur :
                                    </p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                                            <span className="text-xs font-semibold text-muted-foreground">Mot de passe temporaire :</span>
                                            <code className="text-sm font-mono font-bold select-all bg-background px-2 py-1 rounded border">{provisionalPassword}</code>
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
                                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">État Civil</h2>
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
                                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Profil Professionnel</h2>
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
        </FormPageTemplate>
    );
}

