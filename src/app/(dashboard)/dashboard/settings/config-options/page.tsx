"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Settings2, SlidersHorizontal } from "lucide-react";

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

const configOptionSchema = z.object({
  category: z.string().min(1, "La catégorie est requise").max(100),
  code: z.string().min(1, "Le code est requis").max(50),
  label: z.string().min(1, "Le libellé est requis").max(200),
  description: z.string().max(500).optional(),
  order: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  metadataText: z
    .string()
    .optional()
    .refine((value) => {
      if (!value || value.trim().length === 0) return true;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, "Le JSON des métadonnées est invalide."),
});

type ConfigOptionFormInput = z.input<typeof configOptionSchema>;
type ConfigOptionFormValues = z.output<typeof configOptionSchema>;

type ConfigOption = {
  id: string;
  category: string;
  code: string;
  label: string;
  description: string | null;
  order: number;
  isActive: boolean;
  metadata: unknown;
};

const defaultValues: ConfigOptionFormInput = {
  category: "",
  code: "",
  label: "",
  description: "",
  order: 0,
  isActive: true,
  metadataText: "",
};

export default function ConfigOptionsSettingsPage() {
  const { data, isLoading, mutate } = useSWR<ConfigOption[]>("/api/config-options?activeOnly=false", fetcher, {
    revalidateOnFocus: false,
  });
  const [showInactive, setShowInactive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ConfigOption | null>(null);
  const [optionToDelete, setOptionToDelete] = useState<ConfigOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<ConfigOptionFormInput, unknown, ConfigOptionFormValues>({
    resolver: zodResolver(configOptionSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!sheetOpen) {
      form.reset(defaultValues);
      setEditingOption(null);
    }
  }, [form, sheetOpen]);

  const categoryOptions = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return Array.from(new Set(source.map((item) => item.category))).sort((left, right) =>
      left.localeCompare(right, "fr")
    );
  }, [data]);

  const configOptions = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return source.filter((option) => {
      if (!showInactive && !option.isActive) return false;
      if (selectedCategory !== "ALL" && option.category !== selectedCategory) return false;
      return true;
    });
  }, [data, selectedCategory, showInactive]);

  const openCreateSheet = () => {
    setEditingOption(null);
    form.reset({
      ...defaultValues,
      category: selectedCategory !== "ALL" ? selectedCategory : "",
    });
    setSheetOpen(true);
  };

  const openEditSheet = (option: ConfigOption) => {
    setEditingOption(option);
    form.reset({
      category: option.category,
      code: option.code,
      label: option.label,
      description: option.description || "",
      order: option.order,
      isActive: option.isActive,
      metadataText:
        option.metadata && typeof option.metadata === "object"
          ? JSON.stringify(option.metadata, null, 2)
          : "",
    });
    setSheetOpen(true);
  };

  const submitOption = async (values: ConfigOptionFormValues) => {
    setIsSubmitting(true);
    const metadata = values.metadataText && values.metadataText.trim().length > 0
      ? JSON.parse(values.metadataText)
      : undefined;

    try {
      const response = await fetch(
        editingOption ? `/api/config-options/${editingOption.id}` : "/api/config-options",
        {
          method: editingOption ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: values.category,
            code: values.code,
            label: values.label,
            description: values.description || undefined,
            order: values.order,
            isActive: values.isActive,
            metadata,
          }),
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Impossible d'enregistrer l'option.");
      }

      toast.success(editingOption ? "Option mise à jour." : "Option créée.");
      await mutate();
      setSheetOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteOption = async () => {
    if (!optionToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/config-options/${optionToDelete.id}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Suppression impossible.");
      }

      toast.success("Option supprimée.");
      await mutate();
      setOptionToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<ConfigOption>[] = [
      {
        accessorKey: "label",
        header: "Libellé",
        cell: ({ row }) => (
          <button type="button" className="text-left font-medium text-foreground" onClick={() => openEditSheet(row.original)}>
            {row.original.label}
          </button>
        ),
      },
      {
        accessorKey: "category",
        header: "Catégorie",
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
              onClick={() => setOptionToDelete(row.original)}
            >
              Supprimer
            </Button>
          </div>
        ),
      },
    ];

  return (
    <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
      <div className="flex h-full flex-col gap-6">
        <PageHeader
          title="Options de configuration"
          description="Expose l'API `/api/config-options` pour gérer les référentiels simples par établissement."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Paramètres", href: "/dashboard/settings" },
            { label: "Options de configuration" },
          ]}
          actions={
            <Button className="gap-2" onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              Nouvelle option
            </Button>
          }
        />

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings2 className="h-5 w-5 text-primary" />
                  Référentiels métiers
                </CardTitle>
                <CardDescription>
                  Couvre les options simples encore absentes du frontend malgré des routes backend complètes.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Catégorie</span>
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="ALL">Toutes</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Afficher les inactives</span>
                  <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                </div>
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
            ) : configOptions.length === 0 ? (
              <EmptyState
                icon={SlidersHorizontal}
                title="Aucune option de configuration"
                description="Créez une première option pour couvrir les référentiels simples du tenant."
                action={
                  <Button className="gap-2" onClick={openCreateSheet}>
                    <Plus className="h-4 w-4" />
                    Ajouter une option
                  </Button>
                }
              />
            ) : (
              <DataTable
                columns={columns}
                data={configOptions}
                searchKey="label"
                searchPlaceholder="Rechercher une option..."
                pageSizeOptions={[25, 50, 100]}
              />
            )}
          </CardContent>
        </Card>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full max-w-[480px] p-0 sm:max-w-[480px]">
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border px-6 py-5">
                <SheetTitle>{editingOption ? "Modifier l'option" : "Créer une option"}</SheetTitle>
                <SheetDescription>
                  Les métadonnées facultatives acceptent un JSON valide, stocké tel quel dans Prisma.
                </SheetDescription>
              </SheetHeader>

              <Form {...form}>
                <form className="flex h-full flex-col" onSubmit={form.handleSubmit((values) => void submitOption(values))}>
                  <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <FormField
                      control={form.control}
                      name="label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Libellé</FormLabel>
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
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Catégorie</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="attendance, finance, orientation..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                    <div className="grid gap-4 sm:grid-cols-2">
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
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                            <div>
                              <FormLabel className="text-sm">Option active</FormLabel>
                              <p className="text-xs text-muted-foreground">Les options inactives restent visibles dans l'historique.</p>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="metadataText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Métadonnées JSON</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={8}
                              placeholder='{"threshold": 10, "scope": "internal"}'
                              className="font-mono text-xs"
                            />
                          </FormControl>
                          <FormMessage />
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
                        {isSubmitting ? "Enregistrement..." : editingOption ? "Mettre à jour" : "Créer"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </SheetContent>
        </Sheet>

        <ConfirmActionDialog
          open={Boolean(optionToDelete)}
          onOpenChange={(open) => {
            if (!open) setOptionToDelete(null);
          }}
          title="Supprimer cette option ?"
          description={optionToDelete ? `L'option ${optionToDelete.label} sera supprimée définitivement.` : undefined}
          confirmLabel={isDeleting ? "Suppression..." : "Supprimer"}
          isConfirmLoading={isDeleting}
          onConfirm={() => void deleteOption()}
        />
      </div>
    </PageGuard>
  );
}
