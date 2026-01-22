import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/debug/session
 * Debug endpoint - DEVELOPMENT ONLY
 * Returns session information for debugging purposes
 */
export async function GET() {
  // SECURITY: Only allow in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is not available in production" },
      { status: 404 }
    );
  }

  try {
    const session = await auth();

    return NextResponse.json({
      authenticated: !!session,
      session: session ? {
        user: {
          id: session.user.id,
          email: session.user.email,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          role: session.user.role,
          schoolId: session.user.schoolId,
        }
      } : null,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      authenticated: false,
    }, { status: 500 });
  }
}
