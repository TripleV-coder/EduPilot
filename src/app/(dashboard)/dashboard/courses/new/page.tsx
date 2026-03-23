"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { 
    Plus, 
    Trash2, 
    GripVertical, 
    BookOpen, 
    Layers, 
    FileText, 
    Video, 
    Save, 
    ChevronDown, 
    ChevronUp,
    Loader2,
    AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";

const lessonSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères"),
    content: z.string().min(10, "Le contenu doit être plus détaillé"),
    type: z.enum(["TEXT", "VIDEO", "PDF", "QUIZ", "ASSIGNMENT"]),
    videoUrl: z.string().url("URL invalide").optional().or(z.literal("")),
    fileUrl: z.string().url("URL invalide").optional().or(z.literal("")),
    duration: z.coerce.number().min(0).optional(),
    order: z.number(),
});

const moduleSchema = z.object({
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères"),
    description: z.string().optional(),
    order: z.number(),
    lessons: z.array(lessonSchema).min(1, "Ajoutez au moins une leçon"),
});

const courseSchema = z.object({
    title: z.string().min(5, "Le titre doit faire au moins 5 caractères"),
    description: z.string().min(10, "La description doit être plus détaillée"),
    classSubjectId: z.string().min(1, "Sélectionnez une matière"),
    isPublished: z.boolean(),
    modules: z.array(moduleSchema).min(1, "Ajoutez au moins un module"),
});

type CourseFormValues = z.infer<typeof courseSchema>;

