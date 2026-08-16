import { NextResponse } from "next/server";
import swaggerDocument from "@/lib/swagger";
import { createApiHandler } from "@/lib/api/api-helpers";

export const GET = createApiHandler(async (_request, context) => {
  return NextResponse.json(swaggerDocument);

}, { requireAuth: false });
