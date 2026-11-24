/**
 * Envoi des opérations de la file hors ligne (OFF-01). Mêmes routes que la
 * saisie en ligne ; les clés d'idempotence rendent chaque renvoi sans effet
 * de bord.
 */
import { classifyResponse, type OutboxOp, type SendOutcome } from "@/lib/offline/outbox";

export interface AttendancePayload {
    classId: string;
    date: string;
    records: Array<{ studentId: string; status: string; notes?: string }>;
}

export interface GradesPayload {
    evaluation: {
        classSubjectId: string;
        periodId: string;
        typeId: string;
        title?: string;
        date: string;
        maxGrade: number;
        clientKey: string;
    };
    grades: unknown[];
}

const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

export async function sendOutboxOp(op: OutboxOp): Promise<SendOutcome> {
    if (op.kind === "attendance") {
        return classifyResponse(await fetch("/api/attendance/bulk", json(op.payload as AttendancePayload)));
    }
    const payload = op.payload as GradesPayload;
    const evalRes = await fetch("/api/evaluations", json(payload.evaluation));
    const evalOutcome = await classifyResponse(evalRes.clone());
    if (evalOutcome !== "done") return evalOutcome;
    const evaluation = (await evalRes.json()) as { id: string };
    if (payload.grades.length === 0) return "done";
    return classifyResponse(await fetch("/api/grades/batch", json({ evaluationId: evaluation.id, grades: payload.grades })));
}
