import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

export const GET = createApiHandler(
  async (request, context) => {
    const session = context.session;

    if (session.user.role !== "TEACHER") {
        return NextResponse.json([]);
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json([]);
    }

    const activeSchoolId = getActiveSchoolId(session);

    const subjects = await prisma.classSubject.findMany({
      where: {
        teacherId: teacherProfile.id,
        ...(activeSchoolId ? { class: { schoolId: activeSchoolId } } : {}),
      },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    return NextResponse.json(subjects);
  },
);
