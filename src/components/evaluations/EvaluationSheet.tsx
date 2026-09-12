"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchool } from "@/components/providers/school-provider";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import { listFrom } from "@/lib/api/list-payload";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils/error-message";
import type { Class, ClassSubjectWithTeacher, EvaluationType, Period } from "@/lib/types";

const evaluationSchema = z.object({
  classSubjectId: z.string().min(1, "La matière est requise"),
  periodId: z.string().min(1, "La période est requise"),
  typeId: z.string().min(1, "Le type d'évaluation est requis"),
  title: z.string().optional(),
  date: z.string().min(1, "La date est requise"),
  // Entrée typée string|number : bindings RHF sans cast (zod 4 type
  // l'entrée de coerce en unknown)
  maxGrade: z.coerce.number<string | number>().min(1).default(20),
  coefficient: z.coerce.number<string | number>().min(0.1).default(1),
});

type EvaluationFormValues = z.infer<typeof evaluationSchema>;

interface EvaluationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EvaluationSheet({ open, onOpenChange }: EvaluationSheetProps) {
  const { academicYearId } = useSchool();
  const [loading, setLoading] = useState(false);

  // N25 : la route renvoie { data, pagination } — traitée comme un tableau, la
  // liste des classes plantait à l'ouverture (`.map` sur un objet).
  const { data: classesPayload } = useSWR<unknown>("/api/classes", fetcher);
  const classes = listFrom<Class>(classesPayload);
  const { data: periods } = useSWR<Period[]>(academicYearId ? `/api/periods?academicYearId=${academicYearId}` : null, fetcher);
  const { data: evalTypes } = useSWR<EvaluationType[]>("/api/evaluation-types", fetcher);

  // z.coerce + .default rendent le type d'entrée ≠ type de sortie : les
  // trois génériques remplacent le cast du resolver.
  const form = useForm<z.input<typeof evaluationSchema>, unknown, EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      maxGrade: 20,
      coefficient: 1,
    },
  });

  const [pickedClassId, setPickedClassId] = useState<string>("");
  const { data: classSubjects } = useSWR<ClassSubjectWithTeacher[]>(pickedClassId ? `/api/class-subjects?classId=${pickedClassId}` : null, fetcher);

  async function onSubmit(values: EvaluationFormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      toast({ title: "Succès", description: "L'évaluation a été créée." });
      // La liste est paginée (clés /api/evaluations?limit=…&cursor=…) : on
      // revalide toutes ses variantes, filtres compris.
      mutate((key) => typeof key === "string" && key.startsWith("/api/evaluations"));
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({ title: "Erreur", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-card overflow-y-auto custom-scrollbar">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Nouvelle Évaluation</SheetTitle>
          <SheetDescription className="text-xs">Configurez les paramètres du prochain devoir ou examen.</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-4 border-b border-border/50 pb-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground">Étape 1 : Classe & Matière</Label>
                <div className="space-y-3">
                  {/* N26 : la classe est un état local, hors du formulaire — Label et
                      SelectTrigger simples : FormLabel/FormControl exigent un <FormField>
                      et faisaient planter la fiche à l'ouverture. */}
                  <FormItem>
                    <Label htmlFor="evaluation-class" className="text-xs">Classe</Label>
                    <Select onValueChange={setPickedClassId} value={pickedClassId}>
                      <SelectTrigger id="evaluation-class" className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {classes?.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="classSubjectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Matière</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!pickedClassId}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {classSubjects?.map((cs) => (
                              <SelectItem key={cs.id} value={cs.id} className="text-xs">{cs.subject?.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground">Étape 2 : Détails de l&apos;Évaluation</Label>
              
              <FormField
                control={form.control}
                name="typeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Type d&apos;évaluation</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {evalTypes?.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Période scolaire</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {periods?.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Titre (Optionnel)</FormLabel>
                    <FormControl>
                      <Input className="h-9 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-9 text-xs" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxGrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Note Max</FormLabel>
                      <FormControl>
                        <Input type="number" className="h-9 text-xs" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="coefficient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Coefficient</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="h-9 text-xs" {...field} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-9 text-[11px] font-bold uppercase" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" className="flex-1 h-9 text-[11px] font-bold uppercase" disabled={loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                Créer l&apos;Évaluation
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
