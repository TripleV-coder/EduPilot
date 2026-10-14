import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { listMessageRecipients } from "@/lib/messages/recipients";

/** GET /api/messages/recipients — destinataires autorisés pour un nouveau message. */
export const GET = createApiHandler(async (_request, { session }) => {
  const recipients = await listMessageRecipients(
    session.user.id,
    session.user.role,
    getActiveSchoolId(session),
  );
  return NextResponse.json({ data: recipients });
});