export default function NewCoursePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mySubjects, setMySubjects] = useState<any[]>([]);
    const [expandedModule, setExpandedModule] = useState<number | null>(0);

    const form = useForm<CourseFormValues>({
        resolver: zodResolver(courseSchema) as any,
        defaultValues: {
            title: "",
            description: "",
            classSubjectId: "",
            isPublished: false,
            modules: [
                {
                    title: "Module 1",
                    description: "",
                    order: 0,
                    lessons: [
                        { title: "Introduction", content: "Bienvenue dans ce cours...", type: "TEXT", order: 0 }
                    ]
                }
            ]
        }
    });

    const { fields: moduleFields, append: appendModule, remove: removeModule } = useFieldArray({
        control: form.control,
        name: "modules"
    });

    useEffect(() => {
        fetch("/api/me/subjects")
            .then(res => res.json())
            .then(data => setMySubjects(data))
            .catch(() => {});
    }, []);

    async function onSubmit(values: CourseFormValues) {
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Erreur lors de la création du cours");
            }

            toast({ title: "Succès !", description: "Votre cours a été créé avec succès." });
            router.push("/dashboard/courses");
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <PageGuard roles={["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                <PageHeader
                    title="Créer un nouveau cours"
                    description="Concevez votre programme pédagogique, ajoutez des modules et des leçons."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Cours", href: "/dashboard/courses" },
                        { label: t("common.new") },
                    ]}
                />

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* Course Basic Info */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                    Informations Générales
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Titre du cours</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="classSubjectId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Matière & Classe</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {mySubjects.map((s) => (
                                                            <SelectItem key={s.id} value={s.id}>
                                                                {s.subject.name} ({s.class.name})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description du cours</FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                     
                                                    className="min-h-[100px]" 
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="isPublished"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">{t("common.publishNow")}</FormLabel>
                                                <FormDescription>
                                                    Rendre le cours visible pour les élèves dès l&apos;enregistrement.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        {/* Modules Builder */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-primary" />
                                    Structure du cours (Modules)
                                </h3>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => appendModule({ title: `Module ${moduleFields.length + 1}`, description: "", order: moduleFields.length, lessons: [{ title: "Nouvelle leçon", content: "", type: "TEXT", order: 0 }] })}
                                    className="gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Ajouter un module
                                </Button>
                            </div>

                            {moduleFields.map((module, moduleIndex) => (
                                <Card key={module.id} className="border-border shadow-sm overflow-hidden">
                                    <div className="bg-muted/30 p-4 flex items-center justify-between border-b border-border cursor-pointer" onClick={() => setExpandedModule(expandedModule === moduleIndex ? null : moduleIndex)}>
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                                                {moduleIndex + 1}
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name={`modules.${moduleIndex}.title`}
                                                render={({ field }) => (
                                                    <Input 
                                                        {...field} 
                                                        className="h-8 bg-transparent border-none font-bold focus-visible:ring-0 px-0 max-w-sm" 
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeModule(moduleIndex)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            {expandedModule === moduleIndex ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    </div>

                                    {expandedModule === moduleIndex && (
                                        <CardContent className="p-6 space-y-6">
                                            <FormField
                                                control={form.control}
                                                name={`modules.${moduleIndex}.description`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Objectif du module</FormLabel>
                                                        <FormControl><Input {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Lessons List inside Module */}
                                            <div className="space-y-4 pt-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-bold text-muted-foreground">Leçons de ce module</p>
                                                    <LessonAppender moduleIndex={moduleIndex} control={form.control} />
                                                </div>
                                                
                                                <LessonsList moduleIndex={moduleIndex} control={form.control} />
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            ))}
                        </div>

                        <div className="flex items-center justify-end gap-4 pt-6">
                            <Button type="button" variant="outline" onClick={() => router.back()}>
                                Annuler
                            </Button>
                            <Button type="submit" className="gap-2 min-w-[150px]" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Enregistrer le cours
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </PageGuard>
    );
}

// Helper component for lessons to keep main component clean
function LessonsList({ moduleIndex, control }: { moduleIndex: number, control: any }) {
    const { fields, remove } = useFieldArray({
        control,
        name: `modules.${moduleIndex}.lessons`
    });

    return (
        <div className="space-y-3">
            {fields.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="p-4 border border-border rounded-xl bg-background/50 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            <FormField
                                control={control}
                                name={`modules.${moduleIndex}.lessons.${lessonIndex}.title`}
                                render={({ field }) => (
                                    <Input {...field} className="h-7 bg-transparent border-none font-semibold focus-visible:ring-0 px-0 min-w-[200px]" />
                                )}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <FormField
                                control={control}
                                name={`modules.${moduleIndex}.lessons.${lessonIndex}.type`}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger className="h-7 w-[100px] text-[10px] uppercase font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TEXT">Texte</SelectItem>
                                            <SelectItem value="VIDEO">Vidéo</SelectItem>
                                            <SelectItem value="PDF">PDF</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(lessonIndex)}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    <FormField
                        control={control}
                        name={`modules.${moduleIndex}.lessons.${lessonIndex}.content`}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea className="min-h-[80px] text-sm" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Conditional Video URL field */}
                    <LessonUrlFields moduleIndex={moduleIndex} lessonIndex={lessonIndex} control={control} />
                </div>
            ))}
        </div>
    );
}

function LessonUrlFields({ moduleIndex, lessonIndex, control }: { moduleIndex: number, lessonIndex: number, control: any }) {
    // Watch lesson type
    const lessonType = control._formValues.modules[moduleIndex].lessons[lessonIndex].type;

    if (lessonType === "VIDEO") {
        return (
            <FormField
                control={control}
                name={`modules.${moduleIndex}.lessons.${lessonIndex}.videoUrl`}
                render={({ field }) => (
                    <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary" />
                        <Input {...field} className="h-8 text-xs" />
                    </div>
                )}
            />
        );
    }

    if (lessonType === "PDF") {
        return (
            <FormField
                control={control}
                name={`modules.${moduleIndex}.lessons.${lessonIndex}.fileUrl`}
                render={({ field }) => (
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <Input {...field} className="h-8 text-xs" />
                    </div>
                )}
            />
        );
    }

    return null;
}

function LessonAppender({ moduleIndex, control }: { moduleIndex: number, control: any }) {
    const { append } = useFieldArray({
        control,
        name: `modules.${moduleIndex}.lessons`
    });

    return (
        <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="text-xs h-7 gap-1.5"
            onClick={() => append({ title: "Nouvelle leçon", content: "", type: "TEXT", order: 0 })}
        >
            <Plus className="w-3.5 h-3.5" /> Ajouter une leçon
        </Button>
    );
}
