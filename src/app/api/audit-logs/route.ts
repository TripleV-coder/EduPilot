import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/audit-logs
 * List audit logs with filtering (Admin only)
 */
export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const entity = searchParams.get("entity");
    const entityId = searchParams.get("entityId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    // Filter by userId
    if (userId) {
      where.userId = userId;
    }

    // Filter by action (partial match)
    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }

    // Filter by entity
    if (entity) {
      where.entity = entity;
    }

    // Filter by entityId
    if (entityId) {
      where.entityId = entityId;
    }

    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Global search across action and entity
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
      ];
    }

    // For SCHOOL_ADMIN, only show logs for their school's users
    if (session.user.role === "SCHOOL_ADMIN" && getActiveSchoolId(session)) {
      const schoolUserIds = await prisma.user.findMany({
        where: { schoolId: getActiveSchoolId(session) },
        select: { id: true },
      });
      where.userId = { in: schoolUserIds.map((u) => u.id) };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  }
);
