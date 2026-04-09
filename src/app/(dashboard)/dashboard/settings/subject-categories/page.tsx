"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import { Palette, Plus, Tags } from "lucide-react";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";

const subjectCategorySchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100),
  code: z.string().min(1, "Le code est requis").max(30),
  description: z.string().max(500).optional(),
  color: z.string().max(30).optional(),
  icon: z.string().max(50).optional(),
  order: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

type SubjectCategoryFormInput = z.input<typeof subjectCategorySchema>;
type SubjectCategoryFormValues = z.output<typeof subjectCategorySchema>;

type SubjectCategory = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
};

const defaultValues: SubjectCategoryFormInput = {
  name: "",
  code: "",
  description: "",
  color: "#2D6A4F",
  icon: "",
  order: 0,
  isActive: true,
};

export default function SubjectCategoriesSettingsPage() {
  const { data, isLoading, mutate } = useSWR<SubjectCategory[]>("/api/subject-categories?activeOnly=false", fetcher, {
    revalidateOnFocus: false,
  });
  const [showInactive, setShowInactive] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SubjectCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<SubjectCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<SubjectCategoryFormInput, unknown, SubjectCategoryFormValues>({
    resolver: zodResolver(subjectCategorySchema),
    defaultValues,
  });

  useEffect(() => {
    if (!sheetOpen) {
      form.reset(defaultValues);
      setEditingCategory(null);
    }
  }, [form, sheetOpen]);

  const categories = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    if (showInactive) return source;
    return source.filter((category) => category.isActive);
  }, [data, showInactive]);

  const openCreateSheet = () => {
    setEditingCategory(null);
    form.reset(defaultValues);
    setSheetOpen(true);
  };

  const openEditSheet = (category: SubjectCategory) => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      code: category.code,
      description: category.description || "",
      color: category.color || "#2D6A4F",
      icon: category.icon || "",
      order: category.order,
      isActive: category.isActive,
    });
    setSheetOpen(true);
  };

  const submitCategory = async (values: SubjectCategoryFormValues) => {
    setIsSubmitting(true);
    const payload = {
      ...values,
      description: values.description || undefined,
      color: values.color || undefined,
      icon: values.icon || undefined,
    };

    try {
      const response = await fetch(
        editingCategory ? `/api/subject-categories/${editingCategory.id}` : "/api/subject-categories",
        {
          method: editingCategory ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Impossible d'enregistrer la catégorie.");
      }

      toast.success(editingCategory ? "Catégorie mise à jour." : "Catégorie créée.");
      await mutate();
      setSheetOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/subject-categories/${categoryToDelete.id}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Suppression impossible.");
      }

      toast.success("Catégorie supprimée.");
      await mutate();
      setCategoryToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<SubjectCategory>[] = [
      {
        accessorKey: "name",
        header: "Nom",
        cell: ({ row }) => {
          const category = row.original;
          return (
            <button
              type="button"
              onClick={() => openEditSheet(category)}
              className="flex items-center gap-3 text-left"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: category.color || "#2D6A4F" }}
              />
              <span className="font-medium text-foreground">{category.name}</span>
            </button>
          );
        },
      },
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <code className="text-xs text-muted-foreground">{row.original.code}</code>,
      },
      {
        accessorKey: "order",
        header: "Ordre",
      },
      {
        accessorKey: "isActive",
        header: "Statut",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "default" : "secondary"}>
            {row.original.isActive ? "Actif" : "Inactif"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openEditSheet(row.original)}>
              Éditer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setCategoryToDelete(row.original)}
            >
              Supprimer
            </Button>
          </div>
        ),
      },
    ];

  return (
    <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
      <div className="flex h-full flex-col gap-6">
        <PageHeader
          title="Catégories de matières"
          description="Expose l'API `/api/subject-categories` avec une UI d'administration complète."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Paramètres", href: "/dashboard/settings" },
            { label: "Catégories de matières" },
          ]}
          actions={
            <Button className="gap-2" onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              Nouvelle catégorie
            </Button>
          }
        />

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tags className="h-5 w-5 text-primary" />
                  Référentiel pédagogique
                </CardTitle>
                <CardDescription>
                  Utilisez ces catégories pour normaliser les matières et supprimer les valeurs hardcodées.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Afficher les inactives</span>
                <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-lg bg-muted/40 skeleton-shimmer" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <EmptyState
                icon={Palette}
                title="Aucune catégorie de matières"
                description="Créez une première catégorie pour alimenter les formulaires matières."
                action={
                  <Button className="gap-2" onClick={openCreateSheet}>
                    <Plus className="h-4 w-4" />
                    Ajouter une catégorie
                  </Button>
                }
              />
            ) : (
              <DataTable
                columns={columns}
                data={categories}
                searchKey="name"
                searchPlaceholder="Rechercher une catégorie..."
                pageSizeOptions={[25, 50, 100]}
              />
            )}
          </CardContent>
        </Card>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full max-w-[480px] p-0 sm:max-w-[480px]">
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border px-6 py-5">
                <SheetTitle>{editingCategory ? "Modifier la catégorie" : "Créer une catégorie"}</SheetTitle>
                <SheetDescription>
                  La validation client suit le schéma Zod de l'API et la mutation réinvalide immédiatement la liste.
                </SheetDescription>
              </SheetHeader>

              <Form {...form}>
                <form className="flex h-full flex-col" onSubmit={form.handleSubmit((values) => void submitCategory(values))}>
                  <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Code</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="order"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ordre</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                name={field.name}
                                value={typeof field.value === "number" ? field.value : 0}
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                                ref={field.ref}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Couleur</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="#2D6A4F" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="icon"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Icône</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="book-open" />
                            </FormControl>
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
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={4} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                          <div>
                            <FormLabel className="text-sm">Catégorie active</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Désactive l'entrée sans la retirer des historiques.
                            </p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t border-border px-6 py-4">
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Enregistrement..." : editingCategory ? "Mettre à jour" : "Créer"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </SheetContent>
        </Sheet>

        <ConfirmActionDialog
          open={Boolean(categoryToDelete)}
          onOpenChange={(open) => {
            if (!open) setCategoryToDelete(null);
          }}
          title="Supprimer cette catégorie ?"
          description={categoryToDelete ? `La catégorie ${categoryToDelete.name} sera supprimée définitivement.` : undefined}
          confirmLabel={isDeleting ? "Suppression..." : "Supprimer"}
          isConfirmLoading={isDeleting}
          onConfirm={() => void deleteCategory()}
        />
      </div>
    </PageGuard>
  );
}
