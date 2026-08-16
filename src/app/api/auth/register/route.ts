import { NextRequest, NextResponse } from "next/server";

import { createApiHandler } from "@/lib/api/api-helpers";
/**
 * Registration endpoint deprecated.
 * Use /api/auth/initial-setup for first-time system initialization.
 */
export const POST = createApiHandler(
    async (request, context) => {

  return NextResponse.json(
    {
      error: "L'inscription publique est désactivée. Utilisez la configuration initiale.",
      code: "REGISTER_DISABLED",
      setupEndpoint: "/api/auth/initial-setup",
    },
    { status: 410 }
  );
    },
    { requireAuth: false },
);

