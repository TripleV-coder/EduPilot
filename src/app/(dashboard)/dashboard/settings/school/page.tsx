"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { useSchool } from "@/components/providers/school-provider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Building2, Image as ImageIcon, Loader2, Mail, MapPin, Phone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetcher } from "@/lib/fetcher";
import { toast } from "@/hooks/use-toast";

type SchoolProfile = {
  id: string;
  name: string;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
};

const EMPTY_FORM: SchoolProfile = {
  id: "",
  name: "",
  logo: "",
  email: "",
  phone: "",
  address: "",
  city: "",
};

export default function SchoolProfilePage() {
  const { schoolId } = useSchool();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<SchoolProfile>(EMPTY_FORM);
  const { data: cities } = useSWR("/api/reference/cities", fetcher);
  const { data: school, error, isLoading, mutate } = useSWR<SchoolProfile>(
    schoolId ? `/api/schools/${schoolId}` : null,
    fetcher
  );

  useEffect(() => {
    if (!school) return;
    setForm({
      id: school.id,
      name: school.name || "",
      logo: school.logo || "",
      email: school.email || "",
      phone: school.phone || "",
      address: school.address || "",
      city: school.city || "",
    });
  }, [school]);

  const handleFieldChange = (field: keyof SchoolProfile, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!schoolId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/schools/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          logo: form.logo || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Erreur lors de la mise à jour de l'établissement");
      }

      await mutate();
      toast({
        title: "Profil mis à jour",
        description: "Les informations de l'établissement ont été enregistrées.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Mise à jour impossible",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageGuard permission={[Permission.SCHOOL_UPDATE]}>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Profil de l'Établissement"
          description="Gérez l'identité de l'école active et ses coordonnées officielles."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Paramètres", href: "/dashboard/settings" },
            { label: "Profil École" },
          ]}
        />

        {!schoolId ? (
          <Card className="border-border shadow-sm">
            <CardContent className="py-10 text-sm text-muted-foreground">
              Aucun établissement actif n'est sélectionné.
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-border shadow-sm">
            <CardContent className="py-10 text-sm text-destructive">
              Impossible de charger les informations de l'établissement.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card className="border-border shadow-sm">
            <CardContent className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <form className="grid gap-6" onSubmit={handleSubmit}>
            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Identité visuelle
                </CardTitle>
                <CardDescription>URL du logo et nom officiel affichés dans les documents.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="schoolName" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    Nom officiel
                  </Label>
                  <Input
                    id="schoolName"
                    value={form.name}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                    className="font-semibold bg-background"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="logo">Logo (URL)</Label>
                  <Input
                    id="logo"
                    type="url"
                    value={form.logo || ""}
                    onChange={(event) => handleFieldChange("logo", event.target.value)}
                    className="bg-background"
                    placeholder="https://..."
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Coordonnées
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Email institutionnel
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email || ""}
                      onChange={(event) => handleFieldChange("email", event.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Téléphone principal
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone || ""}
                      onChange={(event) => handleFieldChange("phone", event.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse physique</Label>
                  <Textarea
                    id="address"
                    value={form.address || ""}
                    onChange={(event) => handleFieldChange("address", event.target.value)}
                    className="bg-background min-h-[80px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={form.city || ""}
                    onChange={(event) => handleFieldChange("city", event.target.value)}
                    list="cities-list"
                    className="bg-background"
                  />
                  <datalist id="cities-list">
                    {Array.isArray(cities) && cities.map((city: string) => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t border-border mt-2 py-4 flex justify-end">
                <Button type="submit" className="gap-2 shadow-sm" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer le profil
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}
      </div>
    </PageGuard>
  );
}
