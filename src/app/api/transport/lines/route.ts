import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Transport lines endpoint.
 *
 * The Bus / Route / TransportLine domain isn't modeled in Prisma yet, so this
 * route returns an empty payload. The page renders an honest "à configurer"
 * empty state until the model lands.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    return NextResponse.json({
        configured: false,
        metrics: {
            activeBuses: null,
            totalBuses: null,
            transportedStudents: null,
            morningLatencyAvg: null,
            weekIncidents: null,
        },
        lines: [],
        notifications: [],
    });
}
