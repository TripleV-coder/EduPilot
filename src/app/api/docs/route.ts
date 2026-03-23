import { NextResponse } from "next/server";
import swaggerDocument from "@/lib/swagger";

export async function GET() {
  return NextResponse.json(swaggerDocument);
}
