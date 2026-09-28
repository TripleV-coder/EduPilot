import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    default: { fee: { findFirst: vi.fn(), update: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import { PATCH, DELETE } from "@/app/api/fees/[id]/route";

const feeId = cuid("fraistenue");
const params = { params: Promise.resolve({ id: feeId }) };
const url = `http://localhost:3000/api/fees/${feeId}`;

function fee(payments = 0, schoolId = FIXTURES.schoolA) {
    return { id: feeId, schoolId, amount: 12000, _count: { payments } } as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
});

describe("PATCH /api/fees/[id] (recette : aucun moyen de modifier un frais)", () => {
    it("modifie le montant d'un frais encore jamais encaissé", async () => {
        vi.mocked(prisma.fee.findFirst).mockResolvedValue(fee());
        vi.mocked(prisma.fee.update).mockResolvedValue({ id: feeId, amount: 13500 } as never);
        const res = await PATCH(makeRequest(url, { method: "PATCH", body: { amount: 13500 } }), params);
        expect(res.status).toBe(200);
        expect(vi.mocked(prisma.fee.update).mock.calls[0][0].data).toEqual({ amount: 13500 });
    });

    it("gèle le montant d'un frais déjà encaissé", async () => {
        vi.mocked(prisma.fee.findFirst).mockResolvedValue(fee(3));
        const res = await PATCH(makeRequest(url, { method: "PATCH", body: { amount: 13500 } }), params);
        expect(res.status).toBe(409);
        expect(prisma.fee.update).not.toHaveBeenCalled();
    });

    it("laisse renommer un frais déjà encaissé", async () => {
        vi.mocked(prisma.fee.findFirst).mockResolvedValue(fee(3));
        vi.mocked(prisma.fee.update).mockResolvedValue({ id: feeId } as never);
        const res = await PATCH(makeRequest(url, { method: "PATCH", body: { name: "Tenue scolaire (2 pièces)" } }), params);
        expect(res.status).toBe(200);
    });

    it("ne touche pas au frais d'un autre établissement", async () => {
        vi.mocked(prisma.fee.findFirst).mockResolvedValue(fee(0, FIXTURES.schoolB));
        const res = await PATCH(makeRequest(url, { method: "PATCH", body: { amount: 1 } }), params);
        expect(res.status).toBe(404);
    });

    it("refuse un enseignant", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
        const res = await PATCH(makeRequest(url, { method: "PATCH", body: { amount: 1 } }), params);
        expect(res.status).toBe(403);
    });
});

describe("DELETE /api/fees/[id]", () => {
    it("retire un frais jamais encaissé (suppression douce)", async () => {
        vi.mocked(prisma.fee.findFirst).mockResolvedValue(fee());
        const res = await DELETE(makeRequest(url, { method: "DELETE" }), params);
        expect(res.status).toBe(200);
        expect(vi.mocked(prisma.fee.update).mock.calls[0][0].data).toMatchObject({ isActive: false });
    });

    it("refuse de supprimer un frais déjà encaissé", async () => {
        vi.mocked(prisma.fee.findFirst).mockResolvedValue(fee(1));
        const res = await DELETE(makeRequest(url, { method: "DELETE" }), params);
        expect(res.status).toBe(409);
        expect(prisma.fee.update).not.toHaveBeenCalled();
    });
});
