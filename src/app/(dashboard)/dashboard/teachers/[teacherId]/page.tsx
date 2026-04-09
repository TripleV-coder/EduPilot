"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR, { useSWRConfig } from "swr";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  School,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { teacherUpdateSchema } from "@/lib/validations/user";
import { Permission } from "@/lib/rbac/permissions";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { useToast } from "@/hooks/use-toast";

type TeacherFormValues = z.infer<typeof teacherUpdateSchema>;

type TeacherDetail = {
  id: string;
  matricule?: string | null;
  specialization?: string | null;
  hireDate?: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    isActive: boolean;
  };
  subjects?: { id: string; name: string; code: string }[];
  classes?: { id: string; name: string; studentCount: number; classLevel?: { name: string } }[];
  schools?: { id: string; name: string; code: string }[];
};

type SchoolOption = {
  id: string;
  name: string;
  code: string;
};

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export default function TeacherDetailPage() {
  const params = useParams<{ teacherId: string }>();
  const teacherId = params?.teacherId;
  const router = useRouter();
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: teacher, error, isLoading } = useSWR<TeacherDetail>(
    teacherId ? `/api/teachers/${teacherId}` : null,
    fetcher
  );

  const { data: schoolsResponse } = useSWR<any>(
    session?.user?.role === "SUPER_ADMIN" ? "/api/schools?limit=100" : null,
    fetcher
  );

  const schoolOptions: SchoolOption[] = Array.isArray(schoolsResponse?.data)
    ? schoolsResponse.data
    : Array.isArray(schoolsResponse)
      ? schoolsResponse
      : [];

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherUpdateSchema) as any,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      matricule: "",
      specialization: "",
      hireDate: undefined,
      isActive: true,
      primarySchoolId: undefined,
      additionalSchoolIds: [],
    },
  });

  const watchedPrimarySchoolId = form.watch("primarySchoolId");
  const watchedAdditionalSchoolIds = form.watch("additionalSchoolIds") || [];

  useEffect(() => {
    if (!teacher) return;

    const teacherSchoolIds = teacher.schools?.map((school) => school.id) || [];
    const primarySchoolId = teacherSchoolIds[0];

    form.reset({
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      email: teacher.user.email,
      phone: teacher.user.phone || "",
      matricule: teacher.matricule || "",
      specialization: teacher.specialization || "",
      hireDate: teacher.hireDate ? (new Date(teacher.hireDate) as any) : undefined,
      isActive: teacher.user.isActive,
      primarySchoolId,
      additionalSchoolIds: teacherSchoolIds.filter((schoolId) => schoolId !== primarySchoolId),
    });
  }, [teacher, form]);

  const selectedSchoolIds = useMemo(() => {
    return Array.from(new Set([watchedPrimarySchoolId, ...watchedAdditionalSchoolIds].filter(Boolean))) as string[];
  }, [watchedAdditionalSchoolIds, watchedPrimarySchoolId]);

  const toggleSchool = (schoolId: string, checked: boolean) => {
    const primarySchoolId = form.getValues("primarySchoolId");
    const additionalSchoolIds = form.getValues("additionalSchoolIds") || [];

    if (checked) {
      if (!primarySchoolId) {
        form.setValue("primarySchoolId", schoolId, { shouldDirty: true });
        return;
      }

      if (schoolId !== primarySchoolId && !additionalSchoolIds.includes(schoolId)) {
        form.setValue("additionalSchoolIds", [...additionalSchoolIds, schoolId], { shouldDirty: true });
      }
      return;
    }

    if (primarySchoolId === schoolId) {
      const [nextPrimary, ...rest] = additionalSchoolIds;
      form.setValue("primarySchoolId", nextPrimary, { shouldDirty: true });
      form.setValue("additionalSchoolIds", rest, { shouldDirty: true });
      return;
    }

    form.setValue(
      "additionalSchoolIds",
      additionalSchoolIds.filter((id) => id !== schoolId),
      { shouldDirty: true }
    );
  };

  const onSubmit = async (values: TeacherFormValues) => {
    if (!teacherId) return;

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
        matricule: values.matricule || null,
        specialization: values.specialization || null,
        hireDate: values.hireDate ? new Date(values.hireDate).toISOString() : null,
        isActive: values.isActive,
      };

      if (session?.user?.role === "SUPER_ADMIN") {
        payload.primarySchoolId = values.primarySchoolId;
        payload.additionalSchoolIds = values.additionalSchoolIds || [];
      }

      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      await Promise.all([
        mutate(`/api/teachers/${teacherId}`),
        mutate((key) => typeof key === "string" && key.startsWith("/api/teachers")),
      ]);

      toast({
        title: "Enseignant mis à jour",
        description: "Les informations ont été enregistrées.",
      });
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!teacherId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      await mutate((key) => typeof key === "string" && key.startsWith("/api/teachers"));
      router.push("/dashboard/teachers");
      router.refresh();
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <PageGuard permission={Permission.TEACHER_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/teachers">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader
            title={teacher ? `${teacher.user.firstName} ${teacher.user.lastName}` : "Fiche enseignant"}
            description="Informations, affectations et gestion du compte enseignant"
          />
        </div>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              Impossible de charger la fiche enseignant.
            </CardContent>
          </Card>
        ) : null}

        {isLoading || !teacher ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Chargement de la fiche enseignant...
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-primary" />
                    Informations générales
                  </CardTitle>
                  <CardDescription>
                    Mettez à jour les informations de base et l’état du compte.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prénom</FormLabel>
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
                              <FormLabel>Nom</FormLabel>
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
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Téléphone</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="matricule"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Matricule</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
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
                              <FormLabel>Spécialisation</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
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
                                  value={field.value ? toDateInputValue(field.value as any) : ""}
                                  onChange={(event) => field.onChange(event.target.value ? new Date(event.target.value) : undefined)}
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
                            <FormItem className="flex h-full items-center justify-between rounded-md border p-4">
                              <div className="space-y-1">
                                <FormLabel>Compte actif</FormLabel>
                                <FormDescription>
                                  Désactiver le compte empêche la connexion de l’enseignant.
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {session?.user?.role === "SUPER_ADMIN" ? (
                        <div className="space-y-4 rounded-lg border p-4">
                          <div>
                            <h3 className="text-sm font-semibold">Affectations établissements</h3>
                            <p className="text-sm text-muted-foreground">
                              Choisissez les établissements accessibles par cet enseignant et définissez l’école principale.
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {schoolOptions.map((school) => {
                              const checked = selectedSchoolIds.includes(school.id);
                              return (
                                <label
                                  key={school.id}
                                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => toggleSchool(school.id, value === true)}
                                  />
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium">{school.name}</div>
                                    <div className="text-xs text-muted-foreground">{school.code}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          <FormField
                            control={form.control}
                            name="primarySchoolId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Établissement principal</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={(value) => {
                                    const others = selectedSchoolIds.filter((id) => id !== value);
                                    field.onChange(value);
                                    form.setValue("additionalSchoolIds", others, { shouldDirty: true });
                                  }}
                                  disabled={selectedSchoolIds.length === 0}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Choisir l’établissement principal" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {selectedSchoolIds.map((schoolId) => {
                                      const school = schoolOptions.find((option) => option.id === schoolId);
                                      if (!school) return null;
                                      return (
                                        <SelectItem key={school.id} value={school.id}>
                                          {school.name}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between">
                        <div className="flex gap-3">
                          <Link href={`/dashboard/teachers/${teacher.id}/availability`}>
                            <Button type="button" variant="outline">Disponibilités</Button>
                          </Link>
                        </div>
                        <Button type="submit" disabled={isSaving}>
                          <Save className="mr-2 h-4 w-4" />
                          {isSaving ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <School className="h-5 w-5 text-primary" />
                      Affectations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {(teacher.schools || []).length === 0 ? (
                      <p className="text-muted-foreground">Aucun établissement actif.</p>
                    ) : (
                      teacher.schools?.map((school, index) => (
                        <div key={school.id} className="rounded-md border p-3">
                          <div className="font-medium">{school.name}</div>
                          <div className="text-xs text-muted-foreground">{school.code}</div>
                          {index === 0 ? (
                            <div className="mt-2 inline-flex rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                              Principal
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Activité pédagogique
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <div className="mb-2 font-medium">Matières</div>
                      <div className="flex flex-wrap gap-2">
                        {teacher.subjects?.length ? teacher.subjects.map((subject) => (
                          <span key={subject.id} className="rounded bg-muted px-2 py-1 text-xs">
                            {subject.name}
                          </span>
                        )) : <span className="text-muted-foreground">Aucune matière</span>}
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 font-medium">Classes</div>
                      <div className="space-y-2">
                        {teacher.classes?.length ? teacher.classes.map((schoolClass) => (
                          <div key={schoolClass.id} className="rounded border p-3">
                            <div className="font-medium">{schoolClass.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {schoolClass.classLevel?.name || "Niveau"} • {schoolClass.studentCount} élèves
                            </div>
                          </div>
                        )) : <span className="text-muted-foreground">Aucune classe</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-destructive/20 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-destructive">Zone sensible</CardTitle>
                    <CardDescription>
                      La suppression désactive le compte, archive les affectations et retire l’enseignant de ses classes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer l'enseignant
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <ConfirmActionDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              title="Supprimer cet enseignant ?"
              description="Cette action désactivera le compte et retirera l’enseignant de ses affectations pédagogiques."
              confirmLabel="Supprimer"
              isConfirmLoading={isDeleting}
              onConfirm={handleDelete}
            />
          </>
        )}
      </div>
    </PageGuard>
  );
}
