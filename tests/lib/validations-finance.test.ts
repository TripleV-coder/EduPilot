import { describe, it, expect } from "vitest";
import {
  feeSchema,
  paymentSchema,
  paymentPlanSchema,
  scholarshipSchema,
  paymentFilterSchema,
  reconciliationSchema,
  invoiceSchema,
} from "@/lib/validations/finance";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/finance", () => {
  describe("feeSchema", () => {
    it("requires positive amount", () => {
      expect(feeSchema.safeParse({ name: "Fr", amount: 0 }).success).toBe(false);
      expect(feeSchema.safeParse({ name: "Frais Inscription", amount: -1 }).success).toBe(false);
    });

    it("accepts a valid fee", () => {
      const r = feeSchema.safeParse({ name: "Inscription", amount: 50000 });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isRequired).toBe(true);
    });

    it("rejects too-short name", () => {
      expect(feeSchema.safeParse({ name: "F", amount: 1000 }).success).toBe(false);
    });
  });

  describe("paymentSchema", () => {
    it("accepts known methods", () => {
      for (const method of [
        "CASH",
        "MOBILE_MONEY_MTN",
        "MOBILE_MONEY_MOOV",
        "BANK_TRANSFER",
        "CHECK",
        "OTHER",
      ]) {
        const r = paymentSchema.safeParse({
          studentId: cuid(),
          feeId: cuid(),
          amount: 1000,
          method,
        });
        expect(r.success).toBe(true);
      }
    });

    it("rejects unknown method", () => {
      const r = paymentSchema.safeParse({
        studentId: cuid(),
        feeId: cuid(),
        amount: 1000,
        method: "CRYPTO",
      });
      expect(r.success).toBe(false);
    });

    it("rejects invalid cuid", () => {
      const r = paymentSchema.safeParse({
        studentId: "not-a-cuid",
        feeId: cuid(),
        amount: 1000,
        method: "CASH",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("paymentPlanSchema", () => {
    it("limits installments to 12 max", () => {
      const base = {
        studentId: cuid(),
        feeId: cuid(),
        totalAmount: 12000,
        firstDueDate: new Date(),
      };
      expect(paymentPlanSchema.safeParse({ ...base, installments: 12 }).success).toBe(true);
      expect(paymentPlanSchema.safeParse({ ...base, installments: 13 }).success).toBe(false);
      expect(paymentPlanSchema.safeParse({ ...base, installments: 0 }).success).toBe(false);
    });
  });

  describe("scholarshipSchema", () => {
    const base = {
      studentId: cuid(),
      name: "Bourse Excellence",
      type: "MERIT",
      startDate: new Date("2026-09-01"),
    } as const;

    it("requires either amount or percentage", () => {
      expect(scholarshipSchema.safeParse(base).success).toBe(false);
    });

    it("accepts amount-only", () => {
      expect(scholarshipSchema.safeParse({ ...base, amount: 50000 }).success).toBe(true);
    });

    it("accepts percentage-only", () => {
      expect(scholarshipSchema.safeParse({ ...base, percentage: 25 }).success).toBe(true);
    });

    it("rejects percentage out of range", () => {
      expect(scholarshipSchema.safeParse({ ...base, percentage: 150 }).success).toBe(false);
      expect(scholarshipSchema.safeParse({ ...base, percentage: -5 }).success).toBe(false);
    });
  });

  describe("paymentFilterSchema", () => {
    it("defaults page/pageSize", () => {
      const r = paymentFilterSchema.safeParse({});
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(1);
        expect(r.data.pageSize).toBe(20);
      }
    });

    it("coerces strings to numbers", () => {
      const r = paymentFilterSchema.safeParse({ page: "3", pageSize: "50" });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.page).toBe(3);
        expect(r.data.pageSize).toBe(50);
      }
    });
  });

  describe("reconciliationSchema", () => {
    it("accepts array of cuids", () => {
      const r = reconciliationSchema.safeParse({
        paymentIds: [cuid(), cuid()],
        reconciledBy: cuid(),
      });
      expect(r.success).toBe(true);
    });

    it("rejects bad cuids", () => {
      const r = reconciliationSchema.safeParse({
        paymentIds: ["bad"],
        reconciledBy: cuid(),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("invoiceSchema", () => {
    it("defaults includeSchoolLogo to true", () => {
      const r = invoiceSchema.safeParse({ paymentId: cuid() });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.includeSchoolLogo).toBe(true);
    });
  });
});
