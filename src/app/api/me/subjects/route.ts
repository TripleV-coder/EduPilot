import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (session.user.role !== "TEACHER") {
        return NextResponse.json([]);
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return NextResponse.json([]);
    }

    const subjects = await prisma.classSubject.findMany({
      where: {
        teacherId: teacherProfile.id,
      },
      include: {
        subject: { select: { name: true } },
        class: { select: { name: true } },
      },
    });

    return NextResponse.json(subjects);
  } catch (error) {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
