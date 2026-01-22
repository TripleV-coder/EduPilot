import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const createDataRequestSchema = z.object({
  requestType: z.enum(["EXPORT", "RECTIFICATION", "DELETION", "PORTABILITY"]),
  notes: z.string().optional(),
});

/**
 * GET /api/compliance/data-requests
 * List data access requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based filtering
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role);

    if (!isAdmin) {
      // Non-admins can only see their own requests
      where.userId = session.user.id;
    }

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.dataAccessRequest.findMany({
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
          processor: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { requestedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.dataAccessRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching data requests:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des demandes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/data-requests
 * Create a new data access request (GDPR right)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createDataRequestSchema.parse(body);

    // Check if user already has a pending request of same type
    const existingRequest = await prisma.dataAccessRequest.findFirst({
      where: {
        userId: session.user.id,
        requestType: validatedData.requestType,
        status: {
          in: ["PENDING", "IN_PROGRESS"],
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Vous avez déjà une demande en cours de ce type" },
        { status: 400 }
      );
    }

    const dataRequest = await prisma.dataAccessRequest.create({
      data: {
        userId: session.user.id,
        requestType: validatedData.requestType,
        notes: validatedData.notes,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Create notification for admins
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
        },
      },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "WARNING",
          title: "Nouvelle demande RGPD",
          message: `${session.user.firstName} ${session.user.lastName} a soumis une demande de type: ${validatedData.requestType}`,
          link: `/compliance/data-requests/${dataRequest.id}`,
        })),
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_DATA_REQUEST",
        entity: "DataAccessRequest",
        entityId: dataRequest.id,
        newValues: validatedData,
      },
    });

    return NextResponse.json(dataRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" creating data request:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la demande" },
      { status: 500 }
    );
  }
}
