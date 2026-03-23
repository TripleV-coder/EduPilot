import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { subjectSchema } from "@/lib/validations/subject";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { invalidateByPath, CACHE_TTL_LONG, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";

export const GET = createApiHandler(
    async (request, { session }, t) => {
        const { searchParams } = new URL(request.url);
        const schoolId = searchParams.get("schoolId") || session.user.schoolId;

        if (!schoolId) {
            if (session.user.role === "SUPER_ADMIN") {
                const allSubjects = await prisma.subject.findMany({
                    orderBy: { name: "asc" },
                });
                return NextResponse.json(allSubjects);
            }
            return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
        }

        if (session.user.role !== "SUPER_ADMIN" && schoolId !== session.user.schoolId) {
            return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }

        const search = searchParams.get("search");

        const where: Prisma.SubjectWhereInput = { schoolId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
            ];
        }

        const url = new URL(request.url);
        const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

        const handler = async () => {
            const subjects = await prisma.subject.findMany({
                where,
                orderBy: { name: "asc" },
            });

            return NextResponse.json(subjects);
        };

        const response = await withCache(handler as any, { ttl: CACHE_TTL_LONG, key: cacheKey });
        return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_LONG, staleWhileRevalidate: 60 });
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.SUBJECT_READ],
    }
);

export const POST = createApiHandler(
    async (request, { session }, t) => {
        let schoolId = session.user.schoolId;
        const body = await request.json();

        if (session.user.role === "SUPER_ADMIN") {
            if (body.schoolId) {
                schoolId = body.schoolId;
            }
        }

        if (!schoolId) {
            return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
        }

        const validatedData = subjectSchema.parse(body);

        const existing = await prisma.subject.findFirst({
            where: { schoolId, code: validatedData.code },
        });

        if (existing) {
            return NextResponse.json(translateError(API_ERRORS.ALREADY_EXISTS("Code Matière"), t), { status: 400 });
        }

        const subject = await prisma.subject.create({
            data: {
                schoolId,
                name: validatedData.name,
                code: validatedData.code,
                category: validatedData.category || null,
                coefficient: validatedData.coefficient || 1,
                isActive: validatedData.isActive ?? true,
            },
        });

        await invalidateByPath("/api/subjects");
        return NextResponse.json(subject, { status: 201 });
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.SUBJECT_CREATE],
    }
);
