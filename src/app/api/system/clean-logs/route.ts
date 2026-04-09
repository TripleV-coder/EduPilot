import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";

// GET /api/system/clean-logs
// This endpoint deletes Audit logs older than 90 days.
// Can be called via a cron job (e.g. Vercel Cron).
export const GET = createApiHandler(
  async (_request, _context) => {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      logger.info(`Audit logs cleanup task completed. Deleted ${result.count} old records.`);

      return NextResponse.json({ 
        success: true, 
        message: "Les logs plus anciens que 90 jours ont été purgés avec succès.",
        clearedRecords: result.count 
      });
    } catch (error) {
      logger.error("Error during audit logs cleanup:", error as Error);
      return NextResponse.json({ error: "Erreur pendant le nettoyage des logs" }, { status: 500 });
    }
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN"],
  }
);
