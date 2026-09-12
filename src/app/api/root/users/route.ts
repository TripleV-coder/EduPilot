import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { isRootUserEmail } from "@/lib/security/root-access";
import { createPaginatedResponse, createApiHandler } from "@/lib/api/api-helpers";
import { getListWindow } from "@/lib/api/list-window";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    try {
      // Lot 3 : curseur sur la date de création par défaut, ?page= toléré (ancien format).
      const list = getListWindow(request, { sortField: "createdAt", direction: "desc" });
      const url = new URL(request.url);
      const search = url.searchParams.get("search") || "";
      const role = url.searchParams.get("role");
      const isActive = url.searchParams.get("isActive");
      const schoolId = url.searchParams.get("schoolId");

      // Restrict Super Admin to only see other Super Admins and School Admins (GDPR Compliance)
      const allowedRoles: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
      
      const where: Prisma.UserWhereInput = {
        role: { in: allowedRoles }
      };
      
      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ];
      }
      
      if (role) {
        if (allowedRoles.includes(role as UserRole)) {
          where.role = role as UserRole;
        }
      }
      
      if (isActive !== null) where.isActive = isActive === "true";
      if (schoolId) where.schoolId = schoolId;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: list.where(where),
          skip: list.skip,
          take: list.take,
          orderBy: list.orderBy,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            roles: true,
            isActive: true,
            schoolId: true,
            createdAt: true,
            updatedAt: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            _count: {
              select: {
                sessions: true,
              },
            },
          },
        }),
        list.needsTotal ? prisma.user.count({ where }) : Promise.resolve(undefined),
      ]);

      const rows = users.map((u) => ({
        ...u,
        sessionCount: u._count.sessions,
        _count: undefined,
      }));
      if (list.offset) return createPaginatedResponse(rows, total ?? 0, list.offset);
      return NextResponse.json(list.page(rows, (user) => user.createdAt, total));
    } catch (error) {
      logger.error("Error fetching root users", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des utilisateurs" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN"] },
);

export const PATCH = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    try {
      const body = await request.json();
      const { id, ...data } = body;

      if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 });
      }

      // Ne pas permettre la modification de l'email root
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (existingUser && isRootUserEmail(existingUser.email)) {
        return NextResponse.json(
          { error: "Modification de l'utilisateur root non autorisée" },
          { status: 403 }
        );
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });

      return NextResponse.json({ data: user });
    } catch (error) {
      logger.error("Error updating user", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour de l'utilisateur" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN"] },
);
