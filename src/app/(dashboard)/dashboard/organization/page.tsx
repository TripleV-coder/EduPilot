"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Activity,
  AlertCircle,
  BookOpen,
  Building2,
  GraduationCap,
  Layers3,
  Network,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetcher } from "@/lib/fetcher";
import type {
  OrganizationComparisonRow,
  OrganizationDashboardData,
  OrganizationSiteSummary,
} from "@/lib/services/organization-dashboard";

type OrganizationOption = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  membership: {
    isOwner: boolean;
    canManageSites: boolean;
  } | null;
  _count: {
    schools: number;
    memberships: number;
  };
};

type PaginatedOrganizations = {
  data: OrganizationOption[];
};

function formatAverage(value: number) {
  return `${value.toFixed(2)}/20`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/60 bg-white shadow-sm">
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function SiteStatusBadge({ site }: { site: OrganizationSiteSummary }) {
  if (site.comparisonNote) {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
        Non comparable
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
      Comparable
    </Badge>
  );
}

function ComparisonTable({
  title,
  description,
  icon: Icon,
  rows,
  emptyLabel,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: OrganizationComparisonRow[];
  emptyLabel: string;
}) {
  return (
    <Card className="border-border/60 bg-white shadow-sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <EmptyState label={emptyLabel} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-center">Moyenne réseau</th>
                  <th className="px-4 py-3 text-center">Écart</th>
                  <th className="px-4 py-3 text-center">Couverture</th>
                  <th className="px-4 py-3 text-left">Sites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-bold text-foreground">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.sampleSize} échantillons consolidés</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center font-black text-foreground">
                      {formatAverage(row.organizationAverage)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {formatAverage(row.delta)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-foreground">
                      {row.coverage} sites
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {row.sites.slice(0, 4).map((site) => (
                          <span
                            key={`${row.key}-${site.schoolId}`}
                            className="rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground"
                          >
                            {site.schoolName}: {formatAverage(site.averageGrade)}
                          </span>
                        ))}
                        {row.sites.length > 4 ? (
                          <span className="rounded-full border border-dashed border-border/80 px-2.5 py-1 text-xs text-muted-foreground">
                            +{row.sites.length - 4} autres
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrganizationDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const canAccess = session?.user?.role === "SUPER_ADMIN" || session?.user?.isOrganizationManager === true;

  const { data: organizationsData, isLoading: organizationsLoading } = useSWR<PaginatedOrganizations>(
    canAccess ? "/api/organizations?limit=100" : null,
    fetcher
  );

  const organizations = organizationsData?.data || [];
  const requestedOrganizationId = searchParams.get("organizationId");
  const selectedOrganization =
    organizations.find((organization) => organization.id === requestedOrganizationId) || organizations[0] || null;

  const organizationOverviewKey = selectedOrganization
    ? `/api/analytics/organization/overview?organizationId=${encodeURIComponent(selectedOrganization.id)}`
    : null;

  const {
    data: overview,
    error: overviewError,
    isLoading: overviewLoading,
  } = useSWR<OrganizationDashboardData>(organizationOverviewKey, fetcher);

  if (status === "loading") {
    return <EmptyState label="Chargement du contexte utilisateur..." />;
  }

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <Card className="border-amber-300 bg-amber-50 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-amber-600" />
            <div className="space-y-2">
              <h1 className="text-xl font-black text-foreground">Accès organisation refusé</h1>
              <p className="text-sm text-muted-foreground">
                Ce cockpit est réservé aux chefs d&apos;organisation et aux super administrateurs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (organizationsLoading) {
    return <EmptyState label="Chargement des organisations accessibles..." />;
  }

  if (organizations.length === 0 || !selectedOrganization) {
    return (
      <div className="mx-auto max-w-4xl py-16">
        <Card className="border-border/60 bg-white shadow-sm">
          <CardContent className="py-14">
            <EmptyState label="Aucune organisation gérable n'est disponible pour ce compte." />
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOrganizationChange = (organizationId: string) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("organizationId", organizationId);
    router.replace(`/dashboard/organization?${nextSearchParams.toString()}`);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 animate-in fade-in duration-700 pb-10">
      <PageHeader
        title="Pilotage d’Organisation"
        description="Comparaison multisites stricte par réseau, avec périmètre harmonisé sur l’année académique de référence."
        breadcrumbs={[
          { label: "Tableau de bord", href: "/dashboard" },
          { label: "Organisation" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <div className="w-[280px]">
              <Select value={selectedOrganization.id} onValueChange={handleOrganizationChange}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue placeholder="Choisir une organisation" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
          {selectedOrganization.code}
        </Badge>
        <Badge variant="outline">{selectedOrganization._count.schools} sites</Badge>
        <Badge variant="outline">{selectedOrganization._count.memberships} responsables</Badge>
        {selectedOrganization.membership?.isOwner ? (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
            Propriétaire organisation
          </Badge>
        ) : null}
        {selectedOrganization.membership?.canManageSites ? (
          <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-700">
            Gestion multisites
          </Badge>
        ) : null}
      </div>

      {overviewError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-center gap-3 py-5 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {(overviewError as Error).message || "Impossible de charger le cockpit organisation."}
          </CardContent>
        </Card>
      ) : null}

      {overviewLoading || !overview ? (
        <Card className="border-border/60 bg-white shadow-sm">
          <CardContent className="py-14">
            <EmptyState label="Chargement des indicateurs organisation..." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard
              title="Sites"
              value={String(overview.summary.totalSites)}
              subtitle={`${overview.summary.activeSites} actifs, ${overview.summary.comparableSites} comparables`}
              icon={Building2}
            />
            <SummaryCard
              title="Élèves"
              value={overview.summary.totalStudents.toLocaleString("fr-FR")}
              subtitle="Échantillon comparable consolidé"
              icon={Users}
            />
            <SummaryCard
              title="Enseignants"
              value={overview.summary.totalTeachers.toLocaleString("fr-FR")}
              subtitle="Total réseau"
              icon={GraduationCap}
            />
            <SummaryCard
              title="Moyenne"
              value={formatAverage(overview.summary.averageGrade)}
              subtitle="Moyenne générale réseau"
              icon={Activity}
            />
            <SummaryCard
              title="Réussite"
              value={formatPercent(overview.summary.passRate)}
              subtitle="Taux d’admission agrégé"
              icon={Network}
            />
            <SummaryCard
              title="Présence"
              value={formatPercent(overview.summary.attendanceRate)}
              subtitle={`${overview.summary.criticalRiskCount} élèves en risque critique`}
              icon={ShieldAlert}
            />
          </div>

          <Card className="border-border/60 bg-slate-950 text-slate-100 shadow-sm">
            <CardContent className="grid gap-4 p-6 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Référence de comparaison
                </p>
                <p className="text-lg font-black">{overview.reference.academicYearName}</p>
                <p className="text-xs text-slate-400">
                  Site de référence: {overview.reference.schoolName}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Période
                </p>
                <p className="text-lg font-black">{overview.reference.periodName || "Dernier état annuel"}</p>
                <p className="text-xs text-slate-400">
                  Harmonisation par année puis par période quand elle est demandée.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Non comparables
                </p>
                <p className="text-lg font-black">{overview.reference.nonComparableSiteCount}</p>
                <p className="text-xs text-slate-400">
                  Sites exclus des moyennes réseau faute d’équivalence stricte.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-white shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                Performance par site
              </CardTitle>
              <CardDescription>
                Lecture homogène par site, en excluant automatiquement les établissements non alignés sur le référentiel.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Site</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-center">Élèves</th>
                      <th className="px-4 py-3 text-center">Moyenne</th>
                      <th className="px-4 py-3 text-center">Réussite</th>
                      <th className="px-4 py-3 text-center">Présence</th>
                      <th className="px-4 py-3 text-left">Matière forte</th>
                      <th className="px-4 py-3 text-left">Remarque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {overview.sites.map((site) => (
                      <tr key={site.id} className="align-top">
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-foreground">{site.name}</p>
                              <Badge variant="outline">{site.siteType === "MAIN" ? "Principal" : "Annexe"}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {site.city || "Ville non renseignée"} · {site.academicYearName || "Sans année équivalente"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <SiteStatusBadge site={site} />
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-foreground">
                          {site.studentCount.toLocaleString("fr-FR")}
                        </td>
                        <td className="px-4 py-4 text-center font-black text-foreground">
                          {formatAverage(site.averageGrade)}
                        </td>
                        <td className="px-4 py-4 text-center">{formatPercent(site.passRate)}</td>
                        <td className="px-4 py-4 text-center">{formatPercent(site.attendanceRate)}</td>
                        <td className="px-4 py-4">
                          <span className="text-xs font-medium text-foreground">
                            {site.topSubject || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs text-muted-foreground">
                            {site.comparisonNote || "Comparable sans réserve."}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <ComparisonTable
              title="Comparaison par promo"
              description="Regroupe les niveaux équivalents entre sites selon le code ou le nom du niveau."
              icon={Layers3}
              rows={overview.classLevels}
              emptyLabel="Aucune promo strictement comparable n’a été détectée."
            />
            <ComparisonTable
              title="Comparaison par classe"
              description="Rapproche les classes portant le même identifiant logique dans des niveaux équivalents."
              icon={BookOpen}
              rows={overview.classes}
              emptyLabel="Aucune classe strictement comparable n’a été détectée."
            />
            <ComparisonTable
              title="Comparaison par matière"
              description="Consolide les matières équivalentes à partir du code matière ou, à défaut, du libellé."
              icon={GraduationCap}
              rows={overview.subjects}
              emptyLabel="Aucune matière strictement comparable n’a été détectée."
            />
          </div>
        </>
      )}
    </div>
  );
}

