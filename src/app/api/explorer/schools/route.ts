import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Coordonnées approximatives par ville (Bénin / Afrique) pour le placement sur le globe
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Cotonou: { lat: 6.3703, lng: 2.3912 },
  "Porto-Novo": { lat: 6.4969, lng: 2.6289 },
  Parakou: { lat: 9.3372, lng: 2.6303 },
  Abomey: { lat: 7.1829, lng: 1.9912 },
  Natitingou: { lat: 10.3042, lng: 1.3796 },
  Lokossa: { lat: 6.6389, lng: 1.7167 },
  Ouidah: { lat: 6.3631, lng: 2.0851 },
  Djougou: { lat: 9.7081, lng: 1.8960 },
  Bohicon: { lat: 7.1783, lng: 2.0667 },
  Kandi: { lat: 11.1342, lng: 2.9386 },
};

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = (lng * Math.PI) / 180;
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * GET /api/explorer/schools
 * Liste des établissements avec coordonnées pour le globe (auth optionnelle).
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    let where: { isActive: boolean; id?: string } = { isActive: true };
    if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.schoolId) {
      where = { ...where, id: getActiveSchoolId(session) };
    }

    const schools = await prisma.school.findMany({
      where,
      include: {
        _count: { 
          select: { 
            users: true, 
            classes: true,
            studentProfiles: true,
            teacherProfiles: true,
          } 
        },
      },
      orderBy: { name: "asc" },
    });

    const radius = 5;
    const items = schools.map((school, i) => {
      const city = school.city?.trim() || "";
      const coords =
        CITY_COORDS[city] ||
        (() => {
          // Répartition sur le globe (Fibonacci-style) si ville inconnue
          const phi = Math.acos(-1 + (2 * i) / Math.max(schools.length, 1));
          const theta = Math.sqrt(schools.length * Math.PI) * phi;
          return {
            lat: 90 - (phi * 180) / Math.PI,
            lng: (theta * 180) / Math.PI,
          };
        })();
      const vec = latLngToVector3(coords.lat, coords.lng, radius);
      return {
        id: school.id,
        name: school.name,
        code: school.code,
        city: school.city,
        address: school.address,
        level: school.level,
        type: school.type,
        studentsCount: school._count.studentProfiles,
        teachersCount: school._count.teacherProfiles,
        classesCount: school._count.classes,
        position: [vec.x, vec.y, vec.z],
        lat: coords.lat,
        lng: coords.lng,
      };
    });

    return NextResponse.json({ schools: items });
  } catch (error) {
    logger.error("Explorer schools error", error as Error, {
      endpoint: "/api/explorer/schools",
    });
    return NextResponse.json(
      { error: "Erreur lors du chargement des établissements" },
      { status: 500 }
    );
  }
}
