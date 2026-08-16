import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTenantRls } from "@/lib/db/tenant-rls";
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const mockTx = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    studentProfile: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    default: {
      $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
      studentProfile: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
});

describe("tenant-rls helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute set_config in transaction when tenantId is provided", async () => {
    const tenantId = "school-123";
    const result = await withTenantRls(tenantId, async (tx) => {
      await tx.studentProfile.findMany();
      return "done";
    });

    expect(result).toBe("done");
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("should bypass transaction set_config if tenantId is null or undefined", async () => {
    const result = await withTenantRls(null, async () => {
      return "no-tenant";
    });

    expect(result).toBe("no-tenant");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
