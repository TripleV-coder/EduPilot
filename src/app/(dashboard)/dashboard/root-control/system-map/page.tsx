"use client";

import Link from "next/link";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/fetcher";
import {
  Building2,
  GitBranch,
  Link2,
  Loader2,
  Network,
  School,
  Search,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";

type SchoolNode = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  isActive: boolean;
  siteType: "MAIN" | "ANNEXE";
  organizationId: string | null;
  organizationName: string | null;
  parentSchoolId: string | null;
  parentSchoolName: string | null;
  stats: {
    users: number;
    students: number;
    teachers: number;
    classes: number;
  };
};

type OrganizationCluster = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  schoolCount: number;
  mainSiteCount: number;
  annexSiteCount: number;
  schools: SchoolNode[];
};

type RootSystemMap = {
  generatedAt: string;
  totals: {
    organizations: number;
    schools: number;
    independentSchools: number;
    organizationLinks: number;
    hierarchyLinks: number;
    totalLinks: number;
  };
  organizations: OrganizationCluster[];
  independentSchools: SchoolNode[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function NodeStats({ school }: { school: SchoolNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span>{school.stats.users} users</span>
      <span className="text-border">•</span>
      <span>{school.stats.students} eleves</span>
      <span className="text-border">•</span>
      <span>{school.stats.teachers} enseignants</span>
      <span className="text-border">•</span>
      <span>{school.stats.classes} classes</span>
    </div>
  );
}

export default function RootSystemMapPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading, error } = useSWR<RootSystemMap>("/api/root/system-map", fetcher);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrganizations = useMemo(() => {
    if (!data) return [];
    if (!normalizedQuery) return data.organizations;
    return data.organizations
      .map((organization) => ({
        ...organization,
        schools: organization.schools.filter((school) =>
          [school.name, school.code, school.city || "", organization.name, organization.code]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        ),
      }))
      .filter((organization) =>
        organization.name.toLowerCase().includes(normalizedQuery) ||
        organization.code.toLowerCase().includes(normalizedQuery) ||
        organization.schools.length > 0
      );
  }, [data, normalizedQuery]);

  const filteredIndependentSchools = useMemo(() => {
    if (!data) return [];
    if (!normalizedQuery) return data.independentSchools;
    return data.independentSchools.filter((school) =>
      [school.name, school.code, school.city || ""].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [data, normalizedQuery]);

  return (
    <PageGuard roles={["SUPER_ADMIN"]}>
      <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
        <PageHeader
          title="Cartographie Systeme Root"
          description="Topologie complete des organisations, des ecoles rattachees et des etablissements independants."
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Root Control", href: "/dashboard/root-control" },
            { label: "Cartographie" },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Organisations</p>
                <p className="mt-1 text-2xl font-black">{data?.totals.organizations ?? 0}</p>
              </div>
              <Network className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Ecoles</p>
                <p className="mt-1 text-2xl font-black">{data?.totals.schools ?? 0}</p>
              </div>
              <School className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Independantes</p>
                <p className="mt-1 text-2xl font-black">{data?.totals.independentSchools ?? 0}</p>
              </div>
              <Building2 className="h-5 w-5 text-warning" />
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Liens Org</p>
                <p className="mt-1 text-2xl font-black">{data?.totals.organizationLinks ?? 0}</p>
              </div>
              <Link2 className="h-5 w-5 text-success" />
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Liens Hierarchie</p>
                <p className="mt-1 text-2xl font-black">{data?.totals.hierarchyLinks ?? 0}</p>
              </div>
              <GitBranch className="h-5 w-5 text-primary" />
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 pl-9"
                placeholder="Rechercher une organisation, une ecole, une ville..."
                aria-label="Rechercher dans la cartographie"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Workflow className="h-4 w-4" />
              {data ? `Derniere mise a jour: ${formatDate(data.generatedAt)}` : "Chargement..."}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card className="border-border/70 bg-card">
            <CardContent className="flex min-h-[260px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : error || !data ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4" />
              Impossible de charger la cartographie systeme.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-border/70 bg-card">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  <Network className="h-4 w-4 text-primary" />
                  Organisations et sites relies
                </CardTitle>
                <CardDescription>
                  Chaque bloc represente une organisation. Les lignes verticales symbolisent le lien organisation → ecole.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-5">
                {filteredOrganizations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    Aucun regroupement organisationnel ne correspond au filtre courant.
                  </div>
                ) : (
                  filteredOrganizations.map((organization) => (
                    <div key={organization.id} className="rounded-xl border border-border/70 bg-background/40 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold">{organization.name}</h3>
                            <Badge variant="outline" className="font-mono text-[10px]">{organization.code}</Badge>
                            <Badge
                              variant="outline"
                              className={organization.isActive ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}
                            >
                              {organization.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {organization.schoolCount} sites ({organization.mainSiteCount} principaux, {organization.annexSiteCount} annexes)
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="h-10">
                          <Link href={`/dashboard/organization?organizationId=${encodeURIComponent(organization.id)}`}>
                            Ouvrir le cockpit
                          </Link>
                        </Button>
                      </div>

                      <div className="space-y-2 border-l-2 border-primary/30 pl-4">
                        {organization.schools.map((school) => (
                          <div key={school.id} className="rounded-lg border border-border/60 bg-card p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{school.name}</p>
                              <Badge variant="outline" className="text-[10px]">{school.siteType === "MAIN" ? "Site principal" : "Annexe"}</Badge>
                              <Badge variant="secondary" className="font-mono text-[10px]">{school.code}</Badge>
                              {school.city ? <span className="text-xs text-muted-foreground">{school.city}</span> : null}
                            </div>
                            {school.parentSchoolName ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Lie a: {school.parentSchoolName}
                              </p>
                            ) : null}
                            <div className="mt-2">
                              <NodeStats school={school} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-muted-foreground">
                  <Building2 className="h-4 w-4 text-warning" />
                  Ecoles independantes (hors organisation)
                </CardTitle>
                <CardDescription>
                  Ces etablissements ne sont rattaches a aucune organisation. Ils restent geres directement au niveau tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                {filteredIndependentSchools.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Aucune ecole independante detectee pour ce filtre.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {filteredIndependentSchools.map((school) => (
                      <div key={school.id} className="rounded-lg border border-border/60 bg-background/30 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{school.name}</p>
                          <Badge variant="secondary" className="font-mono text-[10px]">{school.code}</Badge>
                          <Badge variant="outline" className="text-[10px]">{school.siteType === "MAIN" ? "Site principal" : "Annexe"}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {school.city || "Ville non renseignee"}
                          {school.parentSchoolName ? ` • Lie a ${school.parentSchoolName}` : ""}
                        </p>
                        <div className="mt-2">
                          <NodeStats school={school} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageGuard>
  );
}
