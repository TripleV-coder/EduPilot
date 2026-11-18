import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { listMessageRecipients } from "@/lib/messages/recipients";

/**
 * GET /api/messages/recipients?q=&limit= — destinataires autorisés pour un
 * nouveau message, triés par nom. `q` cherche dans le prénom, le nom ou
 * l'e-mail ; `total` donne le nombre de correspondances (la liste en renvoie
 * au plus `limit`, 50 par défaut, 100 au maximum).
 */
export const GET = createApiHandler(async (request, { session }) => {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, 100);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const result = await listMessageRecipients(session.user.id, session.user.role, getActiveSchoolId(session), {
    query,
    take: Number.isFinite(limit) ? limit : undefined,
  });
  return NextResponse.json(result);
});
