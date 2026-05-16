import { NextResponse } from "next/server";
import { z } from "zod";

const uxEventSchema = z.object({
  event: z.string().min(1),
  pathname: z.string().min(1).optional(),
  timestamp: z.string().optional(),
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = uxEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
    }

    // Sprint 3 lightweight telemetry endpoint.
    // Can be wired to DB/queue later without changing client contracts.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Malformed telemetry request" }, { status: 400 });
  }
}
