import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { isZodError } from "@/lib/is-zod-error";
import { Permission } from "@/lib/rbac/permissions";
import {
    importStudentSchema as studentImportRowSchema,
    importTeacherSchema as teacherImportRowSchema,
    importClassSchema as classImportRowSchema,
    importParentSchema as parentImportRowSchema,
    importSubjectSchema as subjectImportRowSchema,
    ImportError,
} from "@/lib/import/schemas";
import { z } from "zod";

/**
 * POST /api/import/preview - Preview import data without writing to database
 * 
 * Validates data and returns preview with errors
 */

const previewRequestSchema = z.object({
    type: z.enum(["students", "teachers", "classes", "parents", "subjects"]),
    data: z.array(z.record(z.string(), z.unknown())),
    limit: z.number().optional().default(10), // Number of rows to preview
});

const schemaMap = {
    students: studentImportRowSchema,
    teachers: teacherImportRowSchema,
    classes: classImportRowSchema,
    parents: parentImportRowSchema,
    subjects: subjectImportRowSchema,
};

export const POST = createApiHandler(
    async (request, { session: _session }, _t) => {
        const body = await request.json();

        // Validate request structure
        let validatedRequest;
        try {
            validatedRequest = previewRequestSchema.parse(body);
        } catch (error) {
            if (isZodError(error)) {
                return NextResponse.json({
                    success: false,
                    message: "Structure de requête invalide",
                    errors: error.issues,
                }, { status: 400 });
            }
            throw error;
        }

        const { type, data, limit } = validatedRequest;
        const schema = schemaMap[type];

        const validRows: unknown[] = [];
        const invalidRows: { row: number; data: unknown; errors: ImportError[] }[] = [];
        const previewRows: { row: number; data: unknown; valid: boolean; errors?: string[] }[] = [];

        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // 1-indexed + header row

            try {
                const validated = schema.parse(row);
                validRows.push(validated);

                if (previewRows.length < limit) {
                    previewRows.push({
                        row: rowNum,
                        data: validated,
                        valid: true,
                    });
                }
            } catch (error) {
                if (isZodError(error)) {
                    const errors = error.issues.map(e => ({
                        row: rowNum,
                        field: e.path.join("."),
                        message: e.message,
                    }));

                    invalidRows.push({
                        row: rowNum,
                        data: row,
                        errors,
                    });

                    if (previewRows.length < limit) {
                        previewRows.push({
                            row: rowNum,
                            data: row,
                            valid: false,
                            errors: errors.map(e => `${e.field}: ${e.message}`),
                        });
                    }
                } else {
                    invalidRows.push({
                        row: rowNum,
                        data: row,
                        errors: [{
                            row: rowNum,
                            message: error instanceof Error ? error.message : "Erreur de validation",
                        }],
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            type,
            summary: {
                total: data.length,
                valid: validRows.length,
                invalid: invalidRows.length,
                percentage: data.length > 0
                    ? Math.round((validRows.length / data.length) * 100)
                    : 0,
            },
            preview: previewRows,
            errors: invalidRows.slice(0, 50), // Limit errors returned
        });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
        requiredPermissions: [Permission.STUDENT_READ], // kept for role-permission consistency
        rateLimit: true,
    }
);
