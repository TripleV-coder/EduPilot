"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, User, Bell, Shield, Palette, Globe, GraduationCap, Calendar, Building, BookOpen, SlidersHorizontal, Tags } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const personalSettings = [
  { icon: User, title: "Profil", desc: "Informations personnelles et photo", href: "/dashboard/settings/profile", color: "text-primary", bg: "bg-primary/10" },
  { icon: Bell, title: "Notifications", desc: "Préférences d'alertes", href: "/dashboard/settings/notifications", color: "text-secondary", bg: "bg-secondary/10" },
  { icon: Shield, title: "Sécurité", desc: "Mot de passe et 2FA", href: "/dashboard/settings/security", color: "text-accent", bg: "bg-accent/10" },
  { icon: Palette, title: "Apparence", desc: "Thème et préférences", href: "/dashboard/settings/appearance", color: "text-info", bg: "bg-info/10" },
  { icon: Globe, title: "Langue & Région", desc: "Fuseau horaire et langue", href: "/dashboard/settings/locale", color: "text-warning", bg: "bg-warning/10" },
];

const adminSettings = [
  { icon: Calendar, title: "Années Académiques", desc: "Gérer les années et périodes", href: "/dashboard/settings/academic", color: "text-primary", bg: "bg-primary/10" },
  { icon: GraduationCap, title: "Niveaux d'Étude", desc: "Configuration des classes", href: "/dashboard/settings/class-levels", color: "text-secondary", bg: "bg-secondary/10" },
  { icon: BookOpen, title: "Matières & Évaluations", desc: "Matières, coefficients et catégories", href: "/dashboard/settings/subjects", color: "text-accent", bg: "bg-accent/10" },
  { icon: Tags, title: "Catégories de matières", desc: "Référentiel des familles de matières", href: "/dashboard/settings/subject-categories", color: "text-primary", bg: "bg-primary/10" },
  { icon: SlidersHorizontal, title: "Options de configuration", desc: "Référentiels métiers simples du tenant", href: "/dashboard/settings/config-options", color: "text-secondary", bg: "bg-secondary/10" },
  { icon: Shield, title: "RGPD & Conformité", desc: "Politiques, consentements et données", href: "/dashboard/settings/compliance", color: "text-info", bg: "bg-info/10" },
  { icon: Building, title: "Profil Établissement", desc: "Informations de l'école", href: "/dashboard/settings/school", color: "text-primary", bg: "bg-primary/10" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const isGlobalSuperAdmin = session?.user?.role === "SUPER_ADMIN" && !session?.user?.schoolId;
  const isAdmin = (session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "SCHOOL_ADMIN" || session?.user?.role === "DIRECTOR") && !isGlobalSuperAdmin;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Paramètres"
        description="Gérer les préférences de votre compte et la configuration de l'établissement."
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Paramètres" },
        ]}
      />

      {/* Paramètres Personnels */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Paramètres Personnels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personalSettings.map((section) => (
            <Link key={section.title} href={section.href}>
              <Card className="border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4 pb-3">
                  <div className={`w-10 h-10 rounded-xl ${section.bg} flex items-center justify-center shrink-0`}>
                    <section.icon className={`w-5 h-5 ${section.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">{section.desc}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Paramètres Établissement (Admins Only) */}
      {isAdmin && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h2 className="text-xl font-bold tracking-tight">Administration Établissement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminSettings.map((section) => (
              <Link key={section.title} href={section.href}>
                <Card className="border-primary/20 bg-primary/5 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center gap-4 pb-3">
                    <div className={`w-10 h-10 rounded-xl ${section.bg} flex items-center justify-center shrink-0`}>
                      <section.icon className={`w-5 h-5 ${section.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
                      <CardDescription className="text-xs mt-1">{section.desc}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center pt-8">
        <Settings className="inline w-4 h-4 mr-1 opacity-50" />
        Configuration centralisée EduPilot.
      </p>
    </div>
  );
}
