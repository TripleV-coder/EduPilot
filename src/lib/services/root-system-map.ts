import prisma from "@/lib/prisma";

type NodeKind = "ORGANIZATION" | "SCHOOL";
type LinkKind = "ORGANIZATION_MEMBER" | "PARENT_CHILD";

export type SystemMapSchoolNode = {
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

export type SystemMapOrganizationCluster = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  schoolCount: number;
  mainSiteCount: number;
  annexSiteCount: number;
  schools: SystemMapSchoolNode[];
};

export type SystemMapLink = {
  id: string;
  sourceType: NodeKind;
  sourceId: string;
  targetType: NodeKind;
  targetId: string;
  kind: LinkKind;
};

export type RootSystemMapPayload = {
  generatedAt: string;
  totals: {
    organizations: number;
    schools: number;
    independentSchools: number;
    organizationLinks: number;
    hierarchyLinks: number;
    totalLinks: number;
  };
  organizations: SystemMapOrganizationCluster[];
  independentSchools: SystemMapSchoolNode[];
  links: SystemMapLink[];
};

export async function getRootSystemMap(): Promise<RootSystemMapPayload> {
  const [organizations, schools, studentCounts, userCounts, teacherCounts] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    }),
    prisma.school.findMany({
      orderBy: [{ organizationId: "asc" }, { siteType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        isActive: true,
        siteType: true,
        organizationId: true,
        parentSchoolId: true,
        organization: {
          select: {
            name: true,
          },
        },
        parentSchool: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            classes: true,
          },
        },
      },
    }),
    prisma.studentProfile.groupBy({
      by: ["schoolId"],
      _count: true,
    }),
    prisma.user.groupBy({
      by: ["schoolId"],
      _count: true,
    }),
    prisma.teacherProfile.groupBy({
      by: ["schoolId"],
      where: { deletedAt: null },
      _count: true,
    }),
  ]);

  const studentsBySchoolId = new Map(studentCounts.map((row) => [row.schoolId, row._count]));
  const usersBySchoolId = new Map(
    userCounts.filter((row) => row.schoolId !== null).map((row) => [row.schoolId, row._count] as const)
  );
  const teachersBySchoolId = new Map(teacherCounts.map((row) => [row.schoolId, row._count]));

  const schoolNodes: SystemMapSchoolNode[] = schools.map((school) => ({
    id: school.id,
    name: school.name,
    code: school.code,
    city: school.city,
    isActive: school.isActive,
    siteType: school.siteType,
    organizationId: school.organizationId,
    organizationName: school.organization?.name || null,
    parentSchoolId: school.parentSchoolId,
    parentSchoolName: school.parentSchool?.name || null,
    stats: {
      users: usersBySchoolId.get(school.id) ?? 0,
      students: studentsBySchoolId.get(school.id) ?? 0,
      teachers: teachersBySchoolId.get(school.id) ?? 0,
      classes: school._count.classes,
    },
  }));

  const schoolsByOrganizationId = new Map<string, SystemMapSchoolNode[]>();
  for (const school of schoolNodes) {
    if (!school.organizationId) continue;
    const current = schoolsByOrganizationId.get(school.organizationId) || [];
    current.push(school);
    schoolsByOrganizationId.set(school.organizationId, current);
  }

  const organizationClusters: SystemMapOrganizationCluster[] = organizations.map((organization) => {
    const orgSchools = (schoolsByOrganizationId.get(organization.id) || []).sort((a, b) => {
      if (a.siteType !== b.siteType) return a.siteType === "MAIN" ? -1 : 1;
      return a.name.localeCompare(b.name, "fr-FR");
    });
    return {
      id: organization.id,
      name: organization.name,
      code: organization.code,
      isActive: organization.isActive,
      schoolCount: orgSchools.length,
      mainSiteCount: orgSchools.filter((school) => school.siteType === "MAIN").length,
      annexSiteCount: orgSchools.filter((school) => school.siteType === "ANNEXE").length,
      schools: orgSchools,
    };
  });

  const independentSchools = schoolNodes
    .filter((school) => !school.organizationId)
    .sort((a, b) => a.name.localeCompare(b.name, "fr-FR"));

  const links: SystemMapLink[] = [];
  for (const cluster of organizationClusters) {
    for (const school of cluster.schools) {
      links.push({
        id: `org:${cluster.id}->school:${school.id}`,
        sourceType: "ORGANIZATION",
        sourceId: cluster.id,
        targetType: "SCHOOL",
        targetId: school.id,
        kind: "ORGANIZATION_MEMBER",
      });
      if (school.parentSchoolId) {
        links.push({
          id: `school:${school.parentSchoolId}->school:${school.id}`,
          sourceType: "SCHOOL",
          sourceId: school.parentSchoolId,
          targetType: "SCHOOL",
          targetId: school.id,
          kind: "PARENT_CHILD",
        });
      }
    }
  }
  for (const school of independentSchools) {
    if (!school.parentSchoolId) continue;
    links.push({
      id: `school:${school.parentSchoolId}->school:${school.id}`,
      sourceType: "SCHOOL",
      sourceId: school.parentSchoolId,
      targetType: "SCHOOL",
      targetId: school.id,
      kind: "PARENT_CHILD",
    });
  }

  const organizationLinks = links.filter((link) => link.kind === "ORGANIZATION_MEMBER").length;
  const hierarchyLinks = links.filter((link) => link.kind === "PARENT_CHILD").length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      organizations: organizationClusters.length,
      schools: schoolNodes.length,
      independentSchools: independentSchools.length,
      organizationLinks,
      hierarchyLinks,
      totalLinks: links.length,
    },
    organizations: organizationClusters,
    independentSchools,
    links,
  };
}
