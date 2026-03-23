import { NextRequest, NextResponse } from "next/server";

/**
 * Registration endpoint deprecated.
 * Use /api/auth/initial-setup for first-time system initialization.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "L'inscription publique est désactivée. Utilisez la configuration initiale.",
      code: "REGISTER_DISABLED",
      setupEndpoint: "/api/auth/initial-setup",
    },
    { status: 410 }
  );
}
