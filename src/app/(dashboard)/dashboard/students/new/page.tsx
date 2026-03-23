"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormDescription,
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
import { studentCreateSchema } from "@/lib/validations/user";
import { AlertCircle, Save, ArrowLeft, UserPlus, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";

type StudentFormValues = z.infer<typeof studentCreateSchema>;

const formatDateInput = (value?: Date) => {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
};

export default function NewStudentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Fetch classes and academic years
    const { data: classesData } = useSWR<any>("/api/classes", fetcher);
    const { data: yearsData } = useSWR<any>("/api/academic-years", fetcher);
    const { data: nationalities } = useSWR("/api/reference/nationalities", fetcher);

    const classes = Array.isArray(classesData) ? classesData : classesData?.data || [];
    const academicYears = Array.isArray(yearsData) ? yearsData : yearsData?.data || [];
    const currentYear = academicYears.find((y: any) => y.isCurrent)?.id || academicYears[0]?.id;

    // React Hook Form
    const form = useForm<StudentFormValues>({
        resolver: zodResolver(studentCreateSchema) as any,
        defaultValues: {
            email: "",
            firstName: "",
            lastName: "",
            phone: "",
            password: "",
            matricule: `MAT-${new Date().getFullYear()}-`,
            gender: undefined,
            dateOfBirth: undefined,
            birthPlace: "",
            nationality: "Beninoise",
            address: "",
            classId: "",
            academicYearId: currentYear || "",
        },
    });

    useEffect(() => {
        if (currentYear && !form.getValues('academicYearId')) {
            form.setValue('academicYearId', currentYear);
        }
    }, [currentYear, form]);

    const onSubmit = async (data: StudentFormValues) => {
        setLoading(true);
        try {
            const res = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Une erreur est survenue lors de l'enregistrement");
            }

            toast({
                title: "Succès",
                description: "L'élève a été inscrit avec succès.",
            });

            setTimeout(() => {
                router.push("/dashboard/students");
                router.refresh(); // Refresh SWR in list
            }, 1000);
        } catch (err: any) {
            toast({
                title: "Erreur",
                description: err.message,
                variant: "destructive",
            });
            setLoading(false);
        }
    };

    return (
        <PageGuard permission={[Permission.STUDENT_CREATE]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"]}>
            <div className="space-y-6 max-w-4xl mx-auto pb-10">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/students">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <PageHeader
                        title="Inscrire un(e) Élève"
                        description="Veuillez remplir les informations pour créer le compte de l'élève."
                    />
                </div>

                <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
                    <AlertCircle className="w-5 h-5 inline-block mr-2 text-primary" />
                    Le compte utilisateur sera généré automatiquement. L'élève pourra se connecter avec son email et le mot de passe fourni.
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <Card className="border-border shadow-sm">
                            <CardHeader className="border-b bg-muted/10">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-primary" />
                                    État Civil & Identité
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control as any} name="matricule" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Matricule <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormDescription className="text-xs">
                                            Identifiant interne unique de l'élève dans votre établissement.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="gender" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Genre <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="MALE">Masculin</SelectItem>
                                                <SelectItem value="FEMALE">Féminin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="firstName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prénoms <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormDescription className="text-xs">
                                            Prénoms officiels tels qu'ils apparaissent sur les documents scolaires.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="lastName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom de famille <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormDescription className="text-xs">
                                            Nom de famille principal de l'élève.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="dateOfBirth" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date de naissance</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                value={formatDateInput(field.value)}
                                                onChange={(event) => {
                                                    const nextValue = event.target.value;
                                                    field.onChange(nextValue ? new Date(nextValue) : undefined);
                                                }}
                                            />
                                        </FormControl>
                                        <FormDescription className="text-xs">
                                            Cette information permet un suivi adapté à l'âge de l'élève.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="birthPlace" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Lieu de naissance</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormDescription className="text-xs">
                                            Ville ou localité de naissance de l'élève.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="nationality" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nationalité</FormLabel>
                                        <FormControl>
                                            <Input list="nationalities-list" {...field} />
                                        </FormControl>
                                        <datalist id="nationalities-list">
                                            {Array.isArray(nationalities) && nationalities.map((n: string) => (
                                                <option key={n} value={n} />
                                            ))}
                                        </datalist>
                                        <FormDescription className="text-xs">
                                            Indiquez la nationalité principale pour les rapports et statistiques.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardHeader className="border-b bg-muted/10">
                                <CardTitle className="text-lg">Scolarité Actuelle</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control as any} name="classId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Classe d'affectation <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {classes.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-xs">
                                            Classe dans laquelle l'élève sera inscrit pour l'année en cours.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="academicYearId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Année Académique <span className="text-destructive">*</span></FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {academicYears.map((y: any) => (
                                                    <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-xs">
                                            Année scolaire de référence pour cette inscription.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm">
                            <CardHeader className="border-b bg-muted/10">
                                <CardTitle className="text-lg">Compte & Contacts</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control as any} name="email" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                                        <FormControl><Input type="email" {...field} /></FormControl>
                                        <FormDescription className="text-xs">
                                            Adresse email utilisée pour la connexion élève et les notifications.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="password" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mot de passe provisoire <span className="text-destructive">*</span></FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    
                                                    {...field}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </FormControl>
                                        <FormDescription>8 caractères min, 1 majuscule, 1 chiffre, 1 caractère spécial.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="phone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Téléphone</FormLabel>
                                        <FormControl><Input type="tel" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control as any} name="address" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Adresse de résidence</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-4">
                            <Link href="/dashboard/students">
                                <Button type="button" variant="outline" disabled={loading}>
                                    Annuler
                                </Button>
                            </Link>
                            <Button type="submit" disabled={loading} className="gap-2">
                                {loading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />}
                                <Save className="h-4 w-4" />
                                Enregistrer l'élève
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </PageGuard>
    );
}
