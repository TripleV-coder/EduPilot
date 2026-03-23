"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, UserPlus, ArrowLeft, CheckCircle, Info } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { Permission } from "@/lib/rbac/permissions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRBAC } from "@/lib/hooks/use-rbac";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    return Array.from(crypto.getRandomValues(new Uint32Array(12)))
        .map((x) => chars[x % chars.length])
        .join("") + "A1!";
};

const formSchema = z.object({
    firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
    lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
    email: z.string().email("Email invalide").toLowerCase().trim(),
    phone: z.string().optional(),
    role: z.enum(["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"]),
    password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    schoolId: z.string().optional(),
    schoolName: z.string().optional(),
    schoolAddress: z.string().optional(),
    schoolCity: z.string().optional(),
    schoolPhone: z.string().optional(),
    schoolEmail: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().email("Email invalide").optional()
    ),
    schoolType: z.enum(["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"]).optional(),
    schoolLevel: z.enum(["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE", "MIXED"]).optional(),
    parentSchoolId: z.string().optional(),
});

type UserFormValues = z.infer<typeof formSchema>;

export default function NewUserPage() {
    const { toast } = useToast();
    const { mutate } = useSWRConfig();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState<string>("");
    const { user } = useRBAC();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";

    const { data: schoolsData } = useSWR(isSuperAdmin ? "/api/schools?limit=200" : null, fetcher);
    const schools = Array.isArray(schoolsData)
        ? schoolsData
        : schoolsData?.data || schoolsData?.schools || [];

    const form = useForm<UserFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            role: "TEACHER",
            password: generateRandomPassword(),
            schoolId: undefined,
            schoolName: "",
            schoolAddress: "",
            schoolCity: "",
            schoolPhone: "",
            schoolEmail: "",
            schoolType: "PRIVATE",
            schoolLevel: "PRIMARY",
            parentSchoolId: undefined,
        },
    });

    const onSubmit = async (values: UserFormValues) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            if (values.role === "SCHOOL_ADMIN" && isSuperAdmin && !values.schoolName) {
                throw new Error("Le nom de l'établissement est requis pour créer un Admin. École.");
            }

            if (values.role !== "SCHOOL_ADMIN" && isSuperAdmin && !values.schoolId) {
                throw new Error("Veuillez sélectionner un établissement.");
            }

            const payload: any = {
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                phone: values.phone,
                role: values.role,
                password: values.password,
                schoolId: values.schoolId,
            };

            if (values.role === "SCHOOL_ADMIN" && isSuperAdmin && values.schoolName) {
                payload.school = {
                    name: values.schoolName,
                    address: values.schoolAddress || undefined,
                    city: values.schoolCity || undefined,
                    phone: values.schoolPhone || undefined,
                    email: values.schoolEmail || undefined,
                    type: values.schoolType || undefined,
                    level: values.schoolLevel || undefined,
                    parentSchoolId: values.parentSchoolId || undefined,
                };
                delete payload.schoolId;
            }

            const res = await fetch("/api/users", {
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

            setGeneratedPassword(values.password);
            setSuccess(true);

            // Revalidate the users list
            mutate(key => typeof key === 'string' && key.startsWith('/api/users'));

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
        setGeneratedPassword("");
        form.reset({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            role: "TEACHER",
            password: generateRandomPassword(),
            schoolId: undefined,
            schoolName: "",
            schoolAddress: "",
            schoolCity: "",
            schoolPhone: "",
            schoolEmail: "",
            schoolType: "PRIVATE",
            schoolLevel: "PRIMARY",
            parentSchoolId: undefined,
        });
    };

    return (
        <PageGuard permission={[Permission.USER_CREATE]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-2">
                    <Button variant="ghost" size="icon" asChild className="rounded-full shrink-0">
                        <Link href="/dashboard/users">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <PageHeader
                        title="Nouvel Utilisateur"
                        description="Créer un compte pour un membre du personnel"
                    />
                </div>

                <Card className="border-border shadow-sm">
                    <CardHeader className="bg-muted/30 border-b border-border pb-6">
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Informations du compte
                        </CardTitle>
                        <CardDescription>
                            Renseignez les informations de connexion et le rôle de l'utilisateur. Le mot de passe sera généré automatiquement.
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
                                <h3 className="text-xl font-bold text-emerald-700">Utilisateur créé avec succès !</h3>

                                <Card className="bg-background max-w-md mx-auto p-4 text-left border-dashed shadow-sm">
                                    <p className="text-sm text-muted-foreground mb-2 flex flex-center gap-2">
                                        <Info className="h-4 w-4" />
                                        Veuillez transmettre ces identifiants à l'utilisateur :
                                    </p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                                            <span className="text-xs font-semibold text-muted-foreground">Mot de passe temporaire :</span>
                                            <code className="text-sm font-mono font-bold select-all bg-background px-2 py-1 rounded border">{generatedPassword}</code>
                                        </div>
                                    </div>
                                </Card>

                                <div className="pt-4 flex justify-center gap-4">
                                    <Button onClick={resetForm} variant="outline">
                                        Créer un autre utilisateur
                                    </Button>
                                    <Link href="/dashboard/users">
                                        <Button>Retourner à la liste</Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="firstName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Prénom <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
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
                                                    <FormLabel>Nom <span className="text-destructive">*</span></FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
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
                                                        <Input type="email" {...field} />
                                                    </FormControl>
                                                    <FormDescription className="text-xs">
                                                        Adresse professionnelle utilisée pour la connexion de cet utilisateur.
                                                    </FormDescription>
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
                                                        <Input type="tel" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="role"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Rôle <span className="text-destructive">*</span></FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {isSuperAdmin && (
                                                                <SelectItem value="SCHOOL_ADMIN">Admin. École</SelectItem>
                                                            )}
                                                            <SelectItem value="DIRECTOR">Directeur</SelectItem>
                                                            <SelectItem value="ACCOUNTANT">Comptable</SelectItem>
                                                            <SelectItem value="TEACHER">Enseignant</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormDescription className="text-xs">
                                                        Détermine les permissions et l'accès aux différents modules d'EduPilot.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        {isSuperAdmin && form.watch("role") !== "SCHOOL_ADMIN" && (
                                            <FormField
                                                control={form.control}
                                                name="schoolId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Établissement <span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {schools.map((school: any) => (
                                                                    <SelectItem key={school.id} value={school.id}>
                                                                        {school.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormDescription className="text-xs">
                                                            Établissement dans lequel cet utilisateur exercera ses fonctions.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
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

                                    {isSuperAdmin && form.watch("role") === "SCHOOL_ADMIN" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="schoolName"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>Nom de l'établissement <span className="text-destructive">*</span></FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="schoolAddress"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>Adresse</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="schoolCity"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Ville</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="schoolPhone"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Téléphone</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="schoolEmail"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input type="email" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="schoolType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Type</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="PRIVATE">Privé</SelectItem>
                                                                <SelectItem value="PUBLIC">Public</SelectItem>
                                                                <SelectItem value="RELIGIOUS">Religieux</SelectItem>
                                                                <SelectItem value="INTERNATIONAL">International</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="schoolLevel"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Niveau</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="PRIMARY">Primaire</SelectItem>
                                                                <SelectItem value="SECONDARY_COLLEGE">Secondaire Collège</SelectItem>
                                                                <SelectItem value="SECONDARY_LYCEE">Secondaire Lycée</SelectItem>
                                                                <SelectItem value="MIXED">Mixte</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="parentSchoolId"
                                                render={({ field }) => (
                                                    <FormItem className="md:col-span-2">
                                                        <FormLabel>Établissement parent (optionnel)</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {schools.map((school: any) => (
                                                                    <SelectItem key={school.id} value={school.id}>
                                                                        {school.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    <div className="pt-4 flex justify-end gap-3 border-t border-border">
                                        <Button variant="outline" type="button" asChild>
                                            <Link href="/dashboard/users">{t("common.cancel")}</Link>
                                        </Button>
                                        <Button type="submit" disabled={loading} className="min-w-[150px]">
                                            {loading ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                "Créer l'utilisateur"
                                            )}
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
