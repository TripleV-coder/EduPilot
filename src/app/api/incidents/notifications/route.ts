import { NextRequest, NextResponse } from "next/server";


// Endpoint disabled as underlying schema models (IncidentNotification) are missing.
// TODO: Implement schema changes or refactor to use Notification model.

export async function GET(_request: NextRequest) {
  return NextResponse.json({ error: "Not Implemented" }, { status: 501 });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "Not Implemented" }, { status: 501 });
}
