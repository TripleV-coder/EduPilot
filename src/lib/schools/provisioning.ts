import crypto from "crypto";
import { hash } from "bcryptjs";
import { Prisma, SchoolLevel, SchoolType, SiteType, UserRole } from "@prisma/client";

function trimOrNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildSchoolCode(name: string) {
  const prefix = name
    .trim()
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");

  return `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function buildOrganizationCode(name: string) {
  const prefix = name
    .trim()
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");

  return `ORG-${prefix}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function getDefaultAcademicCalendar(referenceDate = new Date()) {
  let startYear = referenceDate.getFullYear();
  // If we are currently between Jan and July, the academic year started LAST year.
  if (referenceDate.getMonth() < 7) {
    startYear -= 1;
  }
  
  const t1Start = new Date(startYear, 8, 1);
  const t1End = new Date(startYear, 11, 20);
  const t2Start = new Date(startYear + 1, 0, 5);
  const t2End = new Date(startYear + 1, 2, 30);
  const t3Start = new Date(startYear + 1, 3, 10);
  const t3End = new Date(startYear + 1, 5, 30);

  return {
    academicYearName: `${startYear}-${startYear + 1}`,
    yearStart: t1Start,
    yearEnd: t3End,
    periods: [
      { name: "Trimestre 1", type: "TRIMESTER" as const, startDate: t1Start, endDate: t1End, sequence: 1 },
      { name: "Trimestre 2", type: "TRIMESTER" as const, startDate: t2Start, endDate: t2End, sequence: 2 },
      { name: "Trimestre 3", type: "TRIMESTER" as const, startDate: t3Start, endDate: t3End, sequence: 3 },
    ],
  };
}

export type ProvisionSchoolInput = {
  name: string;
  organizationId?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  type?: SchoolType | null;
  level?: SchoolLevel | null;
  siteType?: SiteType | null;
  parentSchoolId?: string | null;
};

export type ProvisionSchoolAdminInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type ProvisionOrganizationInput = {
  name: string;
  description?: string | null;
};

export type ProvisionOrganizationMembershipInput = {
  organizationId: string;
  userId: string;
  title?: string | null;
  isOwner?: boolean;
  canManageSites?: boolean;
};

export async function ensureOrganizationIsValid(
  tx: Prisma.TransactionClient,
  organizationId: string | null
) {
  if (!organizationId) {
    return null;
  }

  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, isActive: true },
  });

  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  if (!organization.isActive) {
    throw new Error("ORGANIZATION_INACTIVE");
  }

  return organization;
}

export async function ensureSchoolParentIsValid(
  tx: Prisma.TransactionClient,
  parentSchoolId: string | null
) {
  if (!parentSchoolId) {
    return null;
  }

  const parentSchool = await tx.school.findUnique({
    where: { id: parentSchoolId },
    select: { id: true, siteType: true, parentSchoolId: true, organizationId: true, name: true },
  });

  if (!parentSchool) {
    throw new Error("PARENT_SCHOOL_NOT_FOUND");
  }

  if (parentSchool.siteType !== "MAIN" || parentSchool.parentSchoolId) {
    throw new Error("PARENT_SCHOOL_MUST_BE_MAIN");
  }

  return parentSchool;
}

async function resolveSchoolOrganizationId(
  tx: Prisma.TransactionClient,
  input: {
    parentSchoolId: string | null;
    organizationId: string | null;
  }
) {
  const requestedOrganizationId = trimOrNull(input.organizationId);
  const parentSchool = await ensureSchoolParentIsValid(tx, input.parentSchoolId);
  const organization = await ensureOrganizationIsValid(tx, requestedOrganizationId);

  if (parentSchool?.organizationId) {
    if (organization && organization.id !== parentSchool.organizationId) {
      throw new Error("PARENT_SCHOOL_ORGANIZATION_MISMATCH");
    }

    return parentSchool.organizationId;
  }

  if (parentSchool && requestedOrganizationId) {
    throw new Error("PARENT_SCHOOL_REQUIRES_SHARED_ORGANIZATION");
  }

  return organization?.id ?? null;
}

export async function createOrganization(
  tx: Prisma.TransactionClient,
  input: ProvisionOrganizationInput
) {
  return tx.organization.create({
    data: {
      name: input.name.trim(),
      code: buildOrganizationCode(input.name),
      description: trimOrNull(input.description),
      isActive: true,
    },
  });
}

export async function createSchoolWithDefaults(
  tx: Prisma.TransactionClient,
  input: ProvisionSchoolInput
) {
  const parentSchoolId = trimOrNull(input.parentSchoolId);
  const organizationId = await resolveSchoolOrganizationId(tx, {
    parentSchoolId,
    organizationId: input.organizationId ?? null,
  });

  const calendar = getDefaultAcademicCalendar();

  return tx.school.create({
    data: {
      organizationId,
      name: input.name.trim(),
      code: buildSchoolCode(input.name),
      address: trimOrNull(input.address),
      city: trimOrNull(input.city),
      phone: trimOrNull(input.phone),
      email: trimOrNull(input.email),
      logo: trimOrNull(input.logo),
      type: input.type ?? "PRIVATE",
      level: input.level ?? "PRIMARY",
      siteType: parentSchoolId ? "ANNEXE" : (input.siteType ?? "MAIN"),
      parentSchoolId,
      isActive: true,
      academicConfig: {
        create: {
          periodType: "TRIMESTER",
          periodsCount: 3,
          maxGrade: 20,
          passingGrade: 10,
        },
      },
      academicYears: {
        create: {
          name: calendar.academicYearName,
          startDate: calendar.yearStart,
          endDate: calendar.yearEnd,
          isCurrent: true,
          periods: {
            create: calendar.periods,
          },
        },
      },
    },
    include: {
      academicConfig: true,
      organization: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      parentSchool: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function createSchoolAdminUser(
  tx: Prisma.TransactionClient,
  schoolId: string,
  input: ProvisionSchoolAdminInput
) {
  const hashedPassword = await hash(input.password, 12);

  return tx.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      password: hashedPassword,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: UserRole.SCHOOL_ADMIN,
      roles: [UserRole.SCHOOL_ADMIN],
      schoolId,
      isActive: true,
      mustChangePassword: true,
    },
  });
}

export async function createOrganizationMembership(
  tx: Prisma.TransactionClient,
  input: ProvisionOrganizationMembershipInput
) {
  return tx.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    create: {
      organizationId: input.organizationId,
      userId: input.userId,
      title: trimOrNull(input.title),
      isOwner: input.isOwner ?? false,
      canManageSites: input.canManageSites ?? true,
    },
    update: {
      title: trimOrNull(input.title),
      isOwner: input.isOwner ?? false,
      canManageSites: input.canManageSites ?? true,
    },
  });
}
