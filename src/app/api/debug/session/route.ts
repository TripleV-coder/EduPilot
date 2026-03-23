import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/debug/session
 * Debug endpoint - DEVELOPMENT ONLY
 * Returns session information for debugging purposes
 */
export async function GET() {
  // SECURITY: Only allow in development environment
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "This endpoint is not available" },
      { status: 404 }
    );
  }
  
  // Additional security: Check if debug mode is explicitly enabled
  if (process.env.ENABLE_DEBUG_ENDPOINTS !== "true") {
    return NextResponse.json(
      { error: "Debug endpoints are disabled" },
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
